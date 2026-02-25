import { useState, useRef, useCallback, useEffect } from "react";
import { getBestRecordingMimeType } from "@/lib/audio-converter";
import { normalizeAudioMimeType } from "@/lib/audio-mime";
import { transcodeWebmBlobToWavBase64 } from "@/lib/audio-transcode";

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  isConverting: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  audioBase64: string | null;
  audioMimeType: string | null;
  amplitudes: number[];
}

export interface UseAudioRecorderReturn extends AudioRecorderState {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    isConverting: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    audioBase64: null,
    audioMimeType: null,
    amplitudes: [],
  });
  const [error, setError] = useState<string | null>(null);

  // Guards against race conditions when the user cancels while getUserMedia is still pending.
  // Each new capture attempt increments this token; any late-resolving async work must verify it.
  const captureRequestIdRef = useRef(0);

  // Keep an always-fresh snapshot for callbacks that must not re-create
  const stateRef = useRef<AudioRecorderState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chunkMetaRef = useRef<{ t: number; size: number }[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const stopWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const waveformDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const lastWaveformUpdateRef = useRef<number>(0);

  // Release microphone + realtime capture resources ASAP (without clearing recorded chunks).
  // This prevents Chrome from showing the mic indicator during post-processing (conversion/transcode).
  const releaseCaptureResources = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (stopWatchdogRef.current) {
      clearTimeout(stopWatchdogRef.current);
      stopWatchdogRef.current = null;
    }

    // Disconnect WebAudio graph ASAP to avoid keeping the capture pipeline referenced.
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        // ignore
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      // close() is async; we still null the ref to ensure no one keeps using it.
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      void ctx.close().catch(() => {
        /* ignore */
      });
    }
    analyserRef.current = null;
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Invalidate any pending startRecording() async work (e.g., late getUserMedia resolution).
    captureRequestIdRef.current += 1;
    if (import.meta.env.DEV) {
      console.debug("[useAudioRecorder] cleanup: invalidated captureRequestId", captureRequestIdRef.current);
    }

    // IMPORTANT:
    // If we are cancelling/unmounting/restarting, make sure to stop the MediaRecorder
    // WITHOUT running the onstop processing pipeline (which would otherwise keep work alive).
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        recorder.stop();
      } catch {
        // ignore
      }
    }
    releaseCaptureResources();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    chunkMetaRef.current = [];
  }, [releaseCaptureResources]);

  function base64ToBlob(base64Raw: string, mimeType: string): Blob {
    const binary = atob(base64Raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  }

  // Update amplitudes for waveform visualization
  // IMPORTANT: keep this callback stable to avoid re-triggering effects that depend on startRecording.
  const updateAmplitudes = useCallback(() => {
    const analyser = analyserRef.current;
    const recorderState = mediaRecorderRef.current?.state;

    // IMPORTANT:
    // Do not rely on React state here. When recording starts, stateRef may still be stale on the
    // first animation frame, causing the loop to exit and the waveform to freeze.
    if (!analyser || recorderState !== "recording") return;

    // Throttle UI updates (~30fps) to avoid excessive re-renders.
    const now = performance.now();
    if (now - lastWaveformUpdateRef.current < 33) {
      animationRef.current = requestAnimationFrame(updateAmplitudes);
      return;
    }
    lastWaveformUpdateRef.current = now;

    // Use time-domain RMS (energy) for a more responsive voice visualizer.
    // Reuse the buffer to avoid per-frame allocations.
    if (!waveformDataRef.current || waveformDataRef.current.length !== analyser.fftSize) {
      waveformDataRef.current = new Uint8Array(analyser.fftSize);
    }
    const data = waveformDataRef.current;
    analyser.getByteTimeDomainData(data);

    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / data.length);

    // Normalize + apply a gentle curve so low volumes are still visible.
    const normalizedAmplitude = Math.min(1, Math.pow(rms * 2.2, 0.6));

    setState((prev) => ({
      ...prev,
      amplitudes: [...prev.amplitudes.slice(-50), normalizedAmplitude],
    }));

    animationRef.current = requestAnimationFrame(updateAmplitudes);
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      cleanup();

      // New capture attempt token (must be checked after every awaited step).
      const requestId = captureRequestIdRef.current;
      if (import.meta.env.DEV) {
        console.debug("[useAudioRecorder] startRecording: begin", { requestId });
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // IMPORTANT:
          // Forcing sampleRate can trigger unstable resampling in some Chrome/driver combos and create
          // dropouts ("picotado"). Let the browser/device pick a native rate.
          // We also avoid heavy processing here; if you want AEC/NS/AGC, we can reintroduce later behind a flag.
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // If the user cancelled/unmounted while permissions prompt was open,
      // immediately stop the newly acquired stream and abort.
      if (requestId !== captureRequestIdRef.current) {
        if (import.meta.env.DEV) {
          console.debug("[useAudioRecorder] startRecording: stale getUserMedia result; stopping tracks", {
            requestId,
            current: captureRequestIdRef.current,
          });
        }
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      // Setup audio context for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      // More responsive visualization for voice.
      analyserRef.current.fftSize = 1024;
      analyserRef.current.smoothingTimeConstant = 0.25;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyserRef.current);

      // Another guard in case a cancel happened between getUserMedia and audio graph setup.
      if (requestId !== captureRequestIdRef.current) {
        if (import.meta.env.DEV) {
          console.debug("[useAudioRecorder] startRecording: stale after audio graph; releasing capture", {
            requestId,
            current: captureRequestIdRef.current,
          });
        }
        releaseCaptureResources();
        return;
      }

      // Use the best available recording format
      const mimeType = getBestRecordingMimeType();

      // Setup media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        // Stabilize encoder bitrate to reduce odd chunk variability.
        audioBitsPerSecond: 96_000,
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      chunkMetaRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          if (import.meta.env.DEV) {
            chunkMetaRef.current.push({ t: performance.now(), size: e.data.size });
          }
        }
      };

      mediaRecorder.onstop = async () => {
        const recordedBlob = new Blob(chunksRef.current, { type: mimeType });

        // IMPORTANT:
        // Release the mic + capture pipeline immediately, before any async processing.
        // This ensures the browser stops indicating the microphone is in use.
        releaseCaptureResources();
        
        // Show converting state briefly
        setState((prev) => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          isConverting: true,
        }));

        try {
          // Convert blob to base64 directly - Z-API handles the format
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const result = reader.result as string;
              // Extract just the base64 part (remove data:audio/xxx;base64, prefix)
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(recordedBlob);
          });

          const baseMimeType = normalizeAudioMimeType(mimeType) || "audio/webm";
          let finalBase64 = base64;
          let finalMimeType = baseMimeType;
          let finalBlob: Blob = recordedBlob;

          // Chrome/Edge usually records audio/webm; WhatsApp iOS frequently fails decoding it.
          // We transcode to WAV (PCM) via backend to maximize iOS compatibility.
          if (baseMimeType === "audio/webm") {
            try {
              // Avoid huge payloads (WAV/PCM expands size significantly).
              // Keep this conservative; we can revisit once we measure real-world sizes.
              if (stateRef.current.duration > 60) {
                throw new Error("Audio too long for WAV transcode");
              }
              const transcoded = await transcodeWebmBlobToWavBase64(recordedBlob);
              finalBase64 = transcoded.base64;
              finalMimeType = transcoded.mimeType;
              finalBlob = base64ToBlob(finalBase64, finalMimeType);
            } catch (transcodeError) {
              // Fallback to the original recording.
              if (import.meta.env.DEV) {
                console.warn("[useAudioRecorder] WAV transcode failed, falling back to original webm:", transcodeError);
              }
            }
          }

          const url = URL.createObjectURL(finalBlob);
          
          setState((prev) => ({
            ...prev,
            isConverting: false,
            // Keep audioBlob aligned with what the app will send (if transcoded, blob is WAV)
            audioBlob: finalBlob,
            audioUrl: url,
            audioBase64: finalBase64,
            audioMimeType: finalMimeType,
          }));

          if (import.meta.env.DEV) {
            const meta = chunkMetaRef.current;
            const chunkCount = meta.length;
            const chunkSizes = meta.map((m) => m.size);
            const min = chunkSizes.length ? Math.min(...chunkSizes) : 0;
            const max = chunkSizes.length ? Math.max(...chunkSizes) : 0;
            const avg = chunkSizes.length ? Math.round(chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length) : 0;
            const deltas = meta.slice(1).map((m, i) => m.t - meta[i].t);
            const deltaMin = deltas.length ? Math.round(Math.min(...deltas)) : 0;
            const deltaMax = deltas.length ? Math.round(Math.max(...deltas)) : 0;
            const deltaAvg = deltas.length ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0;

            console.log("[useAudioRecorder] recording finalized", {
              inputMimeType: mimeType,
              outputMimeType: finalMimeType,
              blobBytes: finalBlob.size,
              durationSecondsTimer: stateRef.current.duration,
              base64Length: finalBase64.length,
              chunks: { count: chunkCount, bytes_min: min, bytes_avg: avg, bytes_max: max },
              chunkIntervalMs: { min: deltaMin, avg: deltaAvg, max: deltaMax },
            });
          }
        } catch (error) {
          console.error("Error processing audio:", error);
          setState((prev) => ({
            ...prev,
            isConverting: false,
          }));
        }

        cleanup();
      };

      // IMPORTANT:
      // Using an aggressive timeslice (e.g., 100ms) can create jitter/dropouts in some environments.
      // For short voice notes, let the browser buffer and flush on stop.
      mediaRecorder.start();

      // Reset state FIRST before starting timer
      setState({
        isRecording: true,
        isPaused: false,
        isConverting: false,
        duration: 0,
        audioBlob: null,
        audioUrl: null,
        audioBase64: null,
        audioMimeType: null,
        amplitudes: [],
      });

      // Clear any existing timer before creating new one
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Start duration timer AFTER state is reset
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          duration: prev.duration + 1,
        }));
      }, 1000);

      // Start amplitude tracking
      animationRef.current = requestAnimationFrame(updateAmplitudes);
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível acessar o microfone"
      );
      cleanup();
    }
  }, [cleanup, releaseCaptureResources, updateAmplitudes]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      // Request a final chunk before stopping (some implementations are more reliable with this).
      try {
        mediaRecorderRef.current.requestData();
      } catch {
        // ignore
      }
      mediaRecorderRef.current.stop();

      // Fallback: in some Chrome setups the mic indicator can remain if the stop chain stalls.
      // If we still have live tracks shortly after stop(), force release.
      if (stopWatchdogRef.current) {
        clearTimeout(stopWatchdogRef.current);
      }
      stopWatchdogRef.current = setTimeout(() => {
        const hasLiveTracks =
          streamRef.current?.getTracks().some((t) => t.readyState === "live") ?? false;
        if (hasLiveTracks) {
          if (import.meta.env.DEV) {
            console.warn("[useAudioRecorder] stop watchdog: forcing capture release");
          }
          releaseCaptureResources();
        }
      }, 800);
    }
  }, [releaseCaptureResources]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          duration: prev.duration + 1,
        }));
      }, 1000);
      setState((prev) => ({ ...prev, isPaused: false }));
      animationRef.current = requestAnimationFrame(updateAmplitudes);
    }
  }, [updateAmplitudes]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    cleanup();
    setState({
      isRecording: false,
      isPaused: false,
      isConverting: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      audioBase64: null,
      audioMimeType: null,
      amplitudes: [],
    });
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    error,
  };
}

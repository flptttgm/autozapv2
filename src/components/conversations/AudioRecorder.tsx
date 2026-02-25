import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Send, Loader2, Square, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { PlaybackWaveform } from "@/components/whatsapp/PlaybackWaveform";
import { toast } from "sonner";
import { normalizeAudioMimeType } from "@/lib/audio-mime";
import { useIsMobile } from "@/hooks/use-mobile";

interface AudioRecorderProps {
  onSend: (audioBase64: string, duration: number, mimeType: string) => void;
  onCancel: () => void;
  isPending: boolean;
  disabled?: boolean;
}

// Format seconds to mm:ss
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const AudioRecorder = memo(function AudioRecorder({
  onSend,
  onCancel,
  isPending,
  disabled = false,
}: AudioRecorderProps) {
  const isMobile = useIsMobile();
  const durationRef = useRef(0);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Preview state
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const {
    isRecording,
    isConverting,
    duration,
    audioBlob,
    audioBase64,
    audioMimeType,
    audioUrl,
    amplitudes,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
  } = useAudioRecorder();

  // Keep duration ref updated
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Auto-start recording when component mounts (only once)
  useEffect(() => {
    startRecording();
    
    return () => {
      cancelRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show error if any
  useEffect(() => {
    if (error) {
      toast.error("Erro ao gravar áudio", { description: error });
      onCancel();
    }
  }, [error, onCancel]);

  // Transition to preview mode when recording stops and audio is ready
  useEffect(() => {
    if (!isRecording && !isConverting && audioUrl && audioBase64) {
      setIsPreviewMode(true);
    }
  }, [isRecording, isConverting, audioUrl, audioBase64]);

  // Handle stop recording
  const handleStopRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  // Handle play/pause in preview mode
  const handlePlayPause = useCallback(() => {
    if (!audioElementRef.current) return;
    
    if (isPlaying) {
      audioElementRef.current.pause();
    } else {
      audioElementRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Handle confirm send
  const handleConfirmSend = useCallback(() => {
    if (!audioBase64 || durationRef.current <= 0) return;

    // Prefer the mime type decided by the recorder pipeline (may be transcoded).
    const mimeType =
      normalizeAudioMimeType(audioMimeType) ||
      normalizeAudioMimeType(audioBlob?.type) ||
      "audio/webm";

    // Z-API expects *raw* base64 (no data URL prefix)
    const normalizedBase64 = audioBase64
      .replace(/^data:audio\/[a-zA-Z0-9.+-]+;base64,/, "")
      .replace(/\s+/g, "")
      .trim();

    if (!normalizedBase64) {
      toast.error("Áudio inválido", { description: "Não foi possível preparar o áudio para envio." });
      return;
    }

    onSend(normalizedBase64, durationRef.current, mimeType);
  }, [audioBase64, audioBlob, audioMimeType, onSend]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }

    // Ensure the recorder is stopped before cleanup so Chrome releases the mic reliably.
    if (isRecording) {
      stopRecording();
    }
    cancelRecording();
    onCancel();
  }, [cancelRecording, isRecording, onCancel, stopRecording]);

  const maxWaveformBars = isMobile ? 24 : 50;
  const visibleAmplitudes = useMemo(
    () => amplitudes.slice(-maxWaveformBars),
    [amplitudes, maxWaveformBars]
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Hidden audio element for playback */}
      {audioUrl && (
        <audio
          ref={audioElementRef}
          src={audioUrl}
          onTimeUpdate={(e) => {
            const audio = e.currentTarget;
            if (audio.duration) {
              setPlaybackProgress((audio.currentTime / audio.duration) * 100);
              setCurrentTime(audio.currentTime);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setPlaybackProgress(0);
            setCurrentTime(0);
          }}
        />
      )}

      {isPreviewMode ? (
        // Preview Mode UI
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Cancel button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleCancel}
            disabled={isPending}
          >
            <Trash2 className="h-5 w-5" />
          </Button>

          {/* Play/Pause button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-primary hover:text-primary hover:bg-primary/10"
            onClick={handlePlayPause}
            disabled={isPending}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
          </Button>

          {/* Waveform and duration */}
          <div className="flex-1 flex items-center gap-3">
            <PlaybackWaveform 
              isPlaying={isPlaying} 
              progress={playbackProgress}
              className="flex-1"
            />
            <span className="text-sm font-medium tabular-nums text-muted-foreground whitespace-nowrap">
              {formatDuration(currentTime)} / {formatDuration(durationRef.current)}
            </span>
          </div>

          {/* Send button */}
          <Button
            onClick={handleConfirmSend}
            disabled={isPending || disabled}
            size="icon"
            className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all hover:scale-105"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      ) : (
        // Recording Mode UI
        <div className="flex min-w-0 items-center gap-3 px-4 py-3">
          {/* Cancel button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleCancel}
            disabled={isPending}
          >
            <Trash2 className="h-5 w-5" />
          </Button>

          {/* Recording indicator and waveform */}
          <div className="flex-1 min-w-0 flex items-center gap-3">
            {/* Recording dot */}
            <div className="flex shrink-0 items-center gap-2">
              <div
                className={cn(
                  "w-3 h-3 rounded-full",
                  isConverting ? "bg-amber-500 animate-pulse" : 
                  isRecording ? "bg-destructive animate-pulse" : "bg-muted-foreground"
                )}
              />
              <span className="text-sm font-medium tabular-nums">
                {isConverting ? (
                  <Loader2
                    className="h-4 w-4 animate-spin text-muted-foreground"
                    aria-label="Convertendo áudio"
                  />
                ) : (
                  formatDuration(duration)
                )}
              </span>
            </div>

            {/* Waveform visualization */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex h-8 items-center gap-0.5 overflow-hidden">
              {visibleAmplitudes.length > 0 ? (
                visibleAmplitudes.map((amplitude, index) => (
                  <div
                    key={index}
                    className="w-1 shrink-0 rounded-full bg-primary transition-all duration-75"
                    style={{
                      height: `${Math.max(8, amplitude * 100)}%`,
                      opacity: 0.5 + amplitude * 0.5,
                    }}
                  />
                ))
              ) : (
                // Placeholder bars when not recording
                Array.from({ length: isMobile ? 18 : 30 }).map((_, index) => (
                  <div
                    key={index}
                    className="w-1 shrink-0 rounded-full bg-muted-foreground/30"
                    style={{ height: "30%" }}
                  />
                ))
              )}
              </div>
            </div>
          </div>

          {/* Stop button */}
          <Button
            onClick={handleStopRecording}
            disabled={isPending || disabled || isConverting || !isRecording}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all hover:scale-105"
          >
            {isConverting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4 fill-current" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
});

import { supabase } from "@/integrations/supabase/client";
import { normalizeAudioMimeType } from "@/lib/audio-mime";

type WavTranscodeResult = {
  base64: string; // raw base64, without data URL prefix
  mimeType: "audio/wav";
  sampleRate: number;
};

function stripDataUrlPrefix(dataUrlOrBase64: string): string {
  // Accept any data:*;base64, prefix, not only data:audio/*
  return dataUrlOrBase64.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "").trim();
}

function downmixToMono(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  if (channels === 1) return buffer.getChannelData(0);

  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i];
  }
  for (let i = 0; i < length; i++) mono[i] /= channels;
  return mono;
}

export async function transcodeWebmBlobToWavBase64(blob: Blob): Promise<WavTranscodeResult> {
  const baseMime = normalizeAudioMimeType(blob.type);
  if (baseMime !== "audio/webm") {
    throw new Error(`Unsupported input mime type: ${blob.type}`);
  }

  const arrayBuffer = await blob.arrayBuffer();

  // Use a dedicated AudioContext instance for decoding.
  // Note: Safari iOS has stricter autoplay policies, but this runs after user interaction.
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const mono = downmixToMono(decoded);
    const sampleRate = decoded.sampleRate;

    // PCM float array can be large; keep it lean (mono) and send only what we need.
    const pcmArray = Array.from(mono);

    const { data, error } = await supabase.functions.invoke("convert-audio", {
      body: {
        pcm_data: pcmArray,
        sample_rate: sampleRate,
      },
    });

    if (error) {
      throw new Error(error.message || "convert-audio failed");
    }

    const audioBase64 = (data as any)?.audio_base64 as string | undefined;
    const format = (data as any)?.format;
    if (!audioBase64 || format !== "wav") {
      throw new Error("convert-audio returned invalid payload");
    }

    return {
      base64: stripDataUrlPrefix(audioBase64),
      mimeType: "audio/wav",
      sampleRate,
    };
  } finally {
    try {
      await audioContext.close();
    } catch {
      // ignore
    }
  }
}

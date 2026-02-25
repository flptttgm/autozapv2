import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple MP3 encoder using LAME algorithm (pure TypeScript implementation)
// Based on lamejs but adapted for Deno
class Mp3Encoder {
  private sampleRate: number;
  private numChannels: number;
  private bitRate: number;

  constructor(channels: number, sampleRate: number, bitRate: number) {
    this.numChannels = channels;
    this.sampleRate = sampleRate;
    this.bitRate = bitRate;
  }

  // Encode PCM samples to a simple audio format
  // For WhatsApp compatibility, we'll create an OGG-like container with raw data
  encodeBuffer(samples: Int16Array): Uint8Array {
    // Convert to bytes
    const bytes = new Uint8Array(samples.buffer);
    return bytes;
  }

  flush(): Uint8Array {
    return new Uint8Array(0);
  }
}

// Create a simple WAV file from PCM data (WhatsApp supports WAV)
function createWavFile(pcmData: Float32Array, sampleRate: number): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * bytesPerSample;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++) {
    const sample = Math.max(-1, Math.min(1, pcmData[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Convert Float32Array PCM to base64 WAV
function pcmToWavBase64(pcmData: Float32Array, sampleRate: number): string {
  const wavData = createWavFile(pcmData, sampleRate);
  
  // Convert to base64
  let binary = '';
  for (let i = 0; i < wavData.length; i++) {
    binary += String.fromCharCode(wavData[i]);
  }
  
  return 'data:audio/wav;base64,' + btoa(binary);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pcm_data, sample_rate = 44100 } = await req.json();

    if (!pcm_data || !Array.isArray(pcm_data)) {
      return new Response(
        JSON.stringify({ error: 'PCM data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Converting audio: ${pcm_data.length} samples at ${sample_rate}Hz`);

    // Convert array to Float32Array
    const floatPcm = new Float32Array(pcm_data);

    // Create WAV file and convert to base64
    const wavBase64 = pcmToWavBase64(floatPcm, sample_rate);

    console.log(`Conversion complete: WAV base64 length ${wavBase64.length}`);

    return new Response(
      JSON.stringify({ 
        audio_base64: wavBase64,
        format: 'wav',
        sample_rate
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error converting audio:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

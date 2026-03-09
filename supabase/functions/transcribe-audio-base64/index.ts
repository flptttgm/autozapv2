import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64, mimeType = 'audio/webm' } = await req.json();

    console.log(`[transcribe-audio-base64] Starting transcription...`);

    if (!audioBase64) {
      throw new Error('audioBase64 is required');
    }

    // Clean MIME type - remove codecs parameter (e.g., "audio/webm;codecs=opus" -> "audio/webm")
    const cleanMimeType = mimeType.split(';')[0].trim();

    console.log(`[transcribe-audio-base64] Original MIME type: ${mimeType}`);
    console.log(`[transcribe-audio-base64] Clean MIME type: ${cleanMimeType}`);
    console.log(`[transcribe-audio-base64] Base64 length: ${audioBase64.length}`);

    const aiApiKey = Deno.env.get('AI_API_KEY');
    if (!aiApiKey) {
      throw new Error('AI_API_KEY is not configured');
    }

    // Validate base64 - remove any data URL prefix if present
    let cleanBase64 = audioBase64;
    if (audioBase64.includes(',')) {
      cleanBase64 = audioBase64.split(',')[1];
    }

    // Validate base64 format
    if (!cleanBase64 || cleanBase64.trim().length === 0) {
      throw new Error('Empty base64 audio data');
    }

    console.log(`[transcribe-audio-base64] Sending to OpenAI Whisper API for transcription...`);

    // Add padding to base64 if needed
    let paddedBase64 = cleanBase64;
    while (paddedBase64.length % 4 !== 0) {
      paddedBase64 += '=';
    }

    const binaryString = atob(paddedBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: cleanMimeType });

    const formData = new FormData();
    formData.append("file", blob, "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${aiApiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[transcribe-audio-base64] OpenAI API error:', response.status, errorText);

      if (response.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente.');
      }
      throw new Error(`OpenAI API erro: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const transcription = data.text?.trim() || '';

    console.log(`[transcribe-audio-base64] Transcription result: "${transcription.substring(0, 100)}..."`);

    return new Response(JSON.stringify({
      success: true,
      transcription
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[transcribe-audio-base64] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

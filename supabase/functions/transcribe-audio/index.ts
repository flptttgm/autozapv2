import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioUrl, audioBase64, mimeType: inputMimeType, messageId } = await req.json();

    console.log(`[transcribe-audio] Starting transcription for message: ${messageId}`);

    // Use ElevenLabs API key
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    let audioBytes: Uint8Array;
    let mimeType = (inputMimeType || 'audio/ogg').split(';')[0].trim();

    if (audioBase64) {
      // ── PREFERRED: Base64 audio passed directly from webhook ──
      console.log(`[transcribe-audio] Using pre-downloaded audio (base64 len: ${audioBase64.length})`);

      // Clean base64 — remove data URL prefix if present
      let cleanBase64 = audioBase64;
      if (audioBase64.includes(',')) {
        cleanBase64 = audioBase64.split(',')[1];
      }

      // Add padding if needed
      while (cleanBase64.length % 4 !== 0) {
        cleanBase64 += '=';
      }

      const binaryString = atob(cleanBase64);
      audioBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        audioBytes[i] = binaryString.charCodeAt(i);
      }
    } else if (audioUrl) {
      // ── FALLBACK: Download from URL ──
      console.log(`[transcribe-audio] Downloading audio from URL: ${audioUrl}`);

      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      audioBytes = new Uint8Array(audioBuffer);

      // Detect MIME type from response headers
      const contentType = audioResponse.headers.get('content-type') || '';
      if (contentType.includes('audio/')) {
        mimeType = contentType.split(';')[0].trim();
      }

      console.log(`[transcribe-audio] Audio downloaded, size: ${audioBytes.length} bytes`);
    } else {
      throw new Error('Either audioBase64 or audioUrl is required');
    }

    console.log(`[transcribe-audio] MIME type: ${mimeType}, Audio size: ${audioBytes.length} bytes`);

    // Determine file extension for the blob filename
    const extMap: Record<string, string> = {
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'audio/m4a': 'm4a',
      'audio/aac': 'aac',
      'audio/mp4': 'm4a',
    };
    const ext = extMap[mimeType] || 'ogg';

    // ── Use ElevenLabs Speech-to-Text (Scribe) ──
    console.log(`[transcribe-audio] Sending to ElevenLabs STT (scribe_v1)...`);

    const blob = new Blob([audioBytes], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model_id', 'scribe_v1');
    formData.append('language_code', 'por');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[transcribe-audio] ElevenLabs STT error:', response.status, errorText);

      if (response.status === 429) {
        throw new Error('Rate limit exceeded, please try again later');
      }
      throw new Error(`ElevenLabs STT error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const transcription = data.text?.trim() || '';

    console.log(`[transcribe-audio] Transcription result: "${transcription.substring(0, 100)}..."`);

    // Update the message with transcription if messageId provided
    if (messageId && transcription) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get current message metadata then merge transcription
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('metadata')
        .eq('id', messageId)
        .single();

      if (fetchError) {
        console.error('[transcribe-audio] Error fetching message:', fetchError);
      } else {
        const currentMetadata = (message?.metadata as Record<string, any>) || {};

        const { error: updateError } = await supabase
          .from('messages')
          .update({
            metadata: {
              ...currentMetadata,
              transcription,
              transcribed_at: new Date().toISOString()
            }
          })
          .eq('id', messageId);

        if (updateError) {
          console.error('[transcribe-audio] Error updating message:', updateError);
        } else {
          console.log(`[transcribe-audio] Message ${messageId} updated with transcription`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      transcription,
      messageId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[transcribe-audio] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

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
    const { audioUrl, messageId } = await req.json();

    console.log(`[transcribe-audio] Starting transcription for message: ${messageId}`);
    console.log(`[transcribe-audio] Audio URL: ${audioUrl}`);

    if (!audioUrl) {
      throw new Error('audioUrl is required');
    }

    // Use AI_API_KEY (Gemini) or GOOGLE_API_KEY as fallback
    const API_KEY = Deno.env.get('AI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
    if (!API_KEY) {
      throw new Error('AI_API_KEY or GOOGLE_API_KEY is not configured');
    }

    // Download the audio file
    console.log('[transcribe-audio] Downloading audio file...');
    const audioResponse = await fetch(audioUrl);

    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    // Convert to base64
    let binaryString = '';
    for (let i = 0; i < audioBytes.length; i++) {
      binaryString += String.fromCharCode(audioBytes[i]);
    }
    const base64Audio = btoa(binaryString);

    console.log(`[transcribe-audio] Audio downloaded, size: ${audioBytes.length} bytes`);

    // Detect MIME type from URL or content type
    const contentType = audioResponse.headers.get('content-type') || '';
    let mimeType = 'audio/ogg';
    if (contentType.includes('audio/')) {
      mimeType = contentType.split(';')[0].trim();
    } else if (audioUrl.includes('.mp3')) mimeType = 'audio/mp3';
    else if (audioUrl.includes('.wav')) mimeType = 'audio/wav';
    else if (audioUrl.includes('.m4a')) mimeType = 'audio/m4a';
    else if (audioUrl.includes('.aac')) mimeType = 'audio/aac';
    else if (audioUrl.includes('.webm')) mimeType = 'audio/webm';

    console.log(`[transcribe-audio] MIME type: ${mimeType}, Base64 length: ${base64Audio.length}`);

    // Use Gemini API directly for transcription
    const model = Deno.env.get('AI_MODEL') || 'gemini-2.0-flash';
    console.log(`[transcribe-audio] Sending to Gemini (${model}) for transcription...`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem explicações, sem aspas, sem formatação extra. Se não conseguir entender alguma parte, use [inaudível]."
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Audio
                  }
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.1
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[transcribe-audio] Gemini API error:', response.status, errorText);

      if (response.status === 429) {
        throw new Error('Rate limit exceeded, please try again later');
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

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

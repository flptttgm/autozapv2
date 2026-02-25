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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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

    // Build the Data URL for Gemini
    const dataUrl = `data:${cleanMimeType};base64,${cleanBase64}`;
    
    console.log(`[transcribe-audio-base64] Data URL prefix: data:${cleanMimeType};base64,[${cleanBase64.substring(0, 50)}...]`);
    console.log(`[transcribe-audio-base64] Sending to Gemini for transcription...`);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem explicações, sem aspas, sem formatação extra. Se não conseguir entender alguma parte, use [inaudível]."
              },
              {
                type: "file",
                file: {
                  file_data: dataUrl
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[transcribe-audio-base64] Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded, please try again later');
      }
      if (response.status === 402) {
        throw new Error('Insufficient credits for transcription');
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const transcription = data.choices?.[0]?.message?.content?.trim() || '';
    
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

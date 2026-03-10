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
        const { text, lead_id, chat_id, instance_id } = await req.json();

        console.log(`[text-to-audio] Starting TTS for lead: ${lead_id}, text length: ${text?.length || 0}`);

        if (!text || !lead_id) {
            throw new Error('text and lead_id are required');
        }

        // ── ElevenLabs TTS Config ──
        const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
        if (!ELEVENLABS_API_KEY) {
            throw new Error('ELEVENLABS_API_KEY is not configured');
        }

        // Voice ID — configurable via env var, defaults to "Sarah" (multilingual)
        const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID') || 'EXAVITQu4vr4xnSDxMaL';
        const modelId = 'eleven_multilingual_v2';

        // Clean text for TTS — remove WhatsApp formatting
        const cleanText = text
            .replace(/\*([^*]+)\*/g, '$1')  // Remove *bold*
            .replace(/_([^_]+)_/g, '$1')    // Remove _italic_
            .replace(/~([^~]+)~/g, '$1')    // Remove ~strikethrough~
            .replace(/```[^`]*```/g, '')    // Remove code blocks
            .replace(/`([^`]+)`/g, '$1')    // Remove inline code
            .trim();

        if (!cleanText) {
            return new Response(JSON.stringify({ success: false, reason: 'empty_text_after_cleaning' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Limit text length for TTS (avoid huge audio files)
        const maxChars = 1000;
        const ttsText = cleanText.length > maxChars ? cleanText.substring(0, maxChars) + '...' : cleanText;

        console.log(`[text-to-audio] Sending to ElevenLabs TTS (voice: ${voiceId}, model: ${modelId})...`);

        // ── Call ElevenLabs TTS API ──
        const ttsResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: ttsText,
                    model_id: modelId,
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.0,
                        use_speaker_boost: true,
                    },
                }),
            }
        );

        if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            console.error('[text-to-audio] ElevenLabs TTS error:', ttsResponse.status, errorText);
            throw new Error(`ElevenLabs TTS error: ${ttsResponse.status}`);
        }

        // Response is raw audio bytes (mp3)
        const audioBuffer = await ttsResponse.arrayBuffer();
        const audioBytes = new Uint8Array(audioBuffer);

        console.log(`[text-to-audio] Audio generated, size: ${audioBytes.length} bytes`);

        // Convert to base64 with data URI prefix for Z-API
        let binaryString = '';
        for (let i = 0; i < audioBytes.length; i++) {
            binaryString += String.fromCharCode(audioBytes[i]);
        }
        const base64Audio = btoa(binaryString);
        const audioDataUri = `data:audio/mpeg;base64,${base64Audio}`;

        // ── Supabase client ──
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: lead } = await supabase
            .from('leads')
            .select('phone, workspace_id')
            .eq('id', lead_id)
            .single();

        if (!lead?.phone) {
            throw new Error('Lead phone not found');
        }

        // ── Upload MP3 to Supabase Storage for UI playback ──
        const storagePath = `tts/${lead.workspace_id}/${lead_id}/${Date.now()}.mp3`;
        let mediaUrl = '';

        try {
            console.log(`[text-to-audio] Uploading to Storage: ${storagePath}`);
            const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });

            const { error: uploadError } = await supabase.storage
                .from('whatsapp-audio')
                .upload(storagePath, audioBlob, {
                    contentType: 'audio/mpeg',
                    upsert: false,
                });

            if (uploadError) {
                console.error('[text-to-audio] Storage upload error:', uploadError.message);
            } else {
                // Generate signed URL for immediate playback (30 min)
                const { data: signedData } = await supabase.storage
                    .from('whatsapp-audio')
                    .createSignedUrl(storagePath, 60 * 30);
                mediaUrl = signedData?.signedUrl || '';
                console.log(`[text-to-audio] Uploaded & signed URL ready`);
            }
        } catch (storageErr: any) {
            console.error('[text-to-audio] Storage upload crashed (non-blocking):', storageErr.message);
        }

        // ── Get Z-API credentials to send audio ──
        let instanceId = instance_id;
        let instanceToken: string | null = null;
        let clientToken: string | null = null;

        if (instanceId) {
            const { data: inst } = await supabase
                .from('whatsapp_instances')
                .select('instance_id, instance_token')
                .eq('instance_id', instanceId)
                .eq('workspace_id', lead.workspace_id)
                .maybeSingle();

            if (inst) {
                instanceToken = inst.instance_token;
                clientToken = Deno.env.get('ZAPI_USER_TOKEN') || null;
            }
        }

        // Fallback: get any connected instance
        if (!instanceToken) {
            const { data: inst } = await supabase
                .from('whatsapp_instances')
                .select('instance_id, instance_token')
                .eq('workspace_id', lead.workspace_id)
                .eq('status', 'connected')
                .limit(1)
                .maybeSingle();

            if (inst) {
                instanceId = inst.instance_id;
                instanceToken = inst.instance_token;
                clientToken = Deno.env.get('ZAPI_USER_TOKEN') || null;
            }
        }

        if (!instanceId || !instanceToken || !clientToken) {
            throw new Error('Z-API credentials not found');
        }

        // ── Send audio via Z-API ──
        console.log(`[text-to-audio] Sending audio via Z-API to ${lead.phone}...`);

        const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-audio`;
        const zapiResponse = await fetch(zapiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'client-token': clientToken,
            },
            body: JSON.stringify({
                phone: lead.phone,
                audio: audioDataUri,
            }),
        });

        let zapiMessageId: string | null = null;
        try {
            const zapiResult = await zapiResponse.clone().json();
            zapiMessageId = zapiResult.messageId || zapiResult.zapiMessageId || zapiResult.id || null;
            console.log('[text-to-audio] Z-API response messageId:', zapiMessageId);
        } catch (e) {
            console.log('[text-to-audio] Could not parse Z-API response');
        }

        if (!zapiResponse.ok) {
            const errorText = await zapiResponse.text();
            console.error('[text-to-audio] Z-API error:', zapiResponse.status, errorText);
            throw new Error(`Z-API send-audio error: ${zapiResponse.status}`);
        }

        // ── Save outbound audio message to database ──
        const estimatedDuration = Math.ceil(ttsText.length / 15);
        const { error: insertError } = await supabase
            .from('messages')
            .insert({
                chat_id,
                lead_id,
                content: '[Áudio 🎤]',
                direction: 'outbound',
                message_type: 'audio',
                workspace_id: lead.workspace_id,
                zapi_message_id: zapiMessageId,
                delivery_status: zapiMessageId ? 'sent' : 'pending',
                metadata: {
                    instanceId,
                    mediaUrl,
                    audioStoragePath: storagePath,
                    tts_source: 'elevenlabs',
                    tts_voice: voiceId,
                    tts_text: ttsText.substring(0, 200),
                    transcription: ttsText,
                    duration: estimatedDuration,
                },
            });

        if (insertError) {
            console.error('[text-to-audio] Error saving message:', insertError);
        }

        console.log(`[text-to-audio] ✅ Audio sent and saved successfully`);

        return new Response(JSON.stringify({
            success: true,
            messageId: zapiMessageId,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('[text-to-audio] Error:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

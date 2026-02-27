// ============================================
// Z-API Webhook Lite (Ingress)
// ============================================

import { serve } from "std/http/server.ts";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


serve(async (req: Request) => {
  // CORS & Warmup
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.headers.get('x-warmup') === 'true') return new Response('warmup', { status: 200 });

  try {
    const rawBody = await req.text();
    if (!rawBody) return new Response('OK', { headers: corsHeaders });

    const payload = JSON.parse(rawBody);

    // Log payload for debug
    console.log('[zapi-webhook] Payload type:', payload.type);

    // DEBUG: Log to DB
    const supabaseDebug = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await supabaseDebug.from('debug_logs').insert({ data: payload });

    // Only process ReceivedCallback (User Messages)
    if (payload.type === 'ReceivedCallback' && !payload.fromMe) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      let phone = payload.phone;
      const messageId = payload.messageId;
      const instanceId = payload.instanceId;

      // Detect message type and extract content accordingly
      let content = '';
      let messageType = 'text';

      if (payload.text?.message) {
        content = payload.text.message;
        messageType = 'text';
      } else if (payload.image) {
        content = payload.image.caption || '[Imagem 📷]';
        messageType = 'image';
      } else if (payload.audio) {
        content = '[Áudio 🎤]';
        messageType = 'audio';
      } else if (payload.video) {
        content = payload.video.caption || '[Vídeo 🎬]';
        messageType = 'video';
      } else if (payload.document) {
        content = payload.document.fileName || '[Documento 📄]';
        messageType = 'document';
      } else if (payload.sticker) {
        content = '[Figurinha]';
        messageType = 'sticker';
      } else if (payload.contact) {
        content = '[Contato]';
        messageType = 'contact';
      } else if (payload.location) {
        content = '[Localização 📍]';
        messageType = 'location';
      } else {
        content = payload.body || payload.caption || '';
      }

      if (!phone || !instanceId) {
        console.log('[zapi-webhook] Skipped: missing phone/instanceId');
        return new Response(JSON.stringify({ ignored: true }), { headers: corsHeaders });
      }

      // 0a. Normalize phone number — ensure country code 55 prefix
      // Z-API may send phone with or without country code; leads may be stored either way
      if (phone && !phone.includes('@')) {
        const digitsOnly = phone.replace(/\D/g, '');
        // Brazilian numbers: if it doesn't start with 55, add it
        if (!digitsOnly.startsWith('55')) {
          phone = '55' + digitsOnly;
          console.log(`[zapi-webhook] 📞 Normalized phone: ${payload.phone} → ${phone}`);
        } else {
          phone = digitsOnly;
        }
      }

      // 0b. Message Deduplication (Z-API sends duplicate webhooks ~10s apart)
      if (messageId) {
        const { data: existingMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('zapi_message_id', messageId)
          .limit(1);

        if (existingMsg && existingMsg.length > 0) {
          console.log('[zapi-webhook] ⏭️ Duplicate messageId, skipping:', messageId);
          return new Response(JSON.stringify({ status: 'skipped', reason: 'duplicate_message' }), { headers: corsHeaders });
        }
      }

      // 0c. Cross-Instance Anti-Echo Protection
      // Check if this exact message was sent by US (outbound) in the last 10 seconds
      const { data: recentOutbound, error: echoError } = await supabase
        .from('messages')
        .select('id')
        .eq('direction', 'outbound')
        .eq('content', content)
        .gt('created_at', new Date(Date.now() - 10000).toISOString())
        .limit(1);

      if (recentOutbound && recentOutbound.length > 0) {
        console.log('[zapi-webhook] 🛡️ Anti-Echo: Message blocked to prevent loop');
        await supabaseDebug.from('debug_logs').insert({ data: { step: 'anti_echo_blocked', content } });
        return new Response(JSON.stringify({ status: 'blocked', reason: 'anti_echo' }), { headers: corsHeaders });
      }

      // 1. Resolve Workspace from Instance (also fetch token and buffer config)
      const { data: instance, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('workspace_id, instance_token, message_buffer_seconds, ai_mode')
        .eq('instance_id', instanceId)
        .maybeSingle();

      if (instanceError) await supabaseDebug.from('debug_logs').insert({ data: { error: 'instance_query_error', details: instanceError } });

      if (!instance) {
        await supabaseDebug.from('debug_logs').insert({ data: { error: 'unknown_instance', instanceId } });
        console.error('[zapi-webhook] Unknown instance:', instanceId);
        return new Response(JSON.stringify({ error: 'unknown_instance' }), { headers: corsHeaders });
      }

      const workspaceId = instance.workspace_id;
      await supabaseDebug.from('debug_logs').insert({ data: { step: 'workspace_resolved', workspaceId } });

      // 1b. Resolve @lid to real phone number (View-Once media bug)
      if (phone && phone.includes('@lid')) {
        console.log(`[zapi-webhook] Received @lid phone: ${phone}, attempting to resolve to actual phone number`);
        const { data: lidMatch } = await supabase
          .from('messages')
          .select('chat_id')
          .eq('workspace_id', workspaceId)
          .not('chat_id', 'like', '%@lid%')
          .contains('metadata', { zapi_payload: { chatLid: phone } })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lidMatch && lidMatch.chat_id) {
          console.log(`[zapi-webhook] Successfully resolved @lid ${phone} to real phone ${lidMatch.chat_id}`);
          phone = lidMatch.chat_id;
        } else {
          console.log(`[zapi-webhook] Could not resolve @lid ${phone}, proceeding with @lid`);
        }
      }

      // 2. Find or Create Lead
      console.log('[zapi-webhook] Processing lead for phone:', phone);

      // Try to find lead with normalized phone first, then try without country code
      let existingLead = null;
      const { data: leadByFullPhone } = await supabase
        .from('leads')
        .select('id, name, avatar_url')
        .eq('workspace_id', workspaceId)
        .eq('phone', phone)
        .maybeSingle();

      existingLead = leadByFullPhone;

      // If not found, try without country code (e.g., lead was saved as "17997451788" instead of "5517997451788")
      if (!existingLead && phone.startsWith('55') && phone.length > 2) {
        const phoneWithoutCountry = phone.substring(2);
        const { data: leadByShortPhone } = await supabase
          .from('leads')
          .select('id, name, avatar_url')
          .eq('workspace_id', workspaceId)
          .eq('phone', phoneWithoutCountry)
          .maybeSingle();

        if (leadByShortPhone) {
          console.log(`[zapi-webhook] 📞 Found lead with short phone ${phoneWithoutCountry}, updating to ${phone}`);
          // Update the lead's phone to include country code for consistency
          await supabase
            .from('leads')
            .update({ phone: phone })
            .eq('id', leadByShortPhone.id);
          existingLead = leadByShortPhone;
        }
      }

      const isNewLead = !existingLead;

      const leadName = payload.isGroup
        ? (payload.chatName || 'Grupo')
        : (payload.senderName || payload.chatName || payload.pushName || 'Novo Cliente');

      let lead;
      let leadError;

      if (existingLead) {
        // Lead already exists — don't overwrite the name (user may have set a custom name)
        lead = existingLead;
        leadError = null;
      } else {
        // Create new lead
        const { data: newLead, error: newLeadError } = await supabase
          .from('leads')
          .insert({
            workspace_id: workspaceId,
            phone: phone,
            name: leadName,
          })
          .select('id, name, avatar_url')
          .single();
        lead = newLead;
        leadError = newLeadError;
      }

      if (leadError || !lead) {
        await supabaseDebug.from('debug_logs').insert({ data: { error: 'lead_upsert_error', details: leadError } });
        throw leadError || new Error('Failed to find or create lead');
      }

      // New leads in selective mode start with AI disabled (won't auto-respond)
      if (isNewLead && instance.ai_mode === 'selective') {
        await supabase
          .from('leads')
          .update({ ai_enabled: false })
          .eq('id', lead.id);
        console.log('[zapi-webhook] 🔇 New lead in selective mode → ai_enabled = false');
      }

      await supabaseDebug.from('debug_logs').insert({ data: { step: 'lead_processed', leadId: lead.id } });

      // 2b. Save/Update contact profile picture from Z-API payload
      const contactPhoto = payload.photo || payload.imgUrl || null;
      if (contactPhoto && contactPhoto !== lead.avatar_url) {
        await supabase
          .from('leads')
          .update({ avatar_url: contactPhoto })
          .eq('id', lead.id);
        console.log('[zapi-webhook] Profile picture updated for lead:', lead.id);
      }

      // 3. Insert Inbound Message
      console.log('[zapi-webhook] Inserting inbound message');

      // Build rich metadata with top-level media fields for UI components
      const msgMetadata: Record<string, any> = {
        zapi_payload: payload,
        senderName: payload.senderName || payload.chatName || '',
      };

      // Extract media URL and metadata for the UI player/viewer components
      if (payload.audio) {
        msgMetadata.mediaUrl = payload.audio.audioUrl || '';
        msgMetadata.duration = payload.audio.seconds || 0;
        msgMetadata.mimeType = payload.audio.mimeType || 'audio/ogg';
      } else if (payload.image) {
        msgMetadata.mediaUrl = payload.image.imageUrl || '';
        msgMetadata.mimeType = payload.image.mimeType || 'image/jpeg';
      } else if (payload.video) {
        msgMetadata.mediaUrl = payload.video.videoUrl || '';
        msgMetadata.duration = payload.video.seconds || 0;
        msgMetadata.mimeType = payload.video.mimeType || 'video/mp4';
      } else if (payload.document) {
        msgMetadata.mediaUrl = payload.document.documentUrl || '';
        msgMetadata.fileName = payload.document.fileName || '';
        msgMetadata.mimeType = payload.document.mimeType || '';
      }

      const { data: insertedMsg, error: msgError } = await supabase.from('messages').insert({
        workspace_id: workspaceId,
        lead_id: lead.id,
        chat_id: phone,
        content: content,
        direction: 'inbound',
        message_type: messageType,
        zapi_message_id: messageId,
        metadata: msgMetadata
      }).select('id').single();

      if (msgError) {
        await supabaseDebug.from('debug_logs').insert({ data: { error: 'msg_insert_error', details: msgError } });
        console.error('[zapi-webhook] Msg insert error:', msgError);
      } else {
        await supabaseDebug.from('debug_logs').insert({ data: { step: 'msg_inserted', id: insertedMsg?.id } });
      }

      // 3b. Transcribe audio messages
      let audioTranscription = '';
      if (messageType === 'audio' && msgMetadata.mediaUrl && insertedMsg?.id) {
        console.log('[zapi-webhook] 🎤 Invoking audio transcription...');
        try {
          const { data: transcribeResult, error: transcribeError } = await supabase.functions.invoke('transcribe-audio', {
            body: { audioUrl: msgMetadata.mediaUrl, messageId: insertedMsg.id }
          });

          if (transcribeError) {
            console.error('[zapi-webhook] Transcription invoke error:', transcribeError);
          } else if (transcribeResult?.transcription) {
            audioTranscription = transcribeResult.transcription;
            // Use the transcription as the content for AI processing
            content = `[Transcrição de Áudio]: "${audioTranscription}"`;
            console.log(`[zapi-webhook] ✅ Audio transcribed: "${audioTranscription.substring(0, 80)}..."`);
          }
        } catch (tErr: any) {
          console.error('[zapi-webhook] Transcription error:', tErr.message);
        }
      }

      // 4. Trigger AI Process (with optional message buffer)
      const bufferSeconds = instance.message_buffer_seconds || 0;

      if (bufferSeconds > 0) {
        // === BUFFERED MODE ===
        console.log(`[zapi-webhook] Buffer mode: ${bufferSeconds}s for chat ${phone}`);

        // Insert into message_buffer
        const { data: bufferEntry, error: bufferError } = await supabase.from('message_buffer').insert({
          workspace_id: workspaceId,
          chat_id: phone,
          lead_id: lead.id,
          instance_id: instanceId,
          content: content,
          is_group: payload.isGroup || false,
          is_processed: false,
          expires_at: new Date(Date.now() + bufferSeconds * 1000).toISOString(),
        }).select('id, created_at').single();

        if (bufferError) {
          console.error('[zapi-webhook] Buffer insert error:', bufferError);
          // Fallback: process immediately without buffer
          console.log('[zapi-webhook] Invoking process-message (buffer fallback)');
          await supabase.functions.invoke('process-message', {
            body: { chat_id: phone, lead_id: lead.id, message_content: content, is_group: payload.isGroup || false, instance_id: instanceId }
          });
        } else {
          // Wait for the buffer duration
          await new Promise(resolve => setTimeout(resolve, bufferSeconds * 1000));

          // Check if a newer unprocessed message exists for this chat
          const { data: newerMessages } = await supabase
            .from('message_buffer')
            .select('id')
            .eq('chat_id', phone)
            .eq('is_processed', false)
            .gt('created_at', bufferEntry.created_at)
            .limit(1);

          if (newerMessages && newerMessages.length > 0) {
            // A newer message arrived during the wait — skip, the newer call will handle it
            console.log('[zapi-webhook] ⏭️ Newer message exists, skipping (will be handled by newer call)');
          } else {
            // This is the latest message — collect all unprocessed messages and process them
            const { data: bufferedMessages } = await supabase
              .from('message_buffer')
              .select('id, content')
              .eq('chat_id', phone)
              .eq('is_processed', false)
              .order('created_at', { ascending: true });

            if (bufferedMessages && bufferedMessages.length > 0) {
              // Combine all buffered messages
              const combinedContent = bufferedMessages.map(m => m.content).join('\n');
              const bufferIds = bufferedMessages.map(m => m.id);

              // Mark as processed
              await supabase
                .from('message_buffer')
                .update({ is_processed: true, processed_at: new Date().toISOString() })
                .in('id', bufferIds);

              console.log(`[zapi-webhook] 📦 Processing ${bufferedMessages.length} buffered messages`);
              const { error: invokeError } = await supabase.functions.invoke('process-message', {
                body: {
                  chat_id: phone,
                  lead_id: lead.id,
                  message_content: combinedContent,
                  is_group: payload.isGroup || false,
                  instance_id: instanceId
                }
              });

              if (invokeError) {
                await supabaseDebug.from('debug_logs').insert({ data: { error: 'invoke_error_buffered', details: invokeError } });
              } else {
                await supabaseDebug.from('debug_logs').insert({ data: { step: 'process_invoked_buffered', count: bufferedMessages.length } });
              }
            }
          }
        }
      } else {
        // === IMMEDIATE MODE (no buffer) ===
        console.log('[zapi-webhook] Invoking process-message');
        const { error: invokeError } = await supabase.functions.invoke('process-message', {
          body: {
            chat_id: phone,
            lead_id: lead.id,
            message_content: content,
            audio_transcription: audioTranscription || undefined,
            is_group: payload.isGroup || false,
            instance_id: instanceId
          }
        });

        if (invokeError) {
          await supabaseDebug.from('debug_logs').insert({ data: { error: 'invoke_error', details: invokeError } });
        } else {
          await supabaseDebug.from('debug_logs').insert({ data: { step: 'process_invoked' } });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle MessageStatusCallback — Update delivery status (sent/received/read/played)
    // Handle MessageStatusCallback — Update delivery status (sent/received/read/played)
    if (payload.type === 'MessageStatusCallback' && payload.ids && Array.isArray(payload.ids)) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Map Z-API status to internal delivery_status
      const statusMap: Record<string, string> = {
        'SENT': 'sent',
        'RECEIVED': 'received',
        'READ': 'read',
        'READ_BY_ME': 'read',
        'PLAYED': 'played',
      };

      const zapiStatus = payload.status?.toUpperCase?.() || '';
      const deliveryStatus = statusMap[zapiStatus];

      if (deliveryStatus) {
        // Only update forward (don't downgrade read→received)
        const statusPriority: Record<string, number> = {
          'pending': 0,
          'sent': 1,
          'received': 2,
          'read': 3,
          'played': 4,
        };

        for (const messageId of payload.ids) {
          // Find message by zapi_message_id
          const { data: existingMsg } = await supabase
            .from('messages')
            .select('id, delivery_status')
            .eq('zapi_message_id', messageId)
            .limit(1)
            .maybeSingle();

          if (existingMsg) {
            const currentPriority = statusPriority[existingMsg.delivery_status || 'pending'] || 0;
            const newPriority = statusPriority[deliveryStatus] || 0;

            if (newPriority > currentPriority) {
              await supabase
                .from('messages')
                .update({ delivery_status: deliveryStatus })
                .eq('id', existingMsg.id);

              console.log(`[zapi-webhook] ✅ Status updated: ${existingMsg.delivery_status || 'pending'} → ${deliveryStatus} for msg ${messageId}`);
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true, status_updated: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Default response for other events (ack, presence, etc)
    return new Response(JSON.stringify({ success: true, ignored: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[zapi-webhook] Critical Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

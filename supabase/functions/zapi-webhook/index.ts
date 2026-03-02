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

    // Skip status@broadcast messages (WhatsApp status updates — not real conversations)
    if (payload.phone?.includes('broadcast') || payload.chatId?.includes('broadcast')) {
      return new Response(JSON.stringify({ ignored: true, reason: 'broadcast' }), { headers: corsHeaders });
    }

    // Skip waitingMessage notifications ("waiting for this message", view-once placeholders)
    if (payload.waitingMessage) {
      console.log('[zapi-webhook] Skipping waitingMessage');
      return new Response(JSON.stringify({ ignored: true, reason: 'waiting_message' }), { headers: corsHeaders });
    }

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
      } else if (payload.listMessage) {
        // Interactive list message (buttons menu)
        content = payload.listMessage.description || payload.listMessage.title || payload.listMessage.buttonText || '[Lista Interativa]';
        messageType = 'text';
      } else if (payload.listResponseMessage) {
        // User selected an option from a list
        content = payload.listResponseMessage.title || payload.listResponseMessage.description || '[Resposta de Lista]';
        messageType = 'text';
      } else if (payload.buttonsMessage) {
        // Message with interactive buttons
        content = payload.buttonsMessage.message || payload.buttonsMessage.title || '[Mensagem com Botões]';
        messageType = 'text';
      } else if (payload.buttonsResponseMessage) {
        // User clicked a button
        content = payload.buttonsResponseMessage.selectedDisplayText || payload.buttonsResponseMessage.selectedButtonId || '[Botão]';
        messageType = 'text';
      } else if (payload.templateMessage) {
        // Template message (e.g., HSM)
        content = payload.templateMessage.hydratedTemplate?.hydratedContentText || '[Mensagem de Template]';
        messageType = 'text';
      } else if (payload.reaction) {
        // Z-API reaction format - skip reactions as they don't add conversation value
        console.log('[Webhook] Skipping reaction message:', payload.reaction?.value);
        return new Response(JSON.stringify({ ok: true, skipped: 'reaction' }), { status: 200, headers: corsHeaders });
      } else if (payload.reactionMessage) {
        content = payload.reactionMessage.text || '[Reação]';
        messageType = 'reaction';
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
          console.log(`[zapi-webhook] Could not resolve @lid ${phone}, skipping message to avoid ghost contact`);
          return new Response(JSON.stringify({ ignored: true, reason: 'unresolvable_lid' }), { headers: corsHeaders });
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
        const hasRealName = leadName !== 'Novo Cliente' && leadName !== 'Grupo';
        const { data: newLead, error: newLeadError } = await supabase
          .from('leads')
          .insert({
            workspace_id: workspaceId,
            phone: phone,
            name: leadName,
            metadata: hasRealName ? { name_identified_at: new Date().toISOString() } : {},
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

      // 4. Anti-Loop Detection — Prevent infinite bot-to-bot conversations
      const { data: recentMsgs } = await supabase
        .from('messages')
        .select('content, direction, created_at')
        .eq('chat_id', phone)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(8);

      let shouldSkipAI = false;

      if (recentMsgs && recentMsgs.length >= 4) {
        const msgs = recentMsgs.reverse(); // oldest first

        // Helper: check if a message is "short" (emoji-only, single word, < 10 chars)
        const isShort = (text: string) => {
          if (!text) return true;
          const trimmed = text.trim();
          // Pure emoji (including combined emoji)
          const emojiOnly = /^[\p{Emoji}\s]+$/u.test(trimmed);
          if (emojiOnly) return true;
          // Very short text
          if (trimmed.length < 10) return true;
          return false;
        };

        // Helper: check if a message looks like a farewell
        const isFarewell = (text: string) => {
          if (!text) return false;
          const lower = text.toLowerCase().trim();
          const farewellPatterns = [
            'até mais', 'ate mais', 'tchau', 'até logo', 'ate logo',
            'até!', 'ate!', 'até', 'flw', 'falou', 'bye', 'valeu',
            'obrigado!', 'obrigada!', 'abraço', 'abraços', 'adeus'
          ];
          return farewellPatterns.some(p => lower.includes(p));
        };

        // Check 1: Farewell loop — if both sides said goodbye, stop responding
        const last6 = msgs.slice(-6);
        const outboundFarewells = last6.filter(m =>
          (m.direction === 'outbound') && isFarewell(m.content)
        );
        const inboundFarewells = last6.filter(m =>
          m.direction === 'inbound' && isFarewell(m.content)
        );
        if (outboundFarewells.length > 0 && inboundFarewells.length > 0) {
          shouldSkipAI = true;
          console.log('[zapi-webhook] 🛑 Anti-Loop: Farewell detected from both sides, skipping AI');
        }

        // Check 2: Short message ping-pong — if last 4+ messages are all short, stop
        if (!shouldSkipAI) {
          const last4 = msgs.slice(-4);
          const allShort = last4.every(m => isShort(m.content));
          const hasAlternating = last4.some((m, i) =>
            i > 0 && m.direction !== last4[i - 1].direction
          );
          if (allShort && hasAlternating) {
            shouldSkipAI = true;
            console.log('[zapi-webhook] 🛑 Anti-Loop: Short message ping-pong detected, skipping AI');
          }
        }

        // Check 3: Rapid-fire — more than 6 messages in less than 3 minutes between same parties
        if (!shouldSkipAI && recentMsgs.length >= 6) {
          const newest = new Date(recentMsgs[0].created_at).getTime();
          const sixthOldest = new Date(recentMsgs[5].created_at).getTime();
          const spanMs = newest - sixthOldest;
          const allShortRecent = recentMsgs.slice(0, 6).every(m => isShort(m.content));
          if (spanMs < 3 * 60 * 1000 && allShortRecent) {
            shouldSkipAI = true;
            console.log('[zapi-webhook] 🛑 Anti-Loop: Rapid-fire short messages detected, skipping AI');
          }
        }
      }

      if (shouldSkipAI) {
        await supabaseDebug.from('debug_logs').insert({ data: { step: 'anti_loop_skip', chat_id: phone } });
        return new Response(JSON.stringify({ success: true, skipped: 'anti_loop' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 5. Trigger AI Process (with optional message buffer)
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

    // ═══════════════════════════════════════════════════════════════
    // Handle fromMe messages — Messages sent directly from WhatsApp
    // Save as outbound_manual so they appear in Autozap conversations
    // ═══════════════════════════════════════════════════════════════
    if (payload.type === 'ReceivedCallback' && payload.fromMe) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      let phone = payload.phone;
      const messageId = payload.messageId;
      const instanceId = payload.instanceId;
      const chatLid = payload.chatLid || null;

      if (!instanceId) {
        return new Response(JSON.stringify({ ignored: true }), { headers: corsHeaders });
      }

      // Skip reactions from self
      if (payload.reaction) {
        return new Response(JSON.stringify({ ok: true, skipped: 'self_reaction' }), { status: 200, headers: corsHeaders });
      }

      // Deduplication
      if (messageId) {
        const { data: existingMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('zapi_message_id', messageId)
          .limit(1);

        if (existingMsg && existingMsg.length > 0) {
          return new Response(JSON.stringify({ status: 'skipped', reason: 'duplicate_fromMe' }), { headers: corsHeaders });
        }
      }

      // Detect content (same logic as inbound)
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
      } else if (payload.listMessage) {
        content = payload.listMessage.description || payload.listMessage.title || '[Lista Interativa]';
        messageType = 'text';
      } else if (payload.buttonsMessage) {
        content = payload.buttonsMessage.message || '[Mensagem com Botões]';
        messageType = 'text';
      } else {
        content = payload.body || payload.caption || '';
      }

      if (!content) {
        return new Response(JSON.stringify({ ignored: true, reason: 'empty_fromMe' }), { headers: corsHeaders });
      }

      // Resolve workspace
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('workspace_id')
        .eq('instance_id', instanceId)
        .maybeSingle();

      if (!instance) {
        return new Response(JSON.stringify({ error: 'unknown_instance' }), { headers: corsHeaders });
      }

      // ── Resolve the real phone/chat_id and lead ──
      // Z-API sends LID format (e.g. "124176614592651@lid") for fromMe messages
      // instead of the real phone number. We need to resolve this.
      let resolvedChatId: string | null = null;
      let resolvedLeadId: string | null = null;

      const isLidFormat = phone && phone.includes('@lid');

      if (isLidFormat && chatLid) {
        // Strategy 1: Find existing messages in this workspace that have this chatLid in metadata
        const { data: existingMessages } = await supabase
          .from('messages')
          .select('chat_id, lead_id')
          .eq('workspace_id', instance.workspace_id)
          .contains('metadata', { chatLid: chatLid })
          .limit(1);

        if (existingMessages && existingMessages.length > 0) {
          resolvedChatId = existingMessages[0].chat_id;
          resolvedLeadId = existingMessages[0].lead_id;
          console.log('[zapi-webhook] fromMe: resolved LID via metadata chatLid:', chatLid, '→', resolvedChatId);
        }

        // Strategy 2: Search by chatName in leads table
        if (!resolvedChatId && payload.chatName) {
          const { data: leadByName } = await supabase
            .from('leads')
            .select('id, phone')
            .eq('workspace_id', instance.workspace_id)
            .ilike('name', payload.chatName)
            .limit(1);

          if (leadByName && leadByName.length > 0) {
            resolvedChatId = leadByName[0].phone;
            resolvedLeadId = leadByName[0].id;
            console.log('[zapi-webhook] fromMe: resolved LID via chatName:', payload.chatName, '→', resolvedChatId);
          }
        }

        // Strategy 3: Find the most recent inbound message from this workspace that has matching chatLid
        if (!resolvedChatId) {
          const { data: recentInbound } = await supabase
            .from('messages')
            .select('chat_id, lead_id')
            .eq('workspace_id', instance.workspace_id)
            .eq('direction', 'inbound')
            .not('chat_id', 'like', '%@%')
            .order('created_at', { ascending: false })
            .limit(50);

          // Check debug_logs for a recent inbound from same chatLid
          if (recentInbound && recentInbound.length > 0) {
            // Find by checking debug_logs for inbound messages with this chatLid
            const { data: inboundWithLid } = await supabase
              .from('debug_logs')
              .select('data')
              .filter('data->>chatLid', 'eq', chatLid)
              .filter('data->>fromMe', 'eq', 'false')
              .order('created_at', { ascending: false })
              .limit(1);

            if (inboundWithLid && inboundWithLid.length > 0) {
              const inboundPhone = (inboundWithLid[0].data as any)?.phone;
              if (inboundPhone && !inboundPhone.includes('@')) {
                // Found the real phone! Now find the lead
                const { data: leadByPhone } = await supabase
                  .from('leads')
                  .select('id')
                  .eq('workspace_id', instance.workspace_id)
                  .eq('phone', inboundPhone)
                  .maybeSingle();

                if (leadByPhone) {
                  resolvedChatId = inboundPhone;
                  resolvedLeadId = leadByPhone.id;
                  console.log('[zapi-webhook] fromMe: resolved LID via debug_logs:', chatLid, '→', resolvedChatId);
                }
              }
            }
          }
        }

        if (!resolvedChatId) {
          console.log('[zapi-webhook] fromMe: could not resolve LID', chatLid, 'chatName:', payload.chatName);
          return new Response(JSON.stringify({ ignored: true, reason: 'unresolvable_lid' }), { headers: corsHeaders });
        }
      } else {
        // Normal phone format — normalize and find lead
        if (phone && !phone.includes('@')) {
          const digitsOnly = phone.replace(/\D/g, '');
          if (!digitsOnly.startsWith('55')) {
            phone = '55' + digitsOnly;
          } else {
            phone = digitsOnly;
          }
        }

        resolvedChatId = phone;

        // Find lead
        const { data: lead } = await supabase
          .from('leads')
          .select('id')
          .eq('workspace_id', instance.workspace_id)
          .eq('phone', phone)
          .maybeSingle();

        if (lead) {
          resolvedLeadId = lead.id;
        } else {
          // Try without country code
          const phoneShort = phone.startsWith('55') ? phone.substring(2) : phone;
          const { data: leadShort } = await supabase
            .from('leads')
            .select('id')
            .eq('workspace_id', instance.workspace_id)
            .eq('phone', phoneShort)
            .maybeSingle();

          if (leadShort) {
            resolvedLeadId = leadShort.id;
          }
        }

        if (!resolvedLeadId) {
          console.log('[zapi-webhook] fromMe: no matching lead found for', phone);
          return new Response(JSON.stringify({ ignored: true, reason: 'no_lead_for_fromMe' }), { headers: corsHeaders });
        }
      }

      // Save the message as outbound_manual
      const { error: insertError } = await supabase.from('messages').insert({
        workspace_id: instance.workspace_id,
        lead_id: resolvedLeadId,
        chat_id: resolvedChatId,
        content,
        direction: 'outbound_manual',
        message_type: messageType,
        zapi_message_id: messageId,
        metadata: {
          source: 'whatsapp_direct',
          senderName: payload.senderName || '',
          chatLid: chatLid,
        }
      });

      if (insertError) {
        console.error('[zapi-webhook] fromMe: insert error:', insertError);
        return new Response(JSON.stringify({ error: 'insert_failed' }), { status: 500, headers: corsHeaders });
      }

      console.log('[zapi-webhook] ✅ fromMe message saved as outbound_manual:', messageId, 'chat:', resolvedChatId);

      return new Response(JSON.stringify({ success: true, fromMe: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

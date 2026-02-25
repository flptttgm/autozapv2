import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_MESSAGE_LENGTH = 5000;
const TYPING_DELAY_MS = 2000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { chat_id: providedChatId, message, lead_id, is_manual = false, metadata: customMetadata, instance_id: providedInstanceId, delayTyping = 0 } = await req.json();

    if (!lead_id) {
      throw new Error('lead_id is required');
    }

    // IMPORTANT: Use existing chat_id from lead's messages if available
    // This prevents duplicate conversations when WhatsApp uses different chat_id formats
    let chat_id = providedChatId;

    const { data: existingMessage } = await supabase
      .from('messages')
      .select('chat_id')
      .eq('lead_id', lead_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingMessage?.chat_id && existingMessage.chat_id !== providedChatId) {
      console.log(`[send-message] Using existing chat_id: ${existingMessage.chat_id} instead of ${providedChatId}`);
      chat_id = existingMessage.chat_id;
    }

    console.log('Sending message to:', chat_id, 'lead_id:', lead_id, 'instance_id:', providedInstanceId);

    // Get phone number and workspace_id from lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('phone, workspace_id')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead?.phone) {
      throw new Error('Lead phone not found');
    }

    const phone = lead.phone;
    const workspaceId = lead.workspace_id;

    // Get Z-API credentials for this workspace
    let instanceId: string | null = null;
    let instanceToken: string | null = null;
    let clientToken: string | null = null;
    let isPartnersInstance = false;

    // If instance_id is provided, use that specific instance
    if (providedInstanceId) {
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, instance_token, status')
        .eq('instance_id', providedInstanceId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (instance) {
        isPartnersInstance = true;
        instanceId = instance.instance_id;
        instanceToken = instance.instance_token;
        clientToken = Deno.env.get('ZAPI_USER_TOKEN') || null;
        console.log('Using specific instance:', instanceId, 'status:', instance.status);
      }
    }

    // Fallback: try to get any connected instance for this workspace
    if (!instanceId) {
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, instance_token, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle();

      if (instance) {
        isPartnersInstance = true;
        instanceId = instance.instance_id;
        instanceToken = instance.instance_token;
        clientToken = Deno.env.get('ZAPI_USER_TOKEN') || null;
        console.log('Using connected instance for workspace:', instanceId, 'status:', instance.status);
      } else {
        // Legacy mode: requires Client-Token header as well
        instanceId = Deno.env.get('ZAPI_INSTANCE_ID') || null;
        instanceToken = Deno.env.get('ZAPI_INSTANCE_TOKEN') || null;
        clientToken = Deno.env.get('ZAPI_USER_TOKEN') || null;
        console.log('Using legacy Z-API credentials');
      }
    }

    if (!instanceId || !instanceToken) {
      throw new Error('Z-API instance credentials not configured');
    }

    if (!clientToken) {
      throw new Error('Z-API client token not configured');
    }

    // Split long messages
    const messageParts: string[] = [];
    if (message.length > MAX_MESSAGE_LENGTH) {
      let remaining = message;
      while (remaining.length > 0) {
        messageParts.push(remaining.slice(0, MAX_MESSAGE_LENGTH));
        remaining = remaining.slice(MAX_MESSAGE_LENGTH);
      }
    } else {
      messageParts.push(message);
    }

    // Send each part with delay
    for (let i = 0; i < messageParts.length; i++) {
      const part = messageParts[i];

      // Add typing indicator delay
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, TYPING_DELAY_MS));
      }

      // Send via Z-API
      const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'client-token': clientToken,
      };

      const zapiResponse = await fetch(zapiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: phone,
          message: part,
          ...(delayTyping > 0 && { delayTyping: Math.min(Math.max(delayTyping, 1), 15) })
        })
      });

      // Extrair messageId da resposta da Z-API
      let zapiMessageId: string | null = null;
      try {
        const zapiResult = await zapiResponse.clone().json();
        zapiMessageId = zapiResult.messageId || zapiResult.zapiMessageId || zapiResult.id || null;
        console.log('[send-message] Z-API response messageId:', zapiMessageId);
      } catch (e) {
        console.log('[send-message] Could not parse Z-API response for messageId');
      }

      if (!zapiResponse.ok) {
        const errorText = await zapiResponse.text();
        console.error('Z-API error:', zapiResponse.status, errorText);

        // CRITICAL: Detect subscription/expired instance errors
        const errorLower = errorText.toLowerCase();
        const isSubscriptionError =
          errorLower.includes('subscribe') ||
          errorLower.includes('expired') ||
          errorLower.includes('not active') ||
          errorLower.includes('inactive') ||
          errorLower.includes('instance not found') ||
          errorLower.includes('must subscribe');

        if (isSubscriptionError && instanceId) {
          console.error('🚨 CRITICAL: Instance subscription expired!', instanceId);

          // Update instance status to 'expired'
          await supabase
            .from('whatsapp_instances')
            .update({
              status: 'expired',
              subscribed: false,
              updated_at: new Date().toISOString()
            })
            .eq('instance_id', instanceId);

          // Notify all workspace members
          const { data: members } = await supabase
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', workspaceId);

          for (const member of members || []) {
            await supabase
              .from('user_notifications')
              .insert({
                user_id: member.user_id,
                title: '⚠️ WhatsApp Desconectado',
                body: 'Sua conexão WhatsApp expirou. Acesse Conexões e reconecte para continuar usando a automação.',
                url: '/whatsapp',
                type: 'whatsapp_expired'
              });
          }

          // Log to platform_logs for admin visibility
          await supabase
            .from('platform_logs')
            .insert({
              action: 'whatsapp_instance_expired',
              entity_type: 'whatsapp_instance',
              entity_id: instanceId,
              details: {
                workspace_id: workspaceId,
                error: errorText,
                timestamp: new Date().toISOString()
              }
            });

          // Return special error for process-message to handle
          return new Response(JSON.stringify({
            error: 'INSTANCE_SUBSCRIPTION_EXPIRED',
            message: 'WhatsApp instance subscription expired',
            instanceId: instanceId
          }), {
            status: 503, // Service Unavailable - indicates retryable after reconnection
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        throw new Error(`Z-API error: ${zapiResponse.status}`);
      }

      // Save outbound message
      const direction = is_manual === true ? 'outbound_manual' : 'outbound';
      console.log('Saving message with direction:', direction, 'is_manual:', is_manual, 'instanceId:', instanceId);

      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          chat_id,
          lead_id,
          content: part,
          direction: direction,
          message_type: 'text',
          workspace_id: workspaceId,
          zapi_message_id: zapiMessageId,
          delivery_status: zapiMessageId ? 'sent' : 'pending',
          metadata: {
            instanceId: instanceId,
            ...customMetadata
          }
        });

      if (insertError) {
        console.error('Error inserting message to database:', insertError);
        throw insertError;
      }

      console.log(`Sent message part ${i + 1}/${messageParts.length} and saved to database`);
    }

    return new Response(JSON.stringify({ success: true, parts_sent: messageParts.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-message:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

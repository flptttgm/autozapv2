import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Appi Company workspace - hardcoded for security
const APPI_WORKSPACE_ID = '5fa32d2a-d6cf-42de-aa4c-d0964098ac8d';

// Message templates
const MESSAGES = {
  not_connected: (userName: string) => `Oi${userName ? `, ${userName}` : ''}! Sou do time de suporte do {a}AutoZap.

Vi que você criou sua conta há pouco - seja bem-vindo! 🎉

Percebi que você ainda não conectou seu WhatsApp. Posso te ajudar com isso agora?

É bem simples: basta acessar a aba "Conexões" no painel e escanear o QR code com seu celular.

Se tiver qualquer dúvida, é só me chamar aqui!`,

  just_connected: (userName: string) => `Boa${userName ? `, ${userName}` : ''}! Vi que você conectou o WhatsApp - parabéns! 🚀

Agora podemos configurar o restante do seu {a}AutoZap:
• Personalizar a IA com informações do seu negócio
• Adicionar sua base de conhecimento
• Configurar horários de atendimento
• Ajustar respostas automáticas

Quer que eu te guie por essas configurações?`,

  connected_alone: (userName: string) => `Oi${userName ? `, ${userName}` : ''}! Sou do time de suporte do {a}AutoZap.

Vi que você acabou de conectar seu WhatsApp - parabéns pelo primeiro passo! 🎉

Estou aqui para te ajudar com o restante das configurações:
• Personalizar a IA com informações do seu negócio
• Adicionar sua base de conhecimento
• Configurar horários de atendimento
• Ajustar respostas automáticas

Como posso te ajudar?`,

  trial_expired: (userName: string) => `Oi${userName ? `, ${userName}` : ''}! Aqui é do time do {a}AutoZap novamente.

Vi que seu período de teste terminou. 😔

Me conta: o que aconteceu? Ficou alguma dúvida sobre como usar a plataforma?

Às vezes é só um ajuste na configuração que faz toda a diferença. Se quiser, posso te ajudar a resolver qualquer ponto que ficou pendente.

E se não for o momento certo, sem problemas! Só me conta o que te travou, assim consigo melhorar a experiência para outros usuários também.`
};

type MessageType = 'not_connected' | 'just_connected' | 'connected_alone' | 'trial_expired';

interface WelcomeRequest {
  phone: string;
  userName: string;
  userEmail?: string;
  userWorkspaceId: string;
  userWorkspaceName: string;
  messageType: MessageType | string;
}

interface TemplateData {
  content: string;
  enabled: boolean;
  min_hours_between_sends: number | null;
  max_sends_per_lead: number | null;
  send_window_start: string | null;
  send_window_end: string | null;
  delay_after_trigger_minutes: number | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: WelcomeRequest = await req.json();
    const { phone, userName, userEmail, userWorkspaceId, userWorkspaceName, messageType } = body;

    console.log(`[send-welcome-whatsapp] Request received:`, {
      phone,
      userName,
      userEmail,
      userWorkspaceId,
      userWorkspaceName,
      messageType
    });

    // Validate required fields
    if (!phone || !messageType || !userWorkspaceId) {
      console.error('[send-welcome-whatsapp] Missing required fields');
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Don't send welcome to Appi workspace itself
    if (userWorkspaceId === APPI_WORKSPACE_ID) {
      console.log('[send-welcome-whatsapp] Skipping - is Appi workspace');
      return new Response(JSON.stringify({ success: true, skipped: 'appi_workspace' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if template is enabled and get frequency settings + media
    const { data: template } = await supabase
      .from('whatsapp_message_templates')
      .select('content, enabled, min_hours_between_sends, max_sends_per_lead, send_window_start, send_window_end, delay_after_trigger_minutes, media_url, media_type')
      .eq('message_type', messageType)
      .maybeSingle() as { data: TemplateData | null };

    if (template && !template.enabled) {
      console.log(`[send-welcome-whatsapp] Template '${messageType}' is disabled`);
      return new Response(JSON.stringify({ success: true, skipped: 'template_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check send window (Brasília = UTC-3)
    if (template?.send_window_start && template?.send_window_end) {
      const now = new Date();
      const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
      const brasiliaMinute = now.getUTCMinutes();
      const currentTime = `${String(brasiliaHour).padStart(2, '0')}:${String(brasiliaMinute).padStart(2, '0')}`;
      
      // Extract HH:mm from TIME format (could be HH:mm:ss)
      const windowStart = String(template.send_window_start).substring(0, 5);
      const windowEnd = String(template.send_window_end).substring(0, 5);
      
      if (currentTime < windowStart || currentTime >= windowEnd) {
        console.log(`[send-welcome-whatsapp] Outside send window: ${currentTime} not in ${windowStart}-${windowEnd}`);
        return new Response(JSON.stringify({ success: true, skipped: 'outside_send_window', currentTime, windowStart, windowEnd }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get Appi connected instance
    const { data: appiInstance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_id, instance_token, status')
      .eq('workspace_id', APPI_WORKSPACE_ID)
      .eq('status', 'connected')
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (instanceError || !appiInstance) {
      console.error('[send-welcome-whatsapp] Appi instance not found or not connected:', instanceError);
      return new Response(JSON.stringify({ error: 'Appi instance not available' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-welcome-whatsapp] Using Appi instance: ${appiInstance.instance_id}`);

    // Format phone number (remove any non-digits except leading +)
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    // Default chatId - will be overridden if lead already has messages
    let chatId = `${formattedPhone}@s.whatsapp.net`;

    // Check or create lead in Appi workspace
    let { data: existingLead } = await supabase
      .from('leads')
      .select('id, metadata')
      .eq('workspace_id', APPI_WORKSPACE_ID)
      .eq('phone', formattedPhone)
      .maybeSingle();

    const currentMetadata = existingLead?.metadata || {};
    const messagesSent = currentMetadata.messages_sent || {};

    // Check max_sends_per_lead limit
    const allSentTypes = Object.entries(messagesSent).filter(([_, timestamp]) => timestamp);
    if (template?.max_sends_per_lead && allSentTypes.length >= template.max_sends_per_lead) {
      console.log(`[send-welcome-whatsapp] Max sends reached: ${allSentTypes.length}/${template.max_sends_per_lead}`);
      return new Response(JSON.stringify({ success: true, skipped: 'max_sends_reached', sendCount: allSentTypes.length, maxAllowed: template.max_sends_per_lead }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check min_hours_between_sends cooldown
    if (template?.min_hours_between_sends && allSentTypes.length > 0) {
      const lastSentTimestamp = allSentTypes
        .map(([_, ts]) => new Date(ts as string).getTime())
        .sort((a, b) => b - a)[0];
      const hoursSinceLastSend = (Date.now() - lastSentTimestamp) / (1000 * 60 * 60);
      
      if (hoursSinceLastSend < template.min_hours_between_sends) {
        console.log(`[send-welcome-whatsapp] Cooldown active: ${hoursSinceLastSend.toFixed(1)}h < ${template.min_hours_between_sends}h`);
        return new Response(JSON.stringify({ 
          success: true, 
          skipped: 'cooldown_active', 
          hoursSinceLastSend: hoursSinceLastSend.toFixed(1),
          minHoursRequired: template.min_hours_between_sends 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if this specific message type was already sent
    if (messagesSent[messageType]) {
      console.log(`[send-welcome-whatsapp] Message type '${messageType}' already sent at ${messagesSent[messageType]}`);
      return new Response(JSON.stringify({ success: true, skipped: 'already_sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create lead if doesn't exist
    if (!existingLead) {
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          workspace_id: APPI_WORKSPACE_ID,
          phone: formattedPhone,
          name: userName || userEmail?.split('@')[0] || 'Novo Usuário',
          status: 'new',
          metadata: {
            source: 'autozap_new_user',
            user_workspace_id: userWorkspaceId,
            user_workspace_name: userWorkspaceName,
            user_email: userEmail,
            messages_sent: {}
          }
        })
        .select('id, metadata')
        .single();

      if (leadError) {
        console.error('[send-welcome-whatsapp] Error creating lead:', leadError);
        return new Response(JSON.stringify({ error: 'Failed to create lead' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      existingLead = newLead;
      console.log(`[send-welcome-whatsapp] Created new lead: ${newLead.id}`);
    }

    // IMPORTANT: Check if lead already has messages with an existing chat_id
    // This prevents creating duplicate conversations when WhatsApp uses different formats
    if (existingLead?.id) {
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('chat_id')
        .eq('lead_id', existingLead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (existingMessage?.chat_id) {
        console.log(`[send-welcome-whatsapp] Using existing chat_id: ${existingMessage.chat_id} instead of ${chatId}`);
        chatId = existingMessage.chat_id;
      }
    }

    // Get the appropriate message - use template from DB if available, fallback to hardcoded
    const firstName = userName?.split(' ')[0] || '';
    let messageContent: string;
    
    if (template?.content) {
      // Use database template - replace {userName} variable
      messageContent = template.content.replace(/\{userName\}/g, firstName ? `, ${firstName}` : '');
      console.log(`[send-welcome-whatsapp] Using database template for '${messageType}'`);
    } else if (messageType in MESSAGES) {
      // Fallback to hardcoded message for known types
      messageContent = MESSAGES[messageType as MessageType](firstName);
      console.log(`[send-welcome-whatsapp] Using fallback hardcoded template for '${messageType}'`);
    } else {
      console.error(`[send-welcome-whatsapp] No template found for type '${messageType}'`);
      return new Response(JSON.stringify({ error: 'Template not found', messageType }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-welcome-whatsapp] Sending '${messageType}' message to ${formattedPhone}${template?.media_url ? ` with ${template.media_type}` : ''}`);

    // Get Z-API client token
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
    if (!clientToken) {
      console.error('[send-welcome-whatsapp] ZAPI_CLIENT_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'Z-API not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sendSuccess = false;

    // If template has media, send via Z-API media endpoints
    if (template?.media_url && template?.media_type) {
      const endpoint = template.media_type === 'image' ? 'send-image' : 'send-video';
      const zapiUrl = `https://api.z-api.io/instances/${appiInstance.instance_id}/token/${appiInstance.instance_token}/${endpoint}`;
      
      const mediaPayload = template.media_type === 'image'
        ? { phone: formattedPhone, image: template.media_url, caption: messageContent }
        : { phone: formattedPhone, video: template.media_url, caption: messageContent };
      
      console.log(`[send-welcome-whatsapp] Sending ${template.media_type} via Z-API to ${formattedPhone}`);
      
      const mediaResponse = await fetch(zapiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client-token': clientToken
        },
        body: JSON.stringify(mediaPayload)
      });

      if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text();
        console.error(`[send-welcome-whatsapp] Z-API ${template.media_type} error:`, errorText);
        return new Response(JSON.stringify({ error: `Failed to send ${template.media_type}`, details: errorText }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const mediaResult = await mediaResponse.json();
      console.log(`[send-welcome-whatsapp] Z-API ${template.media_type} sent successfully:`, mediaResult);
      sendSuccess = true;

      // Store message in database
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          lead_id: existingLead.id,
          workspace_id: APPI_WORKSPACE_ID,
          content: messageContent,
          direction: 'outgoing',
          message_type: template.media_type,
          metadata: {
            zapi_message_id: mediaResult.zapiMessageId,
            media_url: template.media_url,
            caption: messageContent
          },
          delivery_status: 'sent'
        });

      if (messageError) {
        console.error('[send-welcome-whatsapp] Error storing message:', messageError);
      }

    } else {
      // Send text message via send-message function
      const sendMessageResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            chat_id: chatId,
            message: messageContent,
            lead_id: existingLead.id,
            instance_id: appiInstance.id
          })
        }
      );

      if (!sendMessageResponse.ok) {
        const errorText = await sendMessageResponse.text();
        console.error('[send-welcome-whatsapp] Failed to send message:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to send message', details: errorText }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      sendSuccess = true;
    }

    if (sendSuccess) {
      console.log('[send-welcome-whatsapp] Message sent successfully');

      // Update lead metadata with sent message info
      const updatedMessagesSent = {
        ...messagesSent,
        [messageType]: new Date().toISOString()
      };

      const updatedMetadata = {
        ...currentMetadata,
        source: 'autozap_new_user',
        user_workspace_id: userWorkspaceId,
        user_workspace_name: userWorkspaceName,
        user_email: userEmail || currentMetadata.user_email,
        messages_sent: updatedMessagesSent
      };

      await supabase
        .from('leads')
        .update({ metadata: updatedMetadata })
        .eq('id', existingLead.id);

      console.log(`[send-welcome-whatsapp] Updated lead metadata with '${messageType}' sent timestamp`);

      // Log to platform_logs
      await supabase
        .from('platform_logs')
        .insert({
          action: 'welcome_message_sent',
          entity_type: 'lead',
          entity_id: existingLead.id,
          details: {
            message_type: messageType,
            user_workspace_id: userWorkspaceId,
            user_workspace_name: userWorkspaceName,
            user_email: userEmail,
            phone: formattedPhone,
            has_media: !!template?.media_url,
            media_type: template?.media_type,
            timestamp: new Date().toISOString()
          }
        });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      messageType, 
      leadId: existingLead.id,
      hasMedia: !!template?.media_url,
      mediaType: template?.media_type 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[send-welcome-whatsapp] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

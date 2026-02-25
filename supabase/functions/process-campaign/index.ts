import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURAÇÕES DE RATE LIMITING SEGURO (Baseado em recomendações Z-API)
// ============================================================================
// Filosofia Z-API: "O mais importante é PARA QUEM você envia"
// "Nosso cliente envia 80mil msgs/dia sem bloqueio porque a base é engajada"
// Por isso: SEM LIMITE DE QUANTIDADE - apenas rate limiting humanizado
// ============================================================================
const MIN_DELAY_MS = 12000;  // 12 segundos mínimo entre mensagens
const MAX_DELAY_MS = 20000;  // 20 segundos máximo entre mensagens
const SEND_WINDOW_START = 8; // 8h da manhã (Brasília)
const SEND_WINDOW_END = 20;  // 8h da noite (Brasília)

/**
 * Gera um delay aleatório entre MIN e MAX para parecer mais humano
 */
function getRandomDelay(): number {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

/**
 * Verifica se estamos dentro da janela de envio permitida (8h-20h Brasília)
 */
function isWithinSendWindow(): boolean {
  const now = new Date();
  const brasiliaOffset = -3;
  const brasiliaHour = (now.getUTCHours() + brasiliaOffset + 24) % 24;
  return brasiliaHour >= SEND_WINDOW_START && brasiliaHour < SEND_WINDOW_END;
}

/**
 * Envia mensagem via Z-API (texto, imagem ou vídeo)
 */
async function sendMessage(
  instanceId: string,
  instanceToken: string,
  clientToken: string,
  phone: string,
  content: string,
  mediaUrl?: string | null,
  mediaType?: string | null
): Promise<{ ok: boolean; errorText?: string }> {
  const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}`;
  
  let endpoint: string;
  let body: Record<string, string>;
  
  if (mediaUrl && mediaType) {
    // Enviar com mídia
    if (mediaType === 'image') {
      endpoint = `${baseUrl}/send-image`;
      body = {
        phone,
        image: mediaUrl,
        caption: content,
      };
    } else if (mediaType === 'video') {
      endpoint = `${baseUrl}/send-video`;
      body = {
        phone,
        video: mediaUrl,
        caption: content,
      };
    } else {
      // Fallback para texto se tipo desconhecido
      endpoint = `${baseUrl}/send-text`;
      body = {
        phone,
        message: content,
      };
    }
  } else {
    // Enviar só texto
    endpoint = `${baseUrl}/send-text`;
    body = {
      phone,
      message: content,
    };
  }
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'client-token': clientToken,
    },
    body: JSON.stringify(body),
  });
  
  if (response.ok) {
    return { ok: true };
  } else {
    const errorText = await response.text();
    return { ok: false, errorText: `${response.status} - ${errorText.substring(0, 200)}` };
  }
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

    console.log('[process-campaign] Starting campaign processing...');

    // Verificar se estamos na janela de envio
    if (!isWithinSendWindow()) {
      console.log('[process-campaign] Outside sending window (8h-20h Brasília). Skipping.');
      return new Response(JSON.stringify({ 
        message: 'Outside sending window (8h-20h Brasília)',
        next_window: 'Campaigns will resume at 8:00 AM Brasília time'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch campaigns ready to send (status = 'scheduled' AND scheduled_at <= NOW)
    const { data: campaigns, error: campaignError } = await supabase
      .from('whatsapp_campaigns')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    if (campaignError) {
      throw campaignError;
    }

    // Also fetch running campaigns (resumed from previous day)
    const { data: runningCampaigns } = await supabase
      .from('whatsapp_campaigns')
      .select('*')
      .eq('status', 'running');

    const allCampaigns = [...(campaigns || []), ...(runningCampaigns || [])];

    if (allCampaigns.length === 0) {
      console.log('[process-campaign] No campaigns ready to process');
      return new Response(JSON.stringify({ message: 'No campaigns to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-campaign] Found ${allCampaigns.length} campaign(s) to process`);

    const results = [];

    for (const campaign of allCampaigns) {
      console.log(`[process-campaign] Processing campaign: ${campaign.id} - ${campaign.name}`);
      console.log(`[process-campaign] Media: ${campaign.media_url ? `${campaign.media_type} - ${campaign.media_url}` : 'none'}`);

      // Get a connected WhatsApp instance for the workspace
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, instance_token')
        .eq('workspace_id', campaign.workspace_id)
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle();

      if (!instance) {
        console.error(`[process-campaign] No connected WhatsApp instance for workspace ${campaign.workspace_id}`);
        
        await supabase
          .from('whatsapp_campaigns')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', campaign.id);
        
        continue;
      }

      // Update status to 'running'
      await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', campaign.id);

      // Fetch ALL pending recipients (SEM LIMITE DE QUANTIDADE - filosofia Z-API)
      const { data: recipients, error: recipientsError } = await supabase
        .from('whatsapp_campaign_recipients')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending');

      if (recipientsError) {
        console.error(`[process-campaign] Error fetching recipients for campaign ${campaign.id}:`, recipientsError);
        
        await supabase
          .from('whatsapp_campaigns')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', campaign.id);
        
        continue;
      }

      if (!recipients || recipients.length === 0) {
        // Campaign complete - no more pending recipients
        console.log(`[process-campaign] Campaign ${campaign.id} has no pending recipients. Marking as completed.`);
        
        await supabase
          .from('whatsapp_campaigns')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', campaign.id);
        
        continue;
      }

      let sentCount = 0;
      let failedCount = 0;

      const clientToken = Deno.env.get('ZAPI_USER_TOKEN');
      if (!clientToken) {
        console.error('[process-campaign] ZAPI_USER_TOKEN not configured');
        continue;
      }

      // Process each recipient with safe rate limiting
      for (const recipient of recipients) {
        // Verificar janela de horário a cada iteração
        if (!isWithinSendWindow()) {
          console.log('[process-campaign] Send window ended. Pausing campaign until tomorrow 8h.');
          break;
        }

        try {
          // Replace {userName} placeholder with recipient name
          const personalizedContent = campaign.content.replace(
            /\{userName\}/g,
            recipient.name ? ` ${recipient.name}` : ''
          );

          // Send message via Z-API (with or without media)
          const result = await sendMessage(
            instance.instance_id,
            instance.instance_token,
            clientToken,
            recipient.phone,
            personalizedContent,
            campaign.media_url,
            campaign.media_type
          );

          if (result.ok) {
            sentCount++;
            await supabase
              .from('whatsapp_campaign_recipients')
              .update({ 
                status: 'sent', 
                sent_at: new Date().toISOString() 
              })
              .eq('id', recipient.id);
            
            console.log(`[process-campaign] ✓ Sent to ${recipient.phone} (${sentCount}/${recipients.length})${campaign.media_url ? ' [with media]' : ''}`);
          } else {
            failedCount++;
            await supabase
              .from('whatsapp_campaign_recipients')
              .update({ 
                status: 'failed', 
                error: `Z-API error: ${result.errorText}` 
              })
              .eq('id', recipient.id);
            
            console.error(`[process-campaign] ✗ Failed to send to ${recipient.phone}:`, result.errorText);
          }
        } catch (error) {
          failedCount++;
          await supabase
            .from('whatsapp_campaign_recipients')
            .update({ 
              status: 'failed', 
              error: error instanceof Error ? error.message : 'Unknown error' 
            })
            .eq('id', recipient.id);
          
          console.error(`[process-campaign] ✗ Error sending to ${recipient.phone}:`, error);
        }

        // Rate limiting: delay aleatório entre 12-20 segundos (parecer humano)
        const delay = getRandomDelay();
        console.log(`[process-campaign] Waiting ${delay / 1000}s before next message...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Check if there are still pending recipients
      const { count: remainingCount } = await supabase
        .from('whatsapp_campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending');

      const hasPending = (remainingCount || 0) > 0;
      
      // Fetch current stats for accurate totals
      const { data: statsData } = await supabase
        .from('whatsapp_campaign_recipients')
        .select('status')
        .eq('campaign_id', campaign.id);

      const totalRecipients = statsData?.length || 0;
      const totalSent = statsData?.filter((r: any) => r.status === 'sent').length || 0;
      const totalFailed = statsData?.filter((r: any) => r.status === 'failed').length || 0;
      
      // If there are still pending, keep as 'running' to resume later
      const finalStatus = hasPending ? 'running' : (totalFailed === totalRecipients ? 'failed' : 'completed');

      await supabase
        .from('whatsapp_campaigns')
        .update({
          status: finalStatus,
          stats: { total: totalRecipients, sent: totalSent, failed: totalFailed, pending: remainingCount || 0 },
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id);

      results.push({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        has_media: !!campaign.media_url,
        media_type: campaign.media_type,
        status: finalStatus,
        sent_this_batch: sentCount,
        failed_this_batch: failedCount,
        total_sent: totalSent,
        total_failed: totalFailed,
        pending: remainingCount || 0,
        total: totalRecipients,
      });

      console.log(`[process-campaign] Batch complete for ${campaign.id}: ${sentCount} sent, ${failedCount} failed. Total: ${totalSent}/${totalRecipients}. Pending: ${remainingCount}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      config: {
        delay_range: `${MIN_DELAY_MS / 1000}-${MAX_DELAY_MS / 1000}s`,
        daily_limit: 'unlimited',
        send_window: `${SEND_WINDOW_START}h-${SEND_WINDOW_END}h (Brasília)`,
        philosophy: 'Z-API: Quantidade não é problema. Qualidade da base é.',
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[process-campaign] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

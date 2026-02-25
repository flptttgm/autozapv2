import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZAPI_BASE_URL = 'https://api.z-api.io';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const CLIENT_TOKEN = Deno.env.get('ZAPI_USER_TOKEN');
    
    if (!CLIENT_TOKEN) {
      throw new Error('ZAPI_USER_TOKEN not configured');
    }

    const url = new URL(req.url);
    const instanceDbId = url.searchParams.get('instance_db_id');

    if (!instanceDbId) {
      return new Response(JSON.stringify({ error: 'instance_db_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-instance-subscription] Syncing instance: ${instanceDbId}`);

    // Get instance details
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_id, instance_token, workspace_id, status, subscribed, phone')
      .eq('id', instanceDbId)
      .single();

    if (instanceError || !instance) {
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if workspace has active paid subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_type, status')
      .eq('workspace_id', instance.workspace_id)
      .single();

    if (!subscription) {
      return new Response(JSON.stringify({ 
        error: 'NO_SUBSCRIPTION',
        message: 'Nenhuma assinatura encontrada para este workspace'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (subscription.status !== 'active') {
      return new Response(JSON.stringify({ 
        error: 'SUBSCRIPTION_INACTIVE',
        message: 'A assinatura não está ativa. Status: ' + subscription.status
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (subscription.plan_type === 'trial') {
      return new Response(JSON.stringify({ 
        error: 'TRIAL_SUBSCRIPTION',
        message: 'Sincronização automática não está disponível para planos trial. Assine um plano pago.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-instance-subscription] Workspace has active ${subscription.plan_type} plan`);

    // Step 1: Check current Z-API status
    const statusUrl = `${ZAPI_BASE_URL}/instances/${instance.instance_id}/token/${instance.instance_token}/status`;
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: { 'Client-Token': CLIENT_TOKEN },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error(`[sync-instance-subscription] Status check failed:`, errorText);
      
      return new Response(JSON.stringify({ 
        error: 'ZAPI_STATUS_ERROR',
        message: 'Erro ao verificar status na Z-API: ' + errorText.substring(0, 100)
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const statusData = await statusResponse.json();
    console.log(`[sync-instance-subscription] Z-API status:`, statusData);

    const isConnected = statusData.connected === true || statusData.status === 'connected';
    const isSubscribed = statusData.subscribed === true;

    // If already subscribed, just update local DB
    if (isSubscribed) {
      console.log(`[sync-instance-subscription] Instance already subscribed, updating local state`);
      
      await supabase
        .from('whatsapp_instances')
        .update({ 
          subscribed: true, 
          status: isConnected ? 'connected' : 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('id', instance.id);

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Instância já está sincronizada',
        status: isConnected ? 'connected' : 'disconnected',
        subscribed: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Try to subscribe the instance via Z-API subscription endpoint
    console.log(`[sync-instance-subscription] Attempting to subscribe instance via Z-API`);
    
    // IMPORTANT: The subscription endpoint is part of the Partner API and requires Authorization: Bearer
    const PARTNER_TOKEN = Deno.env.get('ZAPI_PARTNER_TOKEN');
    if (!PARTNER_TOKEN) {
      throw new Error('ZAPI_PARTNER_TOKEN not configured');
    }
    
    // Use the correct subscription URL format: /instances/{id}/token/{token}/integrator/on-demand/subscription
    const subscribeUrl = `${ZAPI_BASE_URL}/instances/${instance.instance_id}/token/${instance.instance_token}/integrator/on-demand/subscription`;
    const subscribeResponse = await fetch(subscribeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PARTNER_TOKEN}`,
      },
    });

    const subscribeResult = await subscribeResponse.json().catch(() => ({}));
    console.log(`[sync-instance-subscription] Subscribe response:`, subscribeResult);

    // Check if already subscribed (Z-API returns error but instance is actually paid)
    const isAlreadyPaid = subscribeResult?.error?.toLowerCase().includes('already') && 
                          subscribeResult?.error?.toLowerCase().includes('paid');

    if (!subscribeResponse.ok && !isAlreadyPaid) {
      console.error(`[sync-instance-subscription] Subscribe failed:`, subscribeResult);
      
      // Log the failure
      await supabase
        .from('platform_logs')
        .insert({
          action: 'sync_subscription_failed',
          entity_type: 'whatsapp_instance',
          entity_id: instance.instance_id,
          details: {
            workspace_id: instance.workspace_id,
            phone: instance.phone,
            subscription_plan: subscription.plan_type,
            error: subscribeResult,
            attempted_at: new Date().toISOString()
          }
        });

      return new Response(JSON.stringify({ 
        error: 'SUBSCRIBE_FAILED',
        message: 'Não foi possível reativar a assinatura na Z-API. Tente reconectar o WhatsApp.',
        details: subscribeResult
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If already paid, treat as success and update local state immediately
    if (isAlreadyPaid) {
      console.log(`[sync-instance-subscription] Instance already has paid subscription, updating local state`);
      
      await supabase
        .from('whatsapp_instances')
        .update({ 
          subscribed: true, 
          status: isConnected ? 'connected' : 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', instance.id);

      // Log the success
      await supabase
        .from('platform_logs')
        .insert({
          action: 'sync_subscription_already_paid',
          entity_type: 'whatsapp_instance',
          entity_id: instance.instance_id,
          details: {
            workspace_id: instance.workspace_id,
            phone: instance.phone,
            subscription_plan: subscription.plan_type,
            synced_at: new Date().toISOString()
          }
        });

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Instância já possui assinatura paga ativa',
        status: isConnected ? 'connected' : 'pending',
        subscribed: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Verify subscription was activated
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for propagation
    
    const verifyResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: { 'Client-Token': CLIENT_TOKEN },
    });

    const verifyData = await verifyResponse.json();
    const nowSubscribed = verifyData.subscribed === true;
    const nowConnected = verifyData.connected === true || verifyData.status === 'connected';

    console.log(`[sync-instance-subscription] After subscribe - connected: ${nowConnected}, subscribed: ${nowSubscribed}`);

    // Update local database
    await supabase
      .from('whatsapp_instances')
      .update({ 
        subscribed: nowSubscribed,
        status: nowConnected ? 'connected' : (nowSubscribed ? 'pending' : 'expired'),
        updated_at: new Date().toISOString()
      })
      .eq('id', instance.id);

    // Log success
    await supabase
      .from('platform_logs')
      .insert({
        action: 'sync_subscription_success',
        entity_type: 'whatsapp_instance',
        entity_id: instance.instance_id,
        details: {
          workspace_id: instance.workspace_id,
          phone: instance.phone,
          subscription_plan: subscription.plan_type,
          now_subscribed: nowSubscribed,
          now_connected: nowConnected,
          synced_at: new Date().toISOString()
        }
      });

    return new Response(JSON.stringify({ 
      success: true,
      message: nowSubscribed 
        ? 'Assinatura sincronizada com sucesso!' 
        : 'Sincronização parcial - pode ser necessário reconectar o WhatsApp',
      status: nowConnected ? 'connected' : 'pending',
      subscribed: nowSubscribed
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-instance-subscription] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

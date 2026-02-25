import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZAPI_BASE_URL = 'https://api.z-api.io';

/**
 * Syncs all WhatsApp instances for a workspace when plan changes to paid.
 * Can be triggered by:
 * - Database trigger when subscription.plan_type changes from 'trial' to paid
 * - Manual call from admin or user
 */
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

    // IMPORTANT: The subscription endpoint is part of the Partner API and requires Authorization: Bearer
    const PARTNER_TOKEN = Deno.env.get('ZAPI_PARTNER_TOKEN');
    if (!PARTNER_TOKEN) {
      throw new Error('ZAPI_PARTNER_TOKEN not configured');
    }

    const body = await req.json().catch(() => ({}));
    const { workspace_id, trigger_source } = body;

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-workspace-instances] Starting sync for workspace: ${workspace_id}, trigger: ${trigger_source || 'manual'}`);

    // Verify workspace has active paid subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_type, status')
      .eq('workspace_id', workspace_id)
      .single();

    if (!subscription) {
      console.log(`[sync-workspace-instances] No subscription found for workspace`);
      return new Response(JSON.stringify({ 
        error: 'NO_SUBSCRIPTION',
        message: 'Nenhuma assinatura encontrada' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (subscription.plan_type === 'trial') {
      console.log(`[sync-workspace-instances] Workspace is still on trial, skipping`);
      return new Response(JSON.stringify({ 
        skipped: true,
        message: 'Workspace ainda está em trial, sync não necessário' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (subscription.status !== 'active') {
      console.log(`[sync-workspace-instances] Subscription not active: ${subscription.status}`);
      return new Response(JSON.stringify({ 
        error: 'SUBSCRIPTION_INACTIVE',
        message: 'Assinatura não está ativa' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all instances for this workspace
    const { data: instances, error: instancesError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_id, instance_token, status, subscribed, phone')
      .eq('workspace_id', workspace_id);

    if (instancesError) {
      throw new Error(`Failed to fetch instances: ${instancesError.message}`);
    }

    if (!instances || instances.length === 0) {
      console.log(`[sync-workspace-instances] No instances found for workspace`);
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Nenhuma instância encontrada para sincronizar',
        synced: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-workspace-instances] Found ${instances.length} instances to process`);

    const results = {
      total: instances.length,
      synced: 0,
      already_synced: 0,
      failed: 0,
      details: [] as any[]
    };

    // Process each instance
    for (const instance of instances) {
      try {
        console.log(`[sync-workspace-instances] Processing instance ${instance.instance_id} (phone: ${instance.phone || 'unknown'})`);

        // Check current Z-API status
        const statusUrl = `${ZAPI_BASE_URL}/instances/${instance.instance_id}/token/${instance.instance_token}/status`;
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: { 'Client-Token': CLIENT_TOKEN },
        });

        if (!statusResponse.ok) {
          console.error(`[sync-workspace-instances] Status check failed for ${instance.instance_id}`);
          results.failed++;
          results.details.push({
            instance_id: instance.instance_id,
            phone: instance.phone,
            status: 'error',
            message: 'Failed to check Z-API status'
          });
          continue;
        }

        const statusData = await statusResponse.json();
        const isConnected = statusData.connected === true || statusData.status === 'connected';
        const isSubscribed = statusData.subscribed === true;

        // If already subscribed, just update local DB
        if (isSubscribed) {
          console.log(`[sync-workspace-instances] Instance ${instance.instance_id} already subscribed`);
          
          await supabase
            .from('whatsapp_instances')
            .update({ 
              subscribed: true, 
              status: isConnected ? 'connected' : 'disconnected',
              updated_at: new Date().toISOString()
            })
            .eq('id', instance.id);

          results.already_synced++;
          results.details.push({
            instance_id: instance.instance_id,
            phone: instance.phone,
            status: 'already_synced',
            connected: isConnected
          });
          continue;
        }

        // Try to subscribe the instance
        console.log(`[sync-workspace-instances] Subscribing instance ${instance.instance_id}`);
        
        const subscribeUrl = `${ZAPI_BASE_URL}/instances/${instance.instance_id}/token/${instance.instance_token}/integrator/on-demand/subscription`;
        const subscribeResponse = await fetch(subscribeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PARTNER_TOKEN}`,
          },
        });

        const subscribeResult = await subscribeResponse.json().catch(() => ({}));

        // Check if already subscribed (Z-API returns error but instance is actually paid)
        const isAlreadyPaid = subscribeResult?.error?.toLowerCase().includes('already') && 
                              subscribeResult?.error?.toLowerCase().includes('paid');

        if (!subscribeResponse.ok && !isAlreadyPaid) {
          console.error(`[sync-workspace-instances] Subscribe failed for ${instance.instance_id}:`, subscribeResult);
          results.failed++;
          results.details.push({
            instance_id: instance.instance_id,
            phone: instance.phone,
            status: 'subscribe_failed',
            error: subscribeResult
          });
          continue;
        }

        // If already paid, treat as synced and update local state
        if (isAlreadyPaid) {
          console.log(`[sync-workspace-instances] Instance ${instance.instance_id} already has paid subscription`);
          
          await supabase
            .from('whatsapp_instances')
            .update({ 
              subscribed: true, 
              status: isConnected ? 'connected' : 'pending',
              updated_at: new Date().toISOString()
            })
            .eq('id', instance.id);

          results.already_synced++;
          results.details.push({
            instance_id: instance.instance_id,
            phone: instance.phone,
            status: 'already_paid',
            connected: isConnected
          });
          continue;
        }

        // Wait for propagation and verify
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const verifyResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: { 'Client-Token': CLIENT_TOKEN },
        });

        const verifyData = await verifyResponse.json();
        const nowSubscribed = verifyData.subscribed === true;
        const nowConnected = verifyData.connected === true || verifyData.status === 'connected';

        // Update local database
        await supabase
          .from('whatsapp_instances')
          .update({ 
            subscribed: nowSubscribed,
            status: nowConnected ? 'connected' : (nowSubscribed ? 'pending' : instance.status),
            updated_at: new Date().toISOString()
          })
          .eq('id', instance.id);

        if (nowSubscribed) {
          results.synced++;
          results.details.push({
            instance_id: instance.instance_id,
            phone: instance.phone,
            status: 'synced',
            connected: nowConnected
          });
        } else {
          results.failed++;
          results.details.push({
            instance_id: instance.instance_id,
            phone: instance.phone,
            status: 'sync_incomplete',
            connected: nowConnected
          });
        }

      } catch (err) {
        console.error(`[sync-workspace-instances] Error processing instance ${instance.instance_id}:`, err);
        results.failed++;
        results.details.push({
          instance_id: instance.instance_id,
          phone: instance.phone,
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    // Log the sync operation
    await supabase
      .from('platform_logs')
      .insert({
        action: 'workspace_instances_sync',
        entity_type: 'workspace',
        entity_id: workspace_id,
        details: {
          trigger_source: trigger_source || 'manual',
          plan_type: subscription.plan_type,
          results,
          synced_at: new Date().toISOString()
        }
      });

    console.log(`[sync-workspace-instances] Completed. Synced: ${results.synced}, Already: ${results.already_synced}, Failed: ${results.failed}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Sincronização concluída: ${results.synced + results.already_synced}/${results.total} instâncias OK`,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-workspace-instances] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

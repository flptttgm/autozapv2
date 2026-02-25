import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZAPI_BASE_URL = 'https://api.z-api.io';

// Helper: Try to subscribe instance via Z-API subscription endpoint
// IMPORTANT: The subscription endpoint is part of the Partner API and requires Authorization: Bearer
async function trySubscribeInstance(
  instanceId: string, 
  instanceToken: string
): Promise<{ success: boolean; error?: string; alreadyPaid?: boolean }> {
  try {
    const PARTNER_TOKEN = Deno.env.get('ZAPI_PARTNER_TOKEN');
    if (!PARTNER_TOKEN) {
      return { success: false, error: 'ZAPI_PARTNER_TOKEN not configured' };
    }

    // Use the correct subscription URL format: /instances/{id}/token/{token}/integrator/on-demand/subscription
    const subscribeUrl = `${ZAPI_BASE_URL}/instances/${instanceId}/token/${instanceToken}/integrator/on-demand/subscription`;
    const response = await fetch(subscribeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PARTNER_TOKEN}`,
      },
    });

    const responseText = await response.text();
    let responseData = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {}

    // Check if already subscribed (Z-API returns error but instance is actually paid)
    const isAlreadyPaid = responseText.toLowerCase().includes('already') && 
                          responseText.toLowerCase().includes('paid');

    if (!response.ok && response.status !== 201 && !isAlreadyPaid) {
      return { success: false, error: responseText };
    }

    return { success: true, alreadyPaid: isAlreadyPaid };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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

    const CLIENT_TOKEN = Deno.env.get('ZAPI_USER_TOKEN');
    
    if (!CLIENT_TOKEN) {
      throw new Error('ZAPI_USER_TOKEN not configured');
    }

    console.log('[check-instance-subscriptions] Starting periodic check...');

    // Get all instances that are marked as "connected" or "pending" in our database
    const { data: instances, error: fetchError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_id, instance_token, workspace_id, status, subscribed, phone')
      .in('status', ['connected', 'pending']);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`[check-instance-subscriptions] Found ${instances?.length || 0} instances to check`);

    const results = {
      checked: 0,
      expired: 0,
      stillActive: 0,
      autoSynced: 0,
      errors: 0,
      details: [] as any[]
    };

    for (const instance of instances || []) {
      try {
        // Check status on Z-API
        const statusUrl = `${ZAPI_BASE_URL}/instances/${instance.instance_id}/token/${instance.instance_token}/status`;
        
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'Client-Token': CLIENT_TOKEN,
          },
        });

        results.checked++;

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          console.error(`[check-instance-subscriptions] Error checking instance ${instance.instance_id}:`, statusResponse.status, errorText);
          
          // If we get a 4xx error, the instance might be expired
          if (statusResponse.status >= 400 && statusResponse.status < 500) {
            const errorLower = errorText.toLowerCase();
            const isExpiredError = 
              errorLower.includes('subscribe') || 
              errorLower.includes('expired') ||
              errorLower.includes('not found') ||
              errorLower.includes('inactive');
            
            if (isExpiredError) {
              console.log(`[check-instance-subscriptions] Instance ${instance.instance_id} appears expired`);
              
              // NEW: Check if workspace has active valid subscription before marking as expired
              // FIX: Consider valid trial as active subscription (trial_ends_at in the future)
              const { data: subscription } = await supabase
                .from('subscriptions')
                .select('plan_type, status, trial_ends_at')
                .eq('workspace_id', instance.workspace_id)
                .single();

              // Valid subscription = paid plan OR valid trial (trial_ends_at in the future)
              const hasValidSubscription = subscription?.status === 'active' && (
                subscription?.plan_type !== 'trial' || 
                (subscription?.trial_ends_at && new Date(subscription.trial_ends_at) > new Date())
              );

              if (hasValidSubscription) {
                console.log(`[check-instance-subscriptions] Workspace has active ${subscription.plan_type} plan, attempting auto-sync`);
                
                const syncResult = await trySubscribeInstance(instance.instance_id, instance.instance_token);
                
                if (syncResult.success) {
                  // Wait for propagation and re-check
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  
                  const verifyResponse = await fetch(statusUrl, {
                    method: 'GET',
                    headers: { 'Client-Token': CLIENT_TOKEN },
                  });
                  
                  if (verifyResponse.ok) {
                    const verifyData = await verifyResponse.json();
                    if (verifyData.subscribed === true) {
                      console.log(`[check-instance-subscriptions] Auto-sync successful for instance ${instance.instance_id}`);
                      
                      await supabase
                        .from('whatsapp_instances')
                        .update({ 
                          subscribed: true,
                          status: verifyData.connected ? 'connected' : 'pending',
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', instance.id);
                      
                      await supabase
                        .from('platform_logs')
                        .insert({
                          action: 'whatsapp_auto_sync_success',
                          entity_type: 'whatsapp_instance',
                          entity_id: instance.instance_id,
                          details: {
                            workspace_id: instance.workspace_id,
                            phone: instance.phone,
                            plan_type: subscription.plan_type,
                            synced_at: new Date().toISOString()
                          }
                        });
                      
                      results.autoSynced++;
                      results.details.push({
                        instanceId: instance.instance_id,
                        phone: instance.phone,
                        status: 'auto_synced',
                        reason: 'subscription reactivated'
                      });
                      
                      continue; // Don't mark as expired
                    }
                  }
                }
                
                console.log(`[check-instance-subscriptions] Auto-sync failed for instance ${instance.instance_id}`);
                
                // FIX: Se tem plano válido, NÃO marcar como expired - apenas logar e continuar
                await supabase
                  .from('platform_logs')
                  .insert({
                    action: 'whatsapp_subscription_sync_skipped',
                    entity_type: 'whatsapp_instance',
                    entity_id: instance.instance_id,
                    details: {
                      workspace_id: instance.workspace_id,
                      phone: instance.phone,
                      plan_type: subscription.plan_type,
                      reason: 'auto_sync_failed_but_has_valid_plan',
                      context: '4xx_error_recovery'
                    }
                  });

                results.stillActive++;
                results.details.push({
                  instanceId: instance.instance_id,
                  phone: instance.phone,
                  status: 'sync_skipped_valid_plan',
                  plan_type: subscription.plan_type
                });

                continue; // Não cair no bloco de expiração
              }
              
              // Update status to expired (apenas quando NÃO tem plano válido)
              await supabase
                .from('whatsapp_instances')
                .update({ 
                  status: 'expired',
                  subscribed: false,
                  updated_at: new Date().toISOString()
                })
                .eq('id', instance.id);
              
              // Notify workspace members
              const { data: members } = await supabase
                .from('workspace_members')
                .select('user_id')
                .eq('workspace_id', instance.workspace_id);
              
              for (const member of members || []) {
                // Check if we already sent a notification recently
                const { data: recentNotif } = await supabase
                  .from('user_notifications')
                  .select('id')
                  .eq('user_id', member.user_id)
                  .eq('type', 'whatsapp_expired')
                  .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                  .limit(1)
                  .maybeSingle();
                
                if (!recentNotif) {
                  await supabase
                    .from('user_notifications')
                    .insert({
                      user_id: member.user_id,
                      title: '⚠️ WhatsApp Expirado',
                      body: `Sua conexão WhatsApp${instance.phone ? ` (${instance.phone})` : ''} expirou. Reconecte para continuar usando a automação.`,
                      url: '/whatsapp',
                      type: 'whatsapp_expired'
                    });
                }
              }
              
              // Log to platform_logs
              await supabase
                .from('platform_logs')
                .insert({
                  action: 'whatsapp_subscription_check_expired',
                  entity_type: 'whatsapp_instance',
                  entity_id: instance.instance_id,
                  details: {
                    workspace_id: instance.workspace_id,
                    phone: instance.phone,
                    error: errorText,
                    detected_at: new Date().toISOString()
                  }
                });
              
              results.expired++;
              results.details.push({
                instanceId: instance.instance_id,
                phone: instance.phone,
                status: 'expired',
                reason: errorText.substring(0, 200)
              });
              
              continue;
            }
          }
          
          results.errors++;
          continue;
        }

        const statusData = await statusResponse.json();
        const isConnected = statusData.connected === true || statusData.status === 'connected';
        // FIX: Use strict equality to avoid marking trial instances as subscribed
        // Z-API returns undefined/null for subscribed during trial period
        const isSubscribed = statusData.subscribed === true;

        console.log(`[check-instance-subscriptions] Instance ${instance.instance_id}: connected=${isConnected}, subscribed=${isSubscribed}`);

        // If connected but not subscribed, check if we can auto-sync before marking as expired
        if (isConnected && !isSubscribed) {
          console.log(`[check-instance-subscriptions] Instance ${instance.instance_id} connected but NOT subscribed`);
          
          // NEW: Check if workspace has active valid subscription
          // FIX: Consider valid trial as active subscription (trial_ends_at in the future)
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('plan_type, status, trial_ends_at')
            .eq('workspace_id', instance.workspace_id)
            .single();

          // Valid subscription = paid plan OR valid trial (trial_ends_at in the future)
          const hasValidSubscription = subscription?.status === 'active' && (
            subscription?.plan_type !== 'trial' || 
            (subscription?.trial_ends_at && new Date(subscription.trial_ends_at) > new Date())
          );

          if (hasValidSubscription) {
            console.log(`[check-instance-subscriptions] Workspace has active ${subscription.plan_type} plan, attempting auto-sync`);
            
            const syncResult = await trySubscribeInstance(instance.instance_id, instance.instance_token);
            
            if (syncResult.success) {
              // Wait for propagation and re-check
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              const verifyResponse = await fetch(statusUrl, {
                method: 'GET',
                headers: { 'Client-Token': CLIENT_TOKEN },
              });
              
              if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json();
                if (verifyData.subscribed === true) {
                  console.log(`[check-instance-subscriptions] Auto-sync successful for instance ${instance.instance_id}`);
                  
                  await supabase
                    .from('whatsapp_instances')
                    .update({ 
                      subscribed: true,
                      status: 'connected',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', instance.id);
                  
                  await supabase
                    .from('platform_logs')
                    .insert({
                      action: 'whatsapp_auto_sync_success',
                      entity_type: 'whatsapp_instance',
                      entity_id: instance.instance_id,
                      details: {
                        workspace_id: instance.workspace_id,
                        phone: instance.phone,
                        plan_type: subscription.plan_type,
                        synced_at: new Date().toISOString()
                      }
                    });
                  
                  results.autoSynced++;
                  results.stillActive++;
                  results.details.push({
                    instanceId: instance.instance_id,
                    phone: instance.phone,
                    status: 'auto_synced',
                    reason: 'subscription reactivated while connected'
                  });
                  
                  continue; // Don't mark as expired
                }
              }
            }
            
            console.log(`[check-instance-subscriptions] Auto-sync failed for instance ${instance.instance_id}`);
            
            // FIX: Se tem plano válido E está conectado, NÃO marcar como expired
            await supabase
              .from('platform_logs')
              .insert({
                action: 'whatsapp_subscription_sync_skipped',
                entity_type: 'whatsapp_instance',
                entity_id: instance.instance_id,
                details: {
                  workspace_id: instance.workspace_id,
                  phone: instance.phone,
                  plan_type: subscription.plan_type,
                  reason: 'auto_sync_failed_but_connected_with_valid_plan'
                }
              });

            results.stillActive++;
            results.details.push({
              instanceId: instance.instance_id,
              phone: instance.phone,
              status: 'connected_sync_skipped',
              subscribed: isSubscribed,
              plan_type: subscription.plan_type
            });

            continue; // Não cair no bloco de expiração
          }
          
          // Mark as expired (apenas quando NÃO tem plano válido)
          await supabase
            .from('whatsapp_instances')
            .update({ 
              status: 'expired',
              subscribed: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', instance.id);
          
          // Notify workspace members
          const { data: members } = await supabase
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', instance.workspace_id);
          
          for (const member of members || []) {
            const { data: recentNotif } = await supabase
              .from('user_notifications')
              .select('id')
              .eq('user_id', member.user_id)
              .eq('type', 'whatsapp_expired')
              .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .limit(1)
              .maybeSingle();
            
            if (!recentNotif) {
              await supabase
                .from('user_notifications')
                .insert({
                  user_id: member.user_id,
                  title: '⚠️ WhatsApp Expirado',
                  body: `Sua conexão WhatsApp${instance.phone ? ` (${instance.phone})` : ''} expirou na Z-API. Reconecte para continuar usando a automação.`,
                  url: '/whatsapp',
                  type: 'whatsapp_expired'
                });
            }
          }
          
          await supabase
            .from('platform_logs')
            .insert({
              action: 'whatsapp_subscription_expired_detected',
              entity_type: 'whatsapp_instance',
              entity_id: instance.instance_id,
              details: {
                workspace_id: instance.workspace_id,
                phone: instance.phone,
                connected: isConnected,
                subscribed: isSubscribed,
                detected_at: new Date().toISOString()
              }
            });
          
          results.expired++;
          results.details.push({
            instanceId: instance.instance_id,
            phone: instance.phone,
            status: 'expired',
            reason: 'connected but not subscribed'
          });
        } else if (!isConnected) {
          // Update status if disconnected
          if (instance.status !== 'disconnected') {
            await supabase
              .from('whatsapp_instances')
              .update({ 
                status: 'disconnected',
                updated_at: new Date().toISOString()
              })
              .eq('id', instance.id);
          }
          
          results.details.push({
            instanceId: instance.instance_id,
            phone: instance.phone,
            status: 'disconnected'
          });
        } else {
          // Instance is connected and subscribed - update subscribed field
          if (instance.subscribed !== true) {
            await supabase
              .from('whatsapp_instances')
              .update({ 
                subscribed: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', instance.id);
          }
          
          results.stillActive++;
          results.details.push({
            instanceId: instance.instance_id,
            phone: instance.phone,
            status: 'active'
          });
        }
      } catch (instanceError) {
        console.error(`[check-instance-subscriptions] Error processing instance ${instance.instance_id}:`, instanceError);
        results.errors++;
      }
    }

    console.log('[check-instance-subscriptions] Check completed:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      ...results,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[check-instance-subscriptions] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZAPI_PARTNER_API = 'https://api.z-api.io/instances/integrator/on-demand';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const PARTNER_TOKEN = Deno.env.get('ZAPI_PARTNER_TOKEN');
    if (!PARTNER_TOKEN) {
      throw new Error('ZAPI_PARTNER_TOKEN not configured');
    }

    // Z-API Account security token (Client-Token header)
    const CLIENT_TOKEN = Deno.env.get('ZAPI_USER_TOKEN');
    if (!CLIENT_TOKEN) {
      throw new Error('ZAPI_USER_TOKEN not configured (Client-Token)');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const body = req.method === 'POST' ? await req.json() : {};

    // Support both workspace_id (for create/list) and instance_db_id (for specific instance actions)
    const workspaceId = body.workspace_id || url.searchParams.get('workspace_id');
    const instanceDbId = body.instance_db_id || url.searchParams.get('instance_db_id');

    console.log(`Z-API Partners action: ${action}, workspace: ${workspaceId}, instance_db_id: ${instanceDbId}`);

    // Helper function to get instance by database ID with retry
    const getInstanceById = async (dbId: string, retryCount = 0): Promise<any> => {
      console.log(`[getInstanceById] Looking up instance (attempt ${retryCount + 1})`);

      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('id', dbId)
        .single();

      if (error) {
        // Log error internally but don't expose details
        console.error(`[getInstanceById] DB error:`, error.code);

        // Retry up to 2 times for transient errors
        if (retryCount < 2 && (error.code === 'PGRST116' || error.code === 'PGRST301')) {
          console.log(`[getInstanceById] Retrying in 500ms...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          return getInstanceById(dbId, retryCount + 1);
        }

        // Return generic error message without internal details
        throw new Error('Instance not found');
      }

      if (!data) {
        console.error(`[getInstanceById] No data returned`);

        // Retry up to 2 times
        if (retryCount < 2) {
          console.log(`[getInstanceById] Retrying in 500ms...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          return getInstanceById(dbId, retryCount + 1);
        }

        throw new Error('Instance not found');
      }

      console.log(`[getInstanceById] Found instance, status: ${data.status}`);
      return data;
    };

    switch (action) {
      case 'create': {
        if (!workspaceId) {
          throw new Error('workspace_id is required for create action');
        }

        // === VALIDAÇÃO DE SUBSCRIPTION - IMPEDE CRIAÇÃO SEM PLANO VÁLIDO ===
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .select('plan_type, status, trial_ends_at, current_period_end')
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (subError) {
          console.error('[create] Error fetching subscription:', subError);
          return new Response(JSON.stringify({
            success: false,
            error: 'SUBSCRIPTION_ERROR',
            message: 'Erro ao verificar plano. Tente novamente.'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!subscription) {
          console.log(`[create] No subscription found for workspace ${workspaceId}`);
          return new Response(JSON.stringify({
            success: false,
            error: 'NO_SUBSCRIPTION',
            message: 'Nenhum plano encontrado. Assine um plano para criar conexões.'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Verificar se trial expirou
        if (subscription.plan_type === 'trial') {
          const trialEndsAt = subscription.trial_ends_at
            ? new Date(subscription.trial_ends_at).getTime()
            : 0;
          const now = Date.now();

          if (trialEndsAt < now) {
            console.log(`[create] Trial expired for workspace ${workspaceId}`);
            return new Response(JSON.stringify({
              success: false,
              error: 'TRIAL_EXPIRED',
              message: 'Seu período de teste expirou. Assine um plano para criar novas conexões.'
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        // Verificar status bloqueantes (expired, canceled, overdue, past_due)
        const blockedStatuses = ['expired', 'canceled', 'overdue', 'past_due'];
        if (blockedStatuses.includes(subscription.status)) {
          console.log(`[create] Subscription blocked (${subscription.status}) for workspace ${workspaceId}`);
          return new Response(JSON.stringify({
            success: false,
            error: 'SUBSCRIPTION_BLOCKED',
            message: subscription.status === 'overdue' || subscription.status === 'past_due'
              ? 'Seu pagamento está pendente. Regularize para criar novas conexões.'
              : 'Seu plano está expirado ou cancelado. Assine um plano para continuar.'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Verificar limite de conexões por plano
        const { count: currentConnections } = await supabase
          .from('whatsapp_instances')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId);

        const planLimits: Record<string, number> = {
          trial: 1,
          start: 1,
          pro: 3,
          business: 10
        };

        const maxConnections = planLimits[subscription.plan_type] || 1;

        if ((currentConnections || 0) >= maxConnections) {
          console.log(`[create] Connection limit reached for workspace ${workspaceId} (${currentConnections}/${maxConnections})`);
          return new Response(JSON.stringify({
            success: false,
            error: 'CONNECTION_LIMIT',
            message: `Limite de ${maxConnections} conexão(ões) atingido. Faça upgrade para adicionar mais.`
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // === FIM DA VALIDAÇÃO DE SUBSCRIPTION ===

        // Webhook URL for all events
        const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/zapi-webhook`;
        console.log('Creating instance with webhook URL:', webhookUrl);

        // Create new instance via Z-API Partners API with webhooks configured
        const createResponse = await fetch(ZAPI_PARTNER_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PARTNER_TOKEN}`,
          },
          body: JSON.stringify({
            name: `autozap-${workspaceId.substring(0, 8)}-${Date.now()}`,
            // Configure all webhooks during creation
            deliveryCallbackUrl: webhookUrl,
            receivedCallbackUrl: webhookUrl,
            disconnectedCallbackUrl: webhookUrl,
            connectedCallbackUrl: webhookUrl,
            messageStatusCallbackUrl: webhookUrl,
            presenceChatCallbackUrl: webhookUrl,
          })
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error('Z-API Partners create error:', createResponse.status, errorText);
          throw new Error(`Failed to create instance: ${createResponse.status} - ${errorText}`);
        }

        const instanceData = await createResponse.json();
        console.log('Instance created with webhooks:', JSON.stringify(instanceData, null, 2));

        const instanceId = instanceData.id || instanceData.instanceId;
        const instanceToken = instanceData.token || instanceData.instanceToken;

        if (!instanceId || !instanceToken) {
          console.error('Invalid response from Z-API:', instanceData);
          throw new Error('Invalid response from Z-API Partners');
        }

        // Save instance to database with selective mode by default
        // This prevents AI from responding to everyone before configuration
        const { data: savedInstance, error: insertError } = await supabase
          .from('whatsapp_instances')
          .insert({
            workspace_id: workspaceId,
            instance_id: instanceId,
            instance_token: instanceToken,
            status: 'disconnected',
            ai_mode: 'selective'
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error saving instance:', insertError);
          throw insertError;
        }

        console.log('Instance saved to database:', savedInstance.id);

        // Enable notifySentByMe so messages sent from WhatsApp appear in Autozap
        try {
          const updateWebhookUrl = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/update-webhook-received`;
          const updateResponse = await fetch(updateWebhookUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': CLIENT_TOKEN,
            },
            body: JSON.stringify({
              value: webhookUrl,
              notifySentByMe: true,
            }),
          });
          const updateResult = await updateResponse.text();
          console.log(`[create] update-webhook-received (notifySentByMe): status=${updateResponse.status}, response=${updateResult}`);
        } catch (webhookUpdateError) {
          // Non-blocking: instance was created successfully, webhook update can be retried
          console.warn('[create] Failed to enable notifySentByMe:', webhookUpdateError);
        }

        return new Response(JSON.stringify({
          success: true,
          instance: savedInstance
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'list': {
        if (!workspaceId) {
          throw new Error('workspace_id is required for list action');
        }

        const { data: instances, error } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        return new Response(JSON.stringify({
          instances: instances || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'status': {
        if (!instanceDbId) {
          throw new Error('instance_db_id is required for status action');
        }

        const instance = await getInstanceById(instanceDbId);

        const statusUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/status`;

        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'Client-Token': CLIENT_TOKEN,
          },
        });

        if (!statusResponse.ok) {
          console.error('Status check failed:', statusResponse.status);
          return new Response(JSON.stringify({
            connected: false,
            error: 'Failed to check status'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const statusData = await statusResponse.json();
        const isConnected = statusData.connected === true || statusData.status === 'connected';
        const phone = statusData.phone || statusData.smartphoneConnected?.phone;

        // CRITICAL: Check subscription status from Z-API response
        // FIX: Use strict equality - Z-API returns undefined/null during trial period
        let isSubscribed = statusData.subscribed === true;
        console.log(`[status] Instance ${instance.instance_id} - connected: ${isConnected}, subscribed: ${isSubscribed}`);

        // IMPORTANT: If the instance is physically connected but not subscribed,
        // and the workspace has a VALID subscription (paid OR valid trial), try to subscribe automatically.
        // This prevents the UI from showing "Offline/Expired" while the WhatsApp session is still connected.
        let hasValidSubscription = false;
        if (isConnected && !isSubscribed) {
          const { data: subscription, error: subError } = await supabase
            .from('subscriptions')
            .select('plan_type, status, trial_ends_at')
            .eq('workspace_id', instance.workspace_id)
            .maybeSingle();

          if (subError) {
            console.warn('[status] Error fetching subscription for auto-subscribe:', subError);
          }

          // FIX: Consider valid trial as active subscription (trial_ends_at in the future)
          if (subscription?.status === 'active') {
            if (subscription.plan_type === 'trial') {
              // Trial is valid only if trial_ends_at is in the future
              const trialEndsAt = subscription.trial_ends_at
                ? new Date(subscription.trial_ends_at).getTime()
                : 0;
              hasValidSubscription = trialEndsAt > Date.now();
              console.log(`[status] Trial subscription check: trial_ends_at=${subscription.trial_ends_at}, valid=${hasValidSubscription}`);
            } else {
              // Paid plans are always valid if status is active
              hasValidSubscription = true;
            }
          }

          // Only attempt auto-subscribe for PAID plans (not trials - they don't need Z-API subscription)
          if (hasValidSubscription && subscription?.plan_type !== 'trial') {
            console.log(`[status] Workspace has active paid plan (${subscription?.plan_type}). Attempting to subscribe instance...`);

            const subscribeUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/integrator/on-demand/subscription`;
            const subscribeResponse = await fetch(subscribeUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PARTNER_TOKEN}`,
              },
            });

            const subscribeText = await subscribeResponse.text().catch(() => '');
            let subscribeData = {};
            try {
              subscribeData = JSON.parse(subscribeText);
            } catch { }

            // Check if already subscribed (Z-API returns error but instance is actually paid)
            const isAlreadyPaidResponse = subscribeText.toLowerCase().includes('already') &&
              subscribeText.toLowerCase().includes('paid');

            if (subscribeResponse.ok || subscribeResponse.status === 201 || isAlreadyPaidResponse) {
              if (isAlreadyPaidResponse) {
                console.log(`[status] Instance ${instance.instance_id} already has paid subscription, marking as subscribed`);
                isSubscribed = true;
              } else {
                console.log(`[status] Subscribe request accepted for ${instance.instance_id}. Verifying...`);
                // Wait for propagation
                await new Promise((r) => setTimeout(r, 1500));

                const verifyResponse = await fetch(statusUrl, {
                  method: 'GET',
                  headers: { 'Client-Token': CLIENT_TOKEN },
                });

                if (verifyResponse.ok) {
                  const verifyData = await verifyResponse.json();
                  isSubscribed = verifyData.subscribed === true;
                  console.log(`[status] After auto-subscribe: subscribed=${isSubscribed}`);
                }
              }
            } else {
              console.warn(`[status] Auto-subscribe failed (status ${subscribeResponse.status}):`, subscribeText.substring(0, 200));
            }
          }
        }

        // ANTI-FRAUDE ROBUSTO: Verificar no phone_registry (tabela permanente)
        if (isConnected && phone) {
          // Verificar se o número já está registrado para OUTRO workspace
          const { data: existingRegistry } = await supabase
            .from('phone_registry')
            .select('id, workspace_id, first_connected_at')
            .eq('phone', phone)
            .maybeSingle();

          if (existingRegistry && existingRegistry.workspace_id !== instance.workspace_id) {
            console.log(`⚠️ BLOQUEIO PERMANENTE: Número ${phone} registrado no workspace ${existingRegistry.workspace_id} desde ${existingRegistry.first_connected_at}`);

            // Desconectar a instância automaticamente
            const disconnectUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/disconnect`;
            await fetch(disconnectUrl, { method: 'GET', headers: { 'Client-Token': CLIENT_TOKEN } });

            // Marcar como bloqueado no banco
            await supabase
              .from('whatsapp_instances')
              .update({ status: 'blocked', phone: phone })
              .eq('id', instance.id);

            // Registrar tentativa de fraude no phone_registry
            await supabase
              .from('phone_registry')
              .update({
                blocked_at: new Date().toISOString(),
                blocked_reason: `Tentativa de uso por outro workspace: ${instance.workspace_id}`
              })
              .eq('id', existingRegistry.id);

            return new Response(JSON.stringify({
              connected: false,
              blocked: true,
              reason: 'Este número de WhatsApp já está vinculado a outra conta. Não é possível utilizá-lo em uma conta diferente.',
              phone: phone
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Se chegou aqui, registrar/atualizar o número no phone_registry
          if (!existingRegistry) {
            // Primeiro uso do número - registrar
            console.log(`📝 Registrando número ${phone} para workspace ${instance.workspace_id}`);
            await supabase
              .from('phone_registry')
              .insert({
                phone: phone,
                workspace_id: instance.workspace_id,
                first_connected_at: new Date().toISOString(),
                last_connected_at: new Date().toISOString()
              });
          } else {
            // Reconexão do mesmo workspace - atualizar last_connected_at
            console.log(`🔄 Atualizando last_connected_at para número ${phone}`);
            await supabase
              .from('phone_registry')
              .update({ last_connected_at: new Date().toISOString() })
              .eq('id', existingRegistry.id);
          }
        }

        // Update instance status in database
        // FIX: Always save phone when available, not just when status changes
        // Also track subscription status from Z-API
        const needsStatusUpdate = isConnected !== (instance.status === 'connected');
        const needsPhoneUpdate = isConnected && phone && instance.phone !== phone;
        const needsSubscribedUpdate = instance.subscribed !== isSubscribed;

        // Determine if instance should be marked as expired.
        // Only mark as expired if it is connected but NOT subscribed AND the workspace doesn't have a valid subscription (paid OR valid trial).
        // FIX: Valid trials should NOT be marked as expired, they just don't need Z-API subscription yet
        const shouldMarkExpired = isConnected && !isSubscribed && !hasValidSubscription;

        if (needsStatusUpdate || needsPhoneUpdate || needsSubscribedUpdate || shouldMarkExpired) {
          const updateData: Record<string, any> = {
            updated_at: new Date().toISOString()
          };

          // Handle status based on subscription state
          if (shouldMarkExpired) {
            updateData.status = 'expired';
            updateData.subscribed = false;
            console.log(`[status] 🚨 Instance ${instance.instance_id} is connected but NOT subscribed - marking as expired`);
          } else if (needsStatusUpdate) {
            updateData.status = isConnected ? 'connected' : 'disconnected';
            updateData.connected_at = isConnected ? new Date().toISOString() : null;
          }

          // Update subscribed field
          if (needsSubscribedUpdate && !shouldMarkExpired) {
            updateData.subscribed = isSubscribed;
          }

          // Always update phone if we have a valid value and instance is connected
          if (isConnected && phone) {
            updateData.phone = phone;
            // Ensure connected_at is set if not already
            if (!instance.connected_at && !updateData.connected_at) {
              updateData.connected_at = new Date().toISOString();
            }
          }

          if (Object.keys(updateData).length > 0) {
            console.log(`[status] Updating instance ${instance.id}:`, JSON.stringify(updateData));
            await supabase
              .from('whatsapp_instances')
              .update(updateData)
              .eq('id', instance.id);
          }
        }

        // ALERT SYSTEM: Verify phone was saved correctly after connection
        if (isConnected && phone) {
          const { data: verifyInstance } = await supabase
            .from('whatsapp_instances')
            .select('id, phone, workspace_id, instance_id')
            .eq('id', instance.id)
            .single();

          if (!verifyInstance?.phone) {
            // CRITICAL: Phone should have been saved but wasn't!
            console.error(`🚨 ALERT: Instance ${instance.id} connected with phone ${phone} but phone was NOT saved to database!`);

            // Log to platform_logs for admin visibility
            await supabase
              .from('platform_logs')
              .insert({
                action: 'whatsapp_phone_save_failed',
                entity_type: 'whatsapp_instance',
                entity_id: instance.id,
                details: {
                  instance_id: instance.instance_id,
                  workspace_id: instance.workspace_id,
                  expected_phone: phone,
                  actual_phone: verifyInstance?.phone || null,
                  timestamp: new Date().toISOString()
                }
              });

            // Force update as fallback
            console.log(`🔄 Attempting force update of phone for instance ${instance.id}`);
            const { error: forceUpdateError } = await supabase
              .from('whatsapp_instances')
              .update({ phone: phone })
              .eq('id', instance.id);

            if (forceUpdateError) {
              console.error(`❌ Force update failed:`, forceUpdateError);
            } else {
              console.log(`✅ Force update succeeded for instance ${instance.id}`);
            }
          } else {
            console.log(`✅ Phone ${phone} verified saved for instance ${instance.id}`);
          }
        }

        // FIX: Return positive response for valid subscriptions (paid OR valid trial)
        if (isConnected && !isSubscribed) {
          if (hasValidSubscription) {
            return new Response(JSON.stringify({
              connected: true,
              subscribed: false,
              phone: phone,
              instanceId: instance.instance_id,
              needsSubscriptionSync: true,
              reason: 'Sua conexão está ativa, mas a assinatura ainda não foi reconhecida. Tente reiniciar/sincronizar.'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({
            connected: false,
            expired: true,
            phone: phone,
            instanceId: instance.instance_id,
            reason: 'Sua instância WhatsApp expirou na Z-API. Por favor, exclua e crie uma nova conexão.',
            needsRecreate: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          connected: isConnected,
          phone: phone,
          instanceId: instance.instance_id,
          subscribed: isSubscribed
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'qrcode': {
        if (!instanceDbId) {
          throw new Error('instance_db_id is required for qrcode action');
        }

        const instance = await getInstanceById(instanceDbId);

        const qrUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/qr-code/image`;

        console.log('Fetching QR code from:', qrUrl);

        const qrResponse = await fetch(qrUrl, {
          method: 'GET',
          headers: {
            'Client-Token': CLIENT_TOKEN,
          },
        });

        console.log('QR Response status:', qrResponse.status);
        const contentType = qrResponse.headers.get('content-type') || '';
        console.log('QR Response content-type:', contentType);

        if (!qrResponse.ok) {
          const errorText = await qrResponse.text();
          console.error('QR code fetch failed:', qrResponse.status, errorText);

          // Detect expired/unsubscribed instance error
          const errorLower = errorText.toLowerCase();
          const isExpiredError = qrResponse.status === 400 &&
            (errorLower.includes('subscribe') ||
              errorLower.includes('expired') ||
              errorLower.includes('instance not found') ||
              errorLower.includes('not active') ||
              errorLower.includes('inactive'));

          if (isExpiredError) {
            console.log('[qrcode] Instance expired/inactive, signaling recreation needed');
            return new Response(JSON.stringify({
              value: null,
              error: 'INSTANCE_EXPIRED',
              message: 'Instância expirada. Recriando automaticamente...',
              needsRecreate: true,
              instanceId: instance.instance_id,
              instanceDbId: instance.id
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({
            value: null,
            error: `QR code not available: ${qrResponse.status}`,
            instanceId: instance.instance_id
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Handle binary image response
        if (contentType.includes('image')) {
          console.log('QR Response is binary image');
          const arrayBuffer = await qrResponse.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          const dataUrl = `data:${contentType};base64,${base64}`;

          return new Response(JSON.stringify({
            value: dataUrl,
            instanceId: instance.instance_id
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Handle JSON response
        const responseText = await qrResponse.text();
        console.log('QR Response body (first 500 chars):', responseText.substring(0, 500));

        try {
          const qrData = JSON.parse(responseText);
          console.log('Parsed QR data keys:', Object.keys(qrData));

          // Check all possible field names
          const qrValue = qrData.value || qrData.image || qrData.qrcode ||
            qrData.qr || qrData.base64 || qrData.data || qrData.qrCode;

          return new Response(JSON.stringify({
            value: qrValue,
            instanceId: instance.instance_id,
            raw: !qrValue ? qrData : undefined
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (parseError) {
          console.error('Failed to parse QR response as JSON:', parseError);
          // If it's not JSON and not image, return the raw text (might be base64)
          return new Response(JSON.stringify({
            value: responseText.startsWith('data:') ? responseText : null,
            error: 'Unexpected response format',
            instanceId: instance.instance_id
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'disconnect': {
        console.log('[disconnect] Starting disconnect action for instance_db_id:', instanceDbId);

        if (!instanceDbId) {
          console.error('[disconnect] Missing instance_db_id');
          throw new Error('instance_db_id is required for disconnect action');
        }

        const instance = await getInstanceById(instanceDbId);
        console.log('[disconnect] Found instance:', instance.instance_id);

        // Z-API disconnect uses GET method, not POST
        const disconnectUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/disconnect`;
        console.log('[disconnect] Calling Z-API disconnect URL with GET method');

        const disconnectResponse = await fetch(disconnectUrl, {
          method: 'GET',
          headers: {
            'Client-Token': CLIENT_TOKEN,
          },
        });

        console.log('[disconnect] Z-API response status:', disconnectResponse.status);
        const disconnectData = await disconnectResponse.text();
        console.log('[disconnect] Z-API response body:', disconnectData);

        if (!disconnectResponse.ok) {
          console.error('[disconnect] Z-API disconnect failed');
          throw new Error(`Failed to disconnect from Z-API: ${disconnectResponse.status}`);
        }

        const { error: dbError } = await supabase
          .from('whatsapp_instances')
          .update({
            status: 'disconnected',
            phone: null,
            connected_at: null
          })
          .eq('id', instance.id);

        if (dbError) {
          console.error('[disconnect] Database update error:', dbError);
          throw new Error('Failed to update database');
        }

        console.log('[disconnect] Database updated successfully');

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'restart': {
        if (!instanceDbId) {
          throw new Error('instance_db_id is required for restart action');
        }

        const instance = await getInstanceById(instanceDbId);

        // Z-API restart uses GET method
        const restartUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/restart`;

        const restartResponse = await fetch(restartUrl, {
          method: 'GET',
          headers: {
            'Client-Token': CLIENT_TOKEN,
          },
        });

        console.log('[restart] Z-API response status:', restartResponse.status);

        if (!restartResponse.ok) {
          throw new Error(`Failed to restart: ${restartResponse.status}`);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'phone-code': {
        if (!instanceDbId) {
          throw new Error('instance_db_id is required for phone-code action');
        }

        const phone = body.phone;
        if (!phone) {
          throw new Error('phone is required for phone-code action');
        }

        const instance = await getInstanceById(instanceDbId);

        // Format phone to E.164 (remove non-digits, ensure country code)
        let formattedPhone = phone.replace(/\D/g, '');
        if (!formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }

        console.log(`[phone-code] Requesting pairing code for phone ${formattedPhone}, instance ${instance.instance_id}`);

        const phoneCodeUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/phone-code/${formattedPhone}`;

        const phoneCodeResponse = await fetch(phoneCodeUrl, {
          method: 'GET',
          headers: {
            'Client-Token': CLIENT_TOKEN,
          },
        });

        console.log('[phone-code] Z-API response status:', phoneCodeResponse.status);
        const responseText = await phoneCodeResponse.text();
        console.log('[phone-code] Z-API response body:', responseText);

        if (!phoneCodeResponse.ok) {
          // Check for specific error cases
          const errorLower = responseText.toLowerCase();
          const isExpiredError = phoneCodeResponse.status === 400 &&
            (errorLower.includes('subscribe') ||
              errorLower.includes('expired') ||
              errorLower.includes('instance not found') ||
              errorLower.includes('not active') ||
              errorLower.includes('inactive'));

          if (isExpiredError) {
            return new Response(JSON.stringify({
              success: false,
              error: 'INSTANCE_EXPIRED',
              message: 'Instância expirada. Recriando automaticamente...',
              needsRecreate: true
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({
            success: false,
            error: `Failed to get phone code: ${phoneCodeResponse.status}`,
            details: responseText
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          const codeData = JSON.parse(responseText);
          console.log('[phone-code] Parsed response:', codeData);

          // Z-API returns the code in different field names
          const code = codeData.code || codeData.value || codeData.phoneCode;

          if (!code) {
            return new Response(JSON.stringify({
              success: false,
              error: 'No code returned from Z-API',
              raw: codeData
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({
            success: true,
            code: code,
            phone: formattedPhone,
            expiresIn: 180 // Code typically expires in ~3 minutes
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (parseError) {
          console.error('[phone-code] Parse error:', parseError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to parse Z-API response',
            raw: responseText
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'delete': {
        if (!instanceDbId) {
          throw new Error('instance_db_id is required for delete action');
        }

        const instance = await getInstanceById(instanceDbId);

        // Delete from Z-API
        const deleteUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/delete`;

        await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Client-Token': CLIENT_TOKEN,
          },
        });

        // Delete from database
        await supabase
          .from('whatsapp_instances')
          .delete()
          .eq('id', instance.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'mobile-check-availability': {
        if (!instanceDbId) {
          throw new Error('instance_db_id is required for mobile-check-availability action');
        }

        const phone = body.phone;
        const ddi = body.ddi || '55';

        if (!phone) {
          throw new Error('phone is required for mobile-check-availability action');
        }

        const instance = await getInstanceById(instanceDbId);

        // Clean phone number (remove non-digits)
        const cleanPhone = phone.replace(/\D/g, '');

        console.log(`[mobile-check-availability] Checking availability for DDI ${ddi}, phone ${cleanPhone}`);

        const checkUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/mobile/registration-available`;

        const checkResponse = await fetch(checkUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': CLIENT_TOKEN,
          },
          body: JSON.stringify({ ddi, phone: cleanPhone })
        });

        console.log('[mobile-check-availability] Z-API response status:', checkResponse.status);
        const responseText = await checkResponse.text();
        console.log('[mobile-check-availability] Z-API response body:', responseText);

        if (!checkResponse.ok) {
          // Check for specific error cases
          return new Response(JSON.stringify({
            success: false,
            available: false,
            error: `Failed to check availability: ${checkResponse.status}`,
            details: responseText
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          const data = JSON.parse(responseText);
          console.log('[mobile-check-availability] Parsed response:', data);

          return new Response(JSON.stringify({
            success: true,
            available: data.available ?? false,
            blocked: data.blocked ?? false,
            appealToken: data.appealToken || null,
            smsWaitSeconds: data.smsWaitSeconds ?? 0,
            voiceWaitSeconds: data.voiceWaitSeconds ?? 0,
            waOldWaitSeconds: data.waOldWaitSeconds ?? 0,
            waOldEligible: data.waOldEligible ?? false,
            reason: data.reason || null
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (parseError) {
          console.error('[mobile-check-availability] Parse error:', parseError);
          return new Response(JSON.stringify({
            success: false,
            available: false,
            error: 'Failed to parse Z-API response',
            raw: responseText
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'mobile-request-code': {
        if (!instanceDbId) {
          throw new Error('instance_db_id is required for mobile-request-code action');
        }

        const phone = body.phone;
        const ddi = body.ddi || '55';
        const method = body.method || 'sms'; // sms, voice, wa_old

        if (!phone) {
          throw new Error('phone is required for mobile-request-code action');
        }

        const instance = await getInstanceById(instanceDbId);
        const cleanPhone = phone.replace(/\D/g, '');

        console.log(`[mobile-request-code] Requesting code via ${method} for DDI ${ddi}, phone ${cleanPhone}`);

        const requestUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/mobile/request-registration-code`;

        const requestResponse = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': CLIENT_TOKEN,
          },
          body: JSON.stringify({ ddi, phone: cleanPhone, method })
        });

        console.log('[mobile-request-code] Z-API response status:', requestResponse.status);
        const responseText = await requestResponse.text();
        console.log('[mobile-request-code] Z-API response body:', responseText);

        if (!requestResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to request code: ${requestResponse.status}`,
            details: responseText
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          const data = JSON.parse(responseText);
          console.log('[mobile-request-code] Parsed response:', data);

          return new Response(JSON.stringify({
            success: true,
            captcha: data.captcha || null, // If captcha required, returns base64 image
            blocked: data.blocked ?? false,
            retryAfter: data.retryAfter ?? 0,
            smsWaitSeconds: data.smsWaitSeconds ?? 0,
            voiceWaitSeconds: data.voiceWaitSeconds ?? 0,
            waOldWaitSeconds: data.waOldWaitSeconds ?? 0,
            method: data.method || method,
            codeSent: !data.captcha && !data.blocked
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (parseError) {
          console.error('[mobile-request-code] Parse error:', parseError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to parse Z-API response',
            raw: responseText
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'mobile-respond-captcha': {
        if (!instanceDbId) {
          throw new Error('instance_db_id is required for mobile-respond-captcha action');
        }

        const captcha = body.captcha;

        if (!captcha) {
          throw new Error('captcha is required for mobile-respond-captcha action');
        }

        const instance = await getInstanceById(instanceDbId);

        console.log(`[mobile-respond-captcha] Responding to captcha`);

        const captchaUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/mobile/respond-captcha`;

        const captchaResponse = await fetch(captchaUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': CLIENT_TOKEN,
          },
          body: JSON.stringify({ captcha })
        });

        console.log('[mobile-respond-captcha] Z-API response status:', captchaResponse.status);
        const responseText = await captchaResponse.text();
        console.log('[mobile-respond-captcha] Z-API response body:', responseText);

        if (!captchaResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to respond captcha: ${captchaResponse.status}`,
            details: responseText
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          const data = JSON.parse(responseText);
          return new Response(JSON.stringify({
            success: data.success ?? true,
            codeSent: data.success ?? true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch {
          // If response is empty or not JSON, assume success
          return new Response(JSON.stringify({
            success: true,
            codeSent: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'mobile-confirm-code': {
        if (!instanceDbId) {
          throw new Error('instance_db_id is required for mobile-confirm-code action');
        }

        const code = body.code;

        if (!code) {
          throw new Error('code is required for mobile-confirm-code action');
        }

        const instance = await getInstanceById(instanceDbId);

        console.log(`[mobile-confirm-code] Confirming registration code`);

        const confirmUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/mobile/confirm-registration-code`;

        const confirmResponse = await fetch(confirmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': CLIENT_TOKEN,
          },
          body: JSON.stringify({ code })
        });

        console.log('[mobile-confirm-code] Z-API response status:', confirmResponse.status);
        const responseText = await confirmResponse.text();
        console.log('[mobile-confirm-code] Z-API response body:', responseText);

        if (!confirmResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to confirm code: ${confirmResponse.status}`,
            details: responseText
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          const data = JSON.parse(responseText);
          console.log('[mobile-confirm-code] Parsed response:', data);

          // If successful, update instance status
          if (data.success !== false) {
            // Check if PIN is required
            if (data.confirmSecurityCode) {
              return new Response(JSON.stringify({
                success: true,
                needsPin: true,
                connected: false
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }

            // Registration complete - update instance
            const phone = body.registeredPhone;
            await supabase
              .from('whatsapp_instances')
              .update({
                status: 'connected',
                connected_at: new Date().toISOString(),
                phone: phone || null
              })
              .eq('id', instance.id);

            return new Response(JSON.stringify({
              success: true,
              needsPin: false,
              connected: true
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({
            success: false,
            error: data.error || 'Code verification failed'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (parseError) {
          console.error('[mobile-confirm-code] Parse error:', parseError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to parse Z-API response',
            raw: responseText
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'mobile-confirm-pin': {
        if (!instanceDbId) {
          throw new Error('instance_db_id is required for mobile-confirm-pin action');
        }

        const code = body.code;

        if (!code) {
          throw new Error('code (PIN) is required for mobile-confirm-pin action');
        }

        const instance = await getInstanceById(instanceDbId);

        console.log(`[mobile-confirm-pin] Confirming PIN code`);

        const pinUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/mobile/confirm-pin-code`;

        const pinResponse = await fetch(pinUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': CLIENT_TOKEN,
          },
          body: JSON.stringify({ code })
        });

        console.log('[mobile-confirm-pin] Z-API response status:', pinResponse.status);
        const responseText = await pinResponse.text();
        console.log('[mobile-confirm-pin] Z-API response body:', responseText);

        if (!pinResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to confirm PIN: ${pinResponse.status}`,
            details: responseText
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          const data = JSON.parse(responseText);
          console.log('[mobile-confirm-pin] Parsed response:', data);

          if (data.success !== false) {
            // PIN confirmed - update instance
            const phone = body.registeredPhone;
            await supabase
              .from('whatsapp_instances')
              .update({
                status: 'connected',
                connected_at: new Date().toISOString(),
                phone: phone || null
              })
              .eq('id', instance.id);

            return new Response(JSON.stringify({
              success: true,
              connected: true
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({
            success: false,
            error: data.error || 'PIN verification failed'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch {
          // Assume success if no JSON response
          const phone = body.registeredPhone;
          await supabase
            .from('whatsapp_instances')
            .update({
              status: 'connected',
              connected_at: new Date().toISOString(),
              phone: phone || null
            })
            .eq('id', instance.id);

          return new Response(JSON.stringify({
            success: true,
            connected: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'mobile-save-state': {
        if (!instanceDbId) {
          throw new Error('instance_db_id is required for mobile-save-state action');
        }

        const state = body.state;

        if (!state) {
          throw new Error('state is required for mobile-save-state action');
        }

        console.log(`[mobile-save-state] Saving registration state for instance ${instanceDbId}`);

        // Add expiresAt if not present (30 minutes from now)
        if (!state.expiresAt) {
          state.expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        }
        if (!state.startedAt) {
          state.startedAt = new Date().toISOString();
        }

        const { error: updateError } = await supabase
          .from('whatsapp_instances')
          .update({ mobile_registration_state: state })
          .eq('id', instanceDbId);

        if (updateError) {
          console.error('[mobile-save-state] Error:', updateError);
          throw updateError;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        if (!instanceDbId) {
          throw new Error('instance_db_id is required for delete action');
        }

        console.log(`[delete] Deleting instance ${instanceDbId}`);

        // 1. Fetch instance details to get Z-API IDs
        const instance = await getInstanceById(instanceDbId);

        // 2. Cancel on Z-API if it has Z-API credentials
        if (instance.instance_id && instance.instance_token) {
          const cancelUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/integrator/on-demand/cancel`;
          console.log(`[delete] Canceling Z-API instance: ${instance.instance_id}`);

          try {
            const cancelResponse = await fetch(cancelUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Client-Token': CLIENT_TOKEN,
              },
            });

            if (!cancelResponse.ok) {
              const errorText = await cancelResponse.text();
              console.warn(`[delete] Z-API cancel warning (status ${cancelResponse.status}):`, errorText);
              // We continue even if Z-API fails, as the instance might already be gone there
            } else {
              console.log(`[delete] Z-API instance canceled successfully`);
            }
          } catch (cancelError) {
            console.error(`[delete] Z-API cancel fetch error:`, cancelError);
          }
        }

        // 3. Delete from Supabase
        const { error: deleteError } = await supabase
          .from('whatsapp_instances')
          .delete()
          .eq('id', instanceDbId);

        if (deleteError) {
          console.error('[delete] Supabase delete error:', deleteError);
          throw deleteError;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error in zapi-partners:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

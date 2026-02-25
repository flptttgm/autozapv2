import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

// Asaas webhook IPs - these are the only IPs that should send webhooks
const ASAAS_WEBHOOK_IPS = [
  '34.193.227.108',
  '54.173.136.53',
  '54.224.206.110',
  '54.167.72.161',
  '18.213.72.49',
  '34.195.231.70',
];

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
const ASAAS_BASE_URL = 'https://api.asaas.com/v3';

// Validate webhook request from Asaas
// SECURITY: Strict validation - reject unverified requests
const validateAsaasWebhook = (req: Request): { valid: boolean; reason?: string } => {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   req.headers.get('cf-connecting-ip') ||
                   req.headers.get('x-real-ip');
  
  // Check if IP is in Asaas whitelist
  if (clientIp && ASAAS_WEBHOOK_IPS.includes(clientIp)) {
    console.log(`[asaas-webhook] Valid IP: ${clientIp}`);
    return { valid: true, reason: 'ip_verified' };
  }
  
  // Fallback: Check access token header
  const accessToken = req.headers.get('asaas-access-token');
  const expectedToken = Deno.env.get('ASAAS_API_KEY');
  
  if (accessToken && expectedToken && accessToken === expectedToken) {
    console.log('[asaas-webhook] Valid access token');
    return { valid: true, reason: 'token_verified' };
  }
  
  // SECURITY FIX: Reject unverified requests instead of proceeding
  console.error(`[asaas-webhook] SECURITY: Rejected unverified request from IP: ${clientIp || 'unknown'}`);
  return { valid: false, reason: 'unauthorized' };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const validation = validateAsaasWebhook(req);
    if (!validation.valid) {
      console.error('[asaas-webhook] SECURITY: Invalid webhook request rejected');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    
    if (!payload || typeof payload !== 'object') {
      console.error('[asaas-webhook] Invalid payload structure');
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Asaas webhook received:', JSON.stringify(payload, null, 2));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const event = payload.event;
    const payment = payload.payment;
    const subscription = payload.subscription;
    
    if (!event) {
      console.error('[asaas-webhook] Missing event field');
      return new Response(JSON.stringify({ error: 'Missing event' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing Asaas event: ${event}`);
    if (payment) console.log(`Payment ID: ${payment?.id}, Status: ${payment?.status}`);
    if (subscription) console.log(`Subscription ID: ${subscription?.id}, Status: ${subscription?.status}`);

    // Helper function to update payment history
    const updatePaymentHistory = async (paymentId: string, updates: Record<string, any>) => {
      const { error } = await supabase
        .from('payments_history')
        .update(updates)
        .eq('asaas_payment_id', paymentId);
      
      if (error) {
        console.error('Error updating payment history:', error);
      } else {
        console.log('Payment history updated successfully');
      }
    };

    // Helper function to create recurring subscription after first PIX/Boleto payment
    const createRecurringSubscription = async (workspaceId: string, customerId: string, planType: string, billingCycle: string, value: number, billingType: string) => {
      if (!ASAAS_API_KEY) {
        console.error('ASAAS_API_KEY not configured');
        return null;
      }

      // Calculate next due date
      const nextDueDate = new Date();
      if (billingCycle === 'annual') {
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      } else {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      }

      const headers = {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      };

      try {
        const response = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            customer: customerId,
            billingType: billingType,
            value: value,
            nextDueDate: nextDueDate.toISOString().split('T')[0],
            cycle: billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY',
            description: `Plano ${planType} - ${billingCycle === 'annual' ? 'Anual' : 'Mensal'} (Renovação automática)`,
            externalReference: workspaceId,
          }),
        });

        const result = await response.json();
        
        if (result.errors) {
          console.error('Error creating recurring subscription:', result.errors);
          return null;
        }

        console.log('Recurring subscription created:', result.id);
        return result.id;
      } catch (error) {
        console.error('Failed to create recurring subscription:', error);
        return null;
      }
    };

    // Helper function to activate subscription
    const activateSubscription = async (workspaceId: string, planType: string, billingCycle: string, asaasSubscriptionId?: string) => {
      const now = new Date();
      const periodEnd = new Date(now);
      
      if (billingCycle === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const connectionLimits: Record<string, number> = {
        'start': 1,
        'pro': 3,
        'business': 10,
      };

      const updateData: Record<string, any> = {
        status: 'active',
        plan_type: planType,
        billing_cycle: billingCycle,
        connections_limit: connectionLimits[planType] || 1,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        trial_ends_at: null,
      };

      if (asaasSubscriptionId) {
        updateData.asaas_subscription_id = asaasSubscriptionId;
      }

      const { error } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('workspace_id', workspaceId);

      if (error) {
        console.error('Error activating subscription:', error);
      } else {
        console.log(`Subscription activated for workspace: ${workspaceId}`);
        await sendPlanNotifications(workspaceId, planType, billingCycle, connectionLimits[planType] || 1);
      }
    };

    // Helper function to renew subscription period
    const renewSubscriptionPeriod = async (workspaceId: string, billingCycle: string) => {
      const now = new Date();
      const periodEnd = new Date(now);
      
      if (billingCycle === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // Update subscription period
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .eq('workspace_id', workspaceId);

      if (error) {
        console.error('Error renewing subscription period:', error);
        return false;
      }

      console.log(`Subscription period renewed for workspace: ${workspaceId}`);
      
      // Reactivate any expired WhatsApp instances
      await reactivateWhatsAppInstances(workspaceId);
      
      return true;
    };

    // Helper function to reactivate WhatsApp instances
    const reactivateWhatsAppInstances = async (workspaceId: string) => {
      try {
        const CLIENT_TOKEN = Deno.env.get('ZAPI_USER_TOKEN');
        
        // Get expired or trial_expired instances for this workspace
        const { data: instances, error } = await supabase
          .from('whatsapp_instances')
          .select('id, instance_id, instance_token, status')
          .eq('workspace_id', workspaceId)
          .in('status', ['expired', 'trial_expired']);

        if (error || !instances?.length) {
          console.log('[reactivateInstances] No expired/trial_expired instances to reactivate');
          return;
        }

        console.log(`[reactivateInstances] Found ${instances.length} expired/trial_expired instance(s) to reactivate`);

        for (const instance of instances) {
          // Update status to disconnected (user will need to reconnect via phone code)
          await supabase
            .from('whatsapp_instances')
            .update({ status: 'disconnected' })
            .eq('id', instance.id);

          console.log(`[reactivateInstances] Instance ${instance.instance_id} reactivated (status: disconnected) - user can now reconnect via phone code`);
        }
      } catch (error) {
        console.error('[reactivateInstances] Error:', error);
      }
    };

    // Helper function to send notifications for plan activation
    const sendPlanNotifications = async (workspaceId: string, planType: string, billingCycle: string, connections: number) => {
      try {
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('owner_id, name')
          .eq('id', workspaceId)
          .single();

        if (!workspace) {
          console.error('Workspace not found for plan notifications');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', workspace.owner_id)
          .single();

        const { data: userData } = await supabase.auth.admin.getUserById(workspace.owner_id);
        const ownerEmail = userData?.user?.email;
        const ownerName = profile?.full_name || 'Cliente';
        const planName = planType.charAt(0).toUpperCase() + planType.slice(1);
        const cycleText = billingCycle === 'annual' ? 'anual' : 'mensal';

        // Create in-app notification
        await supabase.from('user_notifications').insert({
          user_id: workspace.owner_id,
          title: '🎉 Plano Ativado com Sucesso!',
          body: `Seu plano ${planName} foi ativado. Você tem ${connections} conexão(ões) de WhatsApp disponível(is).`,
          url: '/whatsapp',
          type: 'payment',
        });

        // Send email
        if (ownerEmail) {
          const resendApiKey = Deno.env.get('RESEND_API_KEY');
          if (resendApiKey) {
            const resend = new Resend(resendApiKey);
            await resend.emails.send({
              from: 'AutoZap <noreply@autozap.com.br>',
              to: [ownerEmail],
              subject: `🎉 Plano ${planName} Ativado! - AutoZap`,
              html: `
                <!DOCTYPE html>
                <html>
                <body style="font-family: sans-serif; padding: 20px; background: #f4f4f5;">
                  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px;">
                    <h1 style="color: #10b981;">🎉 Plano Ativado!</h1>
                    <p>Olá, <strong>${ownerName}</strong>!</p>
                    <p>Seu plano <strong>${planName}</strong> foi ativado com sucesso.</p>
                    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <p style="margin: 0;"><strong>Plano:</strong> ${planName}</p>
                      <p style="margin: 8px 0 0;"><strong>Ciclo:</strong> ${cycleText}</p>
                      <p style="margin: 8px 0 0;"><strong>Conexões:</strong> ${connections}</p>
                    </div>
                    <a href="https://app.autozap.com.br/whatsapp" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                      Conectar WhatsApp
                    </a>
                  </div>
                </body>
                </html>
              `,
            });
          }
        }
      } catch (error) {
        console.error('Error sending plan notifications:', error);
      }
    };

    // Helper function to send renewal notifications
    const sendRenewalNotifications = async (workspaceId: string, planType: string, billingCycle: string) => {
      try {
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('owner_id, name')
          .eq('id', workspaceId)
          .single();

        if (!workspace) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', workspace.owner_id)
          .single();

        const { data: userData } = await supabase.auth.admin.getUserById(workspace.owner_id);
        const ownerEmail = userData?.user?.email;
        const ownerName = profile?.full_name || 'Cliente';
        const planName = planType.charAt(0).toUpperCase() + planType.slice(1);

        // Create in-app notification
        await supabase.from('user_notifications').insert({
          user_id: workspace.owner_id,
          title: '✅ Assinatura Renovada!',
          body: `Seu plano ${planName} foi renovado automaticamente. Obrigado por continuar conosco!`,
          url: '/settings',
          type: 'payment',
        });

        // Send email
        if (ownerEmail) {
          const resendApiKey = Deno.env.get('RESEND_API_KEY');
          if (resendApiKey) {
            const resend = new Resend(resendApiKey);
            await resend.emails.send({
              from: 'AutoZap <noreply@autozap.com.br>',
              to: [ownerEmail],
              subject: `✅ Assinatura Renovada - AutoZap`,
              html: `
                <!DOCTYPE html>
                <html>
                <body style="font-family: sans-serif; padding: 20px; background: #f4f4f5;">
                  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px;">
                    <h1 style="color: #10b981;">✅ Assinatura Renovada!</h1>
                    <p>Olá, <strong>${ownerName}</strong>!</p>
                    <p>Sua assinatura do plano <strong>${planName}</strong> foi renovada automaticamente com sucesso.</p>
                    <p>Obrigado por continuar usando o AutoZap!</p>
                    <a href="https://app.autozap.com.br/settings" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px;">
                      Ver Detalhes
                    </a>
                  </div>
                </body>
                </html>
              `,
            });
          }
        }
      } catch (error) {
        console.error('Error sending renewal notifications:', error);
      }
    };

    // Helper function to subscribe Z-API instances after payment
    const subscribeWorkspaceInstances = async (workspaceId: string) => {
      try {
        const PARTNER_TOKEN = Deno.env.get('ZAPI_PARTNER_TOKEN');
        const CLIENT_TOKEN = Deno.env.get('ZAPI_USER_TOKEN');
        
        if (!PARTNER_TOKEN || !CLIENT_TOKEN) {
          console.error('[subscribeInstances] Missing Z-API tokens');
          return;
        }

        const { data: instances, error } = await supabase
          .from('whatsapp_instances')
          .select('id, instance_id, instance_token, subscribed')
          .eq('workspace_id', workspaceId);

        if (error || !instances?.length) {
          console.log('[subscribeInstances] No instances found for workspace:', workspaceId);
          return;
        }

        for (const instance of instances) {
          if (instance.subscribed) continue;

          const subscribeUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/integrator/on-demand/subscription`;
          
          const response = await fetch(subscribeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': CLIENT_TOKEN,
            },
          });

          if (response.ok || response.status === 201) {
            await supabase
              .from('whatsapp_instances')
              .update({ subscribed: true, subscribed_at: new Date().toISOString() })
              .eq('id', instance.id);
            console.log(`[subscribeInstances] Instance ${instance.instance_id} subscribed`);
          }
        }
      } catch (error) {
        console.error('[subscribeInstances] Error:', error);
      }
    };

    // Helper function to register a seller sale
    const registerSellerSale = async (
      workspaceId: string,
      sellerCode: string,
      paymentId: string,
      planType: string,
      billingCycle: string,
      saleValue: number
    ) => {
      try {
        console.log(`[seller] Attempting to register sale for seller code: ${sellerCode}`);
        
        // Find seller by referral code
        const { data: seller, error: sellerError } = await supabase
          .from('sellers')
          .select('id, installation_fee')
          .eq('referral_code', sellerCode)
          .eq('status', 'active')
          .maybeSingle();

        if (sellerError || !seller) {
          console.log(`[seller] No active seller found with code: ${sellerCode}`);
          return;
        }

        // Insert sale record
        const { error: saleError } = await supabase
          .from('seller_sales')
          .insert({
            seller_id: seller.id,
            workspace_id: workspaceId,
            payment_id: paymentId,
            plan_type: planType,
            billing_cycle: billingCycle,
            sale_value: saleValue,
            commission_value: seller.installation_fee,
            commission_status: 'pending',
          });

        if (saleError) {
          console.error('[seller] Error inserting sale:', saleError);
          return;
        }

        // Update seller stats
        const { error: statsError } = await supabase.rpc('increment_seller_stats', {
          p_seller_id: seller.id,
          p_commission: seller.installation_fee,
        });

        if (statsError) {
          console.error('[seller] Error updating seller stats:', statsError);
        } else {
          console.log(`[seller] Sale registered for seller ${sellerCode}, commission: R$${seller.installation_fee}`);
        }
      } catch (error) {
        console.error('[seller] Error registering seller sale:', error);
      }
    };

    // Helper function to add extra connection
    const addExtraConnection = async (workspaceId: string) => {
      const { data: sub, error: fetchError } = await supabase
        .from('subscriptions')
        .select('connections_extra')
        .eq('workspace_id', workspaceId)
        .single();

      if (fetchError) return;

      const newExtra = (sub?.connections_extra || 0) + 1;

      await supabase
        .from('subscriptions')
        .update({ connections_extra: newExtra })
        .eq('workspace_id', workspaceId);

      console.log(`Extra connection added for workspace: ${workspaceId}. Total: ${newExtra}`);
    };

    // Helper to send payment issue notifications
    const sendPaymentIssueNotifications = async (workspaceId: string, issueType: 'overdue' | 'failed' | 'refunded' | 'chargeback') => {
      try {
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('owner_id, name')
          .eq('id', workspaceId)
          .single();

        if (!workspace) return;

        const titles = {
          overdue: '⚠️ Pagamento Atrasado',
          failed: '❌ Pagamento Recusado',
          refunded: 'ℹ️ Pagamento Estornado',
          chargeback: '🚨 Contestação de Pagamento',
        };

        const bodies = {
          overdue: 'Seu pagamento está atrasado. Regularize para manter o acesso.',
          failed: 'Seu pagamento foi recusado. Verifique os dados e tente novamente.',
          refunded: 'Seu pagamento foi estornado.',
          chargeback: 'Uma contestação foi aberta. Entre em contato urgente.',
        };

        await supabase.from('user_notifications').insert({
          user_id: workspace.owner_id,
          title: titles[issueType],
          body: bodies[issueType],
          url: '/plans',
          type: 'payment',
        });
      } catch (error) {
        console.error('Error sending payment issue notifications:', error);
      }
    };

    // Handle different webhook events
    switch (event) {
      // ========== SUBSCRIPTION EVENTS ==========
      case 'SUBSCRIPTION_CREATED': {
        console.log('Subscription created:', subscription?.id);
        
        if (subscription?.externalReference) {
          // Save subscription ID to database
          await supabase
            .from('subscriptions')
            .update({ asaas_subscription_id: subscription.id })
            .eq('workspace_id', subscription.externalReference);
          
          console.log(`Asaas subscription ${subscription.id} linked to workspace ${subscription.externalReference}`);
        }
        break;
      }

      case 'SUBSCRIPTION_UPDATED': {
        console.log('Subscription updated:', subscription?.id);
        // Update any relevant subscription data if needed
        break;
      }

      case 'SUBSCRIPTION_CANCELED': {
        console.log('Subscription cancelled:', subscription?.id);
        
        // Find workspace by subscription ID
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('workspace_id')
          .eq('asaas_subscription_id', subscription?.id)
          .single();

        if (sub) {
          await supabase
            .from('subscriptions')
            .update({ 
              asaas_subscription_id: null,
              // Keep status as active until period ends
            })
            .eq('workspace_id', sub.workspace_id);
          
          console.log(`Subscription cancelled for workspace: ${sub.workspace_id}`);
        }
        break;
      }

      case 'SUBSCRIPTION_PAYMENT_CREATED': {
        console.log('Subscription payment created for subscription:', subscription?.id);
        // A new payment was created for the subscription - this is the renewal payment
        break;
      }

      case 'SUBSCRIPTION_PAYMENT_CONFIRMED':
      case 'SUBSCRIPTION_PAYMENT_RECEIVED': {
        console.log(`Subscription payment ${event === 'SUBSCRIPTION_PAYMENT_CONFIRMED' ? 'confirmed' : 'received'}:`, payment?.id);
        
        // This is a RENEWAL payment from the subscription
        // Find the subscription in our database
        const { data: dbSubscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('asaas_subscription_id', subscription?.id)
          .single();

        if (dbSubscription) {
          // Renew the subscription period
          const renewed = await renewSubscriptionPeriod(
            dbSubscription.workspace_id, 
            dbSubscription.billing_cycle || 'monthly'
          );

          if (renewed) {
            // Save payment in history
            await supabase.from('payments_history').insert({
              workspace_id: dbSubscription.workspace_id,
              asaas_payment_id: payment.id,
              asaas_subscription_id: subscription.id,
              billing_type: payment.billingType || 'CREDIT_CARD',
              value: payment.value,
              status: 'CONFIRMED',
              plan_type: dbSubscription.plan_type,
              billing_cycle: dbSubscription.billing_cycle || 'monthly',
              paid_at: new Date().toISOString(),
            });

            // Send renewal notification
            await sendRenewalNotifications(
              dbSubscription.workspace_id,
              dbSubscription.plan_type,
              dbSubscription.billing_cycle || 'monthly'
            );

            // Subscribe Z-API instances
            await subscribeWorkspaceInstances(dbSubscription.workspace_id);
          }
        }
        break;
      }

      case 'SUBSCRIPTION_PAYMENT_OVERDUE': {
        console.log('Subscription payment overdue:', payment?.id);
        
        const { data: dbSub } = await supabase
          .from('subscriptions')
          .select('workspace_id')
          .eq('asaas_subscription_id', subscription?.id)
          .single();

        if (dbSub) {
          await supabase
            .from('subscriptions')
            .update({ status: 'overdue' })
            .eq('workspace_id', dbSub.workspace_id);
          
          await sendPaymentIssueNotifications(dbSub.workspace_id, 'overdue');
        }
        break;
      }

      // ========== PAYMENT EVENTS ==========
      case 'PAYMENT_CREATED':
        console.log('Payment created:', payment.id);
        await updatePaymentHistory(payment.id, { status: payment.status });
        break;

      case 'PAYMENT_AWAITING_RISK_ANALYSIS':
        await updatePaymentHistory(payment.id, { status: 'AWAITING_RISK_ANALYSIS' });
        break;

      case 'PAYMENT_APPROVED_BY_RISK_ANALYSIS':
        await updatePaymentHistory(payment.id, { status: 'APPROVED_BY_RISK_ANALYSIS' });
        break;

      case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS': {
        await updatePaymentHistory(payment.id, { status: 'REPROVED' });
        
        const { data: reprovedPayment } = await supabase
          .from('payments_history')
          .select('workspace_id')
          .eq('asaas_payment_id', payment.id)
          .single();

        if (reprovedPayment) {
          await sendPaymentIssueNotifications(reprovedPayment.workspace_id, 'failed');
        }
        break;
      }

      case 'PAYMENT_UPDATED':
        await updatePaymentHistory(payment.id, { status: payment.status });
        break;

      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        console.log(`Payment ${event === 'PAYMENT_CONFIRMED' ? 'confirmed' : 'received'}:`, payment.id);
        
        await updatePaymentHistory(payment.id, { 
          status: event === 'PAYMENT_CONFIRMED' ? 'CONFIRMED' : 'RECEIVED',
          paid_at: new Date().toISOString(),
        });

        const { data: paymentHistory } = await supabase
          .from('payments_history')
          .select('*')
          .eq('asaas_payment_id', payment.id)
          .single();

        let workspaceIdForSubscription: string | null = null;

        if (paymentHistory) {
          workspaceIdForSubscription = paymentHistory.workspace_id;
          
          // ========== CREDITS PURCHASE ==========
          if (paymentHistory.purchase_type === 'credits' && paymentHistory.credits_amount) {
            console.log(`[credits] Adding ${paymentHistory.credits_amount} credits to workspace ${paymentHistory.workspace_id}`);
            
            // Add credits to workspace
            const { error: creditError } = await supabase.rpc('add_prospect_credits', {
              p_workspace_id: paymentHistory.workspace_id,
              p_amount: paymentHistory.credits_amount,
              p_action: 'purchase',
              p_description: `Compra de ${paymentHistory.credits_amount} créditos`,
            });
            
            if (creditError) {
              console.error('[credits] Error adding credits:', creditError);
            } else {
              console.log(`[credits] Successfully added ${paymentHistory.credits_amount} credits`);
              
              // Send notification
              const { data: workspace } = await supabase
                .from('workspaces')
                .select('owner_id')
                .eq('id', paymentHistory.workspace_id)
                .single();
              
              if (workspace) {
                await supabase.from('user_notifications').insert({
                  user_id: workspace.owner_id,
                  title: '🎉 Créditos Adicionados!',
                  body: `${paymentHistory.credits_amount} créditos de prospecção foram adicionados à sua conta.`,
                  url: '/leads/prospect',
                  type: 'payment',
                });
              }
            }
          } else if (paymentHistory.plan_type === 'connection') {
            await addExtraConnection(paymentHistory.workspace_id);
          } else if (paymentHistory.purchase_type !== 'credits') {
            // First-time payment - activate subscription
            await activateSubscription(
              paymentHistory.workspace_id,
              paymentHistory.plan_type,
              paymentHistory.billing_cycle
            );

            // ========== CREDIT REFERRER ==========
            // Check if this workspace was referred and credit the referrer
            try {
              const { data: credited } = await supabase.rpc('credit_referrer', {
                _referred_workspace_id: paymentHistory.workspace_id,
                _credit_amount: 50.00
              });
              
              if (credited) {
                console.log(`[referral] Credited R$50 to referrer for workspace: ${paymentHistory.workspace_id}`);
                
                // Send notification to referrer
                const { data: referral } = await supabase
                  .from('referrals')
                  .select('referrer_workspace_id')
                  .eq('referred_workspace_id', paymentHistory.workspace_id)
                  .eq('status', 'completed')
                  .single();
                
                if (referral) {
                  const { data: referrerWorkspace } = await supabase
                    .from('workspaces')
                    .select('owner_id')
                    .eq('id', referral.referrer_workspace_id)
                    .single();
                  
                  if (referrerWorkspace) {
                    await supabase.from('user_notifications').insert({
                      user_id: referrerWorkspace.owner_id,
                      title: '🎉 Indicação Concluída!',
                      body: 'Parabéns! Uma pessoa que você indicou assinou um plano. R$50 foram adicionados ao seu saldo.',
                      url: '/settings',
                      type: 'referral',
                    });
                  }
                }
              } else {
                console.log(`[referral] No pending referral found for workspace: ${paymentHistory.workspace_id}`);
              }
            } catch (refError) {
              console.error('[referral] Error crediting referrer:', refError);
            }
            // ========== END CREDIT REFERRER ==========

            // For PIX/Boleto, create recurring subscription for future payments
            if (payment.billingType === 'PIX' || payment.billingType === 'BOLETO') {
              // Get customer ID
              const { data: customer } = await supabase
                .from('asaas_customers')
                .select('asaas_customer_id')
                .eq('workspace_id', paymentHistory.workspace_id)
                .single();

              if (customer) {
                const asaasSubId = await createRecurringSubscription(
                  paymentHistory.workspace_id,
                  customer.asaas_customer_id,
                  paymentHistory.plan_type,
                  paymentHistory.billing_cycle,
                  Number(paymentHistory.value),
                  payment.billingType
                );

                if (asaasSubId) {
                  await supabase
                    .from('subscriptions')
                    .update({ asaas_subscription_id: asaasSubId })
                    .eq('workspace_id', paymentHistory.workspace_id);
                }
              }
            }
          }
        } else if (payment.externalReference) {
          workspaceIdForSubscription = payment.externalReference;
          
          const isConnectionPurchase = payment.description?.toLowerCase().includes('conexão extra');
          
          if (isConnectionPurchase) {
            await addExtraConnection(payment.externalReference);
          } else {
            const planMatch = payment.description?.match(/Plano (\w+)/i);
            const planType = planMatch ? planMatch[1].toLowerCase() : 'start';
            const billingCycle = payment.description?.includes('Anual') ? 'annual' : 'monthly';
            
            await activateSubscription(payment.externalReference, planType, billingCycle);
            
            // Credit referrer for external reference payments too
            try {
              const { data: credited } = await supabase.rpc('credit_referrer', {
                _referred_workspace_id: payment.externalReference,
                _credit_amount: 50.00
              });
              if (credited) {
                console.log(`[referral] Credited R$50 to referrer for workspace: ${payment.externalReference}`);
              }
            } catch (refError) {
              console.error('[referral] Error crediting referrer:', refError);
            }
          }
        }

        // ========== SELLER SALE TRACKING ==========
        // Check if there's a seller code in the externalReference
        const externalRef = payment.externalReference || '';
        const sellerMatch = externalRef.match(/seller:([A-Z0-9]+)/i);
        if (sellerMatch && workspaceIdForSubscription) {
          const sellerCode = sellerMatch[1].toUpperCase();
          
          // Get payment info for the sale record
          let planType = 'start';
          let billingCycle = 'monthly';
          
          if (paymentHistory) {
            planType = paymentHistory.plan_type || 'start';
            billingCycle = paymentHistory.billing_cycle || 'monthly';
          } else {
            // Extract from payment description if no history
            const planMatch = payment.description?.match(/Plano (\w+)/i);
            planType = planMatch ? planMatch[1].toLowerCase() : 'start';
            billingCycle = payment.description?.includes('Anual') ? 'annual' : 'monthly';
          }

          await registerSellerSale(
            workspaceIdForSubscription,
            sellerCode,
            payment.id,
            planType,
            billingCycle,
            payment.value
          );
        }
        // ========== END SELLER SALE TRACKING ==========

        if (workspaceIdForSubscription) {
          await subscribeWorkspaceInstances(workspaceIdForSubscription);
        }
        break;
      }

      case 'PAYMENT_OVERDUE': {
        await updatePaymentHistory(payment.id, { status: 'OVERDUE' });
        
        const { data: overduePayment } = await supabase
          .from('payments_history')
          .select('workspace_id')
          .eq('asaas_payment_id', payment.id)
          .single();

        if (overduePayment) {
          await supabase
            .from('subscriptions')
            .update({ status: 'overdue' })
            .eq('workspace_id', overduePayment.workspace_id);
          
          await sendPaymentIssueNotifications(overduePayment.workspace_id, 'overdue');
        }
        break;
      }

      case 'PAYMENT_DELETED':
        await updatePaymentHistory(payment.id, { status: 'DELETED' });
        break;

      case 'PAYMENT_RESTORED':
        await updatePaymentHistory(payment.id, { status: payment.status });
        break;

      case 'PAYMENT_REFUNDED': {
        await updatePaymentHistory(payment.id, { status: 'REFUNDED' });
        
        const { data: refundedPayment } = await supabase
          .from('payments_history')
          .select('workspace_id')
          .eq('asaas_payment_id', payment.id)
          .single();

        if (refundedPayment) {
          await supabase
            .from('subscriptions')
            .update({ 
              status: 'cancelled',
              plan_type: 'trial',
            })
            .eq('workspace_id', refundedPayment.workspace_id);
          
          await sendPaymentIssueNotifications(refundedPayment.workspace_id, 'refunded');
        }
        break;
      }

      case 'PAYMENT_CHARGEBACK_REQUESTED': {
        await updatePaymentHistory(payment.id, { status: 'CHARGEBACK_REQUESTED' });
        
        const { data: chargebackPayment } = await supabase
          .from('payments_history')
          .select('workspace_id')
          .eq('asaas_payment_id', payment.id)
          .single();

        if (chargebackPayment) {
          await sendPaymentIssueNotifications(chargebackPayment.workspace_id, 'chargeback');
        }
        break;
      }

      case 'PAYMENT_ANTICIPATED':
      case 'PAYMENT_RECEIVED_IN_CASH_UNDONE':
      case 'PAYMENT_CHARGEBACK_DISPUTE':
      case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL':
      case 'PAYMENT_DUNNING_RECEIVED':
      case 'PAYMENT_DUNNING_REQUESTED':
      case 'PAYMENT_BANK_SLIP_VIEWED':
      case 'PAYMENT_CHECKOUT_VIEWED':
        console.log(`Event ${event} received for payment:`, payment?.id);
        if (payment?.id) {
          await updatePaymentHistory(payment.id, { status: payment.status || event });
        }
        break;

      default:
        console.log(`Unhandled event type: ${event}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing Asaas webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

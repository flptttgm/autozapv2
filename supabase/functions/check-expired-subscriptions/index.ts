import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://appiautozap.com";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Grace period in days before deactivating instances
const GRACE_PERIOD_DAYS = 3;

interface Subscription {
  id: string;
  workspace_id: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan_type: string;
  status: string;
}

interface WhatsAppInstance {
  id: string;
  workspace_id: string;
  instance_id: string;
  instance_token: string;
  status: string | null;
  phone: string | null;
  subscribed: boolean | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  whatsapp_number: string | null;
}

interface WorkspaceMember {
  user_id: string;
  profiles: Profile;
}

const ZAPI_BASE_URL = "https://api.z-api.io";

// Email template for grace period warning
const getGracePeriodEmailTemplate = (userName: string, daysLeft: number) => ({
  subject: `⚠️ Sua assinatura expirou - ${daysLeft} dia(s) restante(s)`,
  html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Olá ${userName || ""}!</h1>
      <p style="color: #666; font-size: 16px; line-height: 1.6;">
        Sua assinatura do <strong>Autozap</strong> expirou, mas suas conexões WhatsApp continuam funcionando por mais <strong>${daysLeft} dia(s)</strong>.
      </p>
      <p style="color: #666; font-size: 16px; line-height: 1.6;">
        Após esse período, suas instâncias serão automaticamente desativadas. Renove agora para evitar interrupções!
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${APP_URL}/plans" 
           style="background: #f59e0b; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Renovar Assinatura
        </a>
      </div>
      <p style="color: #999; font-size: 14px;">
        Precisa de ajuda? Responda este email que teremos prazer em ajudar.
      </p>
    </div>
  `,
});

// Email template for final deactivation
const getDeactivatedEmailTemplate = (userName: string) => ({
  subject: "🔒 Suas conexões WhatsApp foram desativadas",
  html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Olá ${userName || ""}!</h1>
      <p style="color: #666; font-size: 16px; line-height: 1.6;">
        O período de carência da sua assinatura do <strong>Autozap</strong> terminou e suas conexões WhatsApp foram desativadas.
      </p>
      <p style="color: #666; font-size: 16px; line-height: 1.6;">
        Seus dados continuam seguros! Renove seu plano para reativar suas conexões e continuar automatizando seu atendimento.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${APP_URL}/plans" 
           style="background: #7c3aed; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Renovar Assinatura
        </a>
      </div>
      <p style="color: #999; font-size: 14px;">
        Precisa de ajuda? Responda este email que teremos prazer em ajudar.
      </p>
    </div>
  `,
});

interface DisconnectResult {
  success: boolean;
  stillConnected: boolean;
  error?: string;
}

async function disconnectInstance(instanceId: string, instanceToken: string): Promise<DisconnectResult> {
  try {
    // First, attempt to disconnect
    const response = await fetch(
      `${ZAPI_BASE_URL}/instances/${instanceId}/token/${instanceToken}/disconnect`,
      { method: "GET" }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to disconnect instance ${instanceId}: ${response.status} - ${errorText}`);
      return { success: false, stillConnected: true, error: `HTTP ${response.status}` };
    }
    
    // Consume response body
    await response.text();
    
    // Wait 2 seconds for Z-API to propagate the disconnection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify the actual status after disconnect attempt
    try {
      const statusResponse = await fetch(
        `${ZAPI_BASE_URL}/instances/${instanceId}/token/${instanceToken}/status`,
        { method: "GET" }
      );
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const stillConnected = statusData.connected === true;
        
        if (stillConnected) {
          console.warn(`Instance ${instanceId} still connected after disconnect attempt`);
          return { success: false, stillConnected: true };
        }
        
        console.log(`Successfully disconnected instance ${instanceId} (verified)`);
        return { success: true, stillConnected: false };
      } else {
        // Could not verify - assume success but log warning
        console.warn(`Could not verify disconnect status for ${instanceId}: ${statusResponse.status}`);
        return { success: true, stillConnected: false };
      }
    } catch (statusError) {
      // Status check failed - assume disconnect worked
      console.warn(`Status check failed for ${instanceId}, assuming disconnect success:`, statusError);
      return { success: true, stillConnected: false };
    }
  } catch (error) {
    console.error(`Error disconnecting instance ${instanceId}:`, error);
    return { success: false, stillConnected: true, error: String(error) };
  }
}

function getExpirationDate(subscription: Subscription): Date | null {
  if (subscription.plan_type === "trial" && subscription.trial_ends_at) {
    return new Date(subscription.trial_ends_at);
  }
  if (subscription.current_period_end) {
    return new Date(subscription.current_period_end);
  }
  return null;
}

function getDaysSinceExpiration(expirationDate: Date, now: Date): number {
  const diffMs = now.getTime() - expirationDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    
    const results = {
      inGracePeriod: 0,
      gracePeriodNotifications: 0,
      subscriptionsExpired: 0,
      instancesDisabled: 0,
      notificationsSent: 0,
      whatsappMessagesSent: 0,
      errors: [] as string[],
    };

    console.log("[check-expired-subscriptions] Starting check at", now.toISOString());
    console.log(`[check-expired-subscriptions] Grace period: ${GRACE_PERIOD_DAYS} days`);

    // Calculate the date when grace period ends (subscriptions expired more than GRACE_PERIOD_DAYS ago)
    const gracePeriodEndDate = new Date(now.getTime() - (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));

    // 1. Find expired trial subscriptions (still active status)
    const { data: expiredTrials, error: trialError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("plan_type", "trial")
      .eq("status", "active")
      .lt("trial_ends_at", now.toISOString());

    if (trialError) {
      console.error("Error fetching expired trials:", trialError);
      results.errors.push(`Trial query error: ${trialError.message}`);
    }

    console.log(`[check-expired-subscriptions] Found ${expiredTrials?.length || 0} expired trial subscriptions`);

    // 2. Find expired paid subscriptions (still active status)
    const { data: expiredPaid, error: paidError } = await supabase
      .from("subscriptions")
      .select("*")
      .neq("plan_type", "trial")
      .eq("status", "active")
      .not("current_period_end", "is", null)
      .lt("current_period_end", now.toISOString());

    if (paidError) {
      console.error("Error fetching expired paid subscriptions:", paidError);
      results.errors.push(`Paid query error: ${paidError.message}`);
    }

    console.log(`[check-expired-subscriptions] Found ${expiredPaid?.length || 0} expired paid subscriptions`);

    // Combine all expired subscriptions
    const allExpired: Subscription[] = [
      ...(expiredTrials || []),
      ...(expiredPaid || []),
    ];

    // 3. Process each expired subscription
    for (const subscription of allExpired) {
      const expirationDate = getExpirationDate(subscription);
      if (!expirationDate) continue;

      const daysSinceExpiration = getDaysSinceExpiration(expirationDate, now);
      
      // IMPORTANT: Trial accounts have DIFFERENT behavior than paid plans:
      // - Trial: When expired, disconnect Z-API but mark instance as 'trial_expired' (user can still navigate)
      // - Paid: 3-day grace period, then mark subscription as 'expired' and instance as 'expired'
      const isTrial = subscription.plan_type === 'trial';
      const daysLeftInGrace = isTrial ? 0 : GRACE_PERIOD_DAYS - daysSinceExpiration;
      const isGracePeriodOver = isTrial || daysSinceExpiration >= GRACE_PERIOD_DAYS;

      console.log(`[check-expired-subscriptions] Workspace ${subscription.workspace_id}: plan=${subscription.plan_type}, expired ${daysSinceExpiration} days ago, grace period over: ${isGracePeriodOver}`);

      // Get workspace members for notifications
      const { data: members, error: membersError } = await supabase
        .from("workspace_members")
        .select("user_id, profiles(id, full_name, whatsapp_number)")
        .eq("workspace_id", subscription.workspace_id);

      if (membersError) {
        console.error(`Error fetching members for workspace ${subscription.workspace_id}:`, membersError);
        results.errors.push(`Members query error: ${membersError.message}`);
        continue;
      }

      // TRIAL EXPIRED: Disconnect Z-API, mark instances as 'trial_expired', but DON'T mark subscription as 'expired'
      // This allows user to still navigate the CRM
      if (isTrial) {
        console.log(`[check-expired-subscriptions] Trial expired for workspace ${subscription.workspace_id} - disconnecting instances but keeping navigation`);

        // Get all WhatsApp instances for this workspace
        const { data: instances, error: instancesError } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("workspace_id", subscription.workspace_id)
          .in("status", ["connected", "disconnected", "pending"]);

        if (instancesError) {
          console.error(`Error fetching instances for workspace ${subscription.workspace_id}:`, instancesError);
          results.errors.push(`Instances query error: ${instancesError.message}`);
          continue;
        }

        console.log(`[check-expired-subscriptions] Found ${instances?.length || 0} instances to mark as trial_expired`);

        // Disconnect and mark each instance as 'trial_expired'
        for (const instance of instances || []) {
          const typedInstance = instance as WhatsAppInstance;
          
          // Disconnect from Z-API if connected - ONLY update DB if disconnect succeeds
          if (typedInstance.status === "connected" && typedInstance.instance_id && typedInstance.instance_token) {
            const disconnectResult = await disconnectInstance(typedInstance.instance_id, typedInstance.instance_token);
            
            if (disconnectResult.stillConnected) {
              // Instance still connected - skip DB update, will retry next cycle
              console.warn(`[check-expired-subscriptions] Instance ${typedInstance.id} still connected after disconnect, will retry next cycle`);
              results.errors.push(`Instance ${typedInstance.id} still connected after disconnect attempt`);
              continue;
            }
          }

          // Update instance in database - use 'trial_expired' status (only if disconnect succeeded or wasn't connected)
          const { error: updateInstError } = await supabase
            .from("whatsapp_instances")
            .update({
              status: "trial_expired",
              updated_at: now.toISOString(),
            })
            .eq("id", typedInstance.id);

          if (updateInstError) {
            console.error(`Error updating instance ${typedInstance.id}:`, updateInstError);
            results.errors.push(`Update instance error: ${updateInstError.message}`);
          } else {
            results.instancesDisabled++;
            console.log(`[check-expired-subscriptions] Instance ${typedInstance.id} marked as trial_expired`);
          }
        }

        // Send trial expired notification (not deactivation notification)
        for (const member of members || []) {
          const typedMember = member as unknown as WorkspaceMember;
          
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
            typedMember.user_id
          );

          if (userError || !userData?.user?.email) {
            console.error(`Could not get email for user ${typedMember.user_id}`);
            continue;
          }

          const userName = typedMember.profiles?.full_name || "";
          const email = userData.user.email;

          // Create in-app notification
          await supabase
            .from("user_notifications")
            .insert({
              user_id: typedMember.user_id,
              title: "Período de teste expirado",
              body: "Seu período de teste terminou e suas automações foram pausadas. Assine um plano para reativar.",
              type: "trial_expired",
              url: "/plans",
            });

          // Send email notification
          try {
            await resend.emails.send({
              from: "Autozap <noreply@appiautozap.com>",
              to: [email],
              subject: "⏰ Seu período de teste expirou - Autozap",
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #333;">Olá ${userName || ""}!</h1>
                  <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    Seu período de teste do <strong>Autozap</strong> terminou e suas automações de WhatsApp foram pausadas.
                  </p>
                  <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    Você ainda pode acessar o sistema, ver seus leads e conversas, mas as automações de IA não funcionarão até você assinar um plano.
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${APP_URL}/plans" 
                       style="background: #f59e0b; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                      Escolher um Plano
                    </a>
                  </div>
                  <p style="color: #999; font-size: 14px;">
                    Precisa de ajuda? Responda este email que teremos prazer em ajudar.
                  </p>
                </div>
              `,
            });
            
            results.notificationsSent++;
            console.log(`[check-expired-subscriptions] Sent trial expired email to ${email}`);
          } catch (emailError) {
            console.error(`Failed to send email to ${email}:`, emailError);
            results.errors.push(`Email error: ${email}`);
          }

          // Send WhatsApp trial expired message via Appi Company
          const whatsappNumber = typedMember.profiles?.whatsapp_number;
          if (whatsappNumber) {
            // Get workspace name
            const { data: workspace } = await supabase
              .from("workspaces")
              .select("name")
              .eq("id", subscription.workspace_id)
              .maybeSingle();

            try {
              const sendWhatsAppResponse = await fetch(
                `${supabaseUrl}/functions/v1/send-welcome-whatsapp`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseServiceKey}`
                  },
                  body: JSON.stringify({
                    phone: whatsappNumber,
                    userName: userName || "",
                    userEmail: email,
                    userWorkspaceId: subscription.workspace_id,
                    userWorkspaceName: workspace?.name || "Workspace",
                    messageType: "trial_expired"
                  })
                }
              );

              if (sendWhatsAppResponse.ok) {
                const whatsappResult = await sendWhatsAppResponse.json();
                if (!whatsappResult.skipped) {
                  results.whatsappMessagesSent++;
                  console.log(`[check-expired-subscriptions] Sent WhatsApp trial_expired to ${whatsappNumber}`);
                } else {
                  console.log(`[check-expired-subscriptions] WhatsApp trial_expired skipped for ${whatsappNumber}: ${whatsappResult.skipped}`);
                }
              } else {
                const errorText = await sendWhatsAppResponse.text();
                console.error(`[check-expired-subscriptions] Failed WhatsApp to ${whatsappNumber}: ${errorText}`);
              }
            } catch (whatsappError) {
              console.error(`[check-expired-subscriptions] WhatsApp error for ${whatsappNumber}:`, whatsappError);
            }
          }
        }

        continue; // Move to next subscription
      }

      // PAID PLAN: Grace period logic
      if (isGracePeriodOver) {
        // Grace period is over - deactivate instances
        console.log(`[check-expired-subscriptions] Grace period over for workspace ${subscription.workspace_id} - deactivating instances`);

        // Update subscription status to 'expired'
        const { error: updateSubError } = await supabase
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("id", subscription.id);

        if (updateSubError) {
          console.error(`Error updating subscription ${subscription.id}:`, updateSubError);
          results.errors.push(`Update subscription error: ${updateSubError.message}`);
          continue;
        }

        results.subscriptionsExpired++;
        console.log(`[check-expired-subscriptions] Marked subscription ${subscription.id} as expired`);

        // Get all WhatsApp instances for this workspace
        const { data: instances, error: instancesError } = await supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("workspace_id", subscription.workspace_id)
          .in("status", ["connected", "disconnected", "pending"]);

        if (instancesError) {
          console.error(`Error fetching instances for workspace ${subscription.workspace_id}:`, instancesError);
          results.errors.push(`Instances query error: ${instancesError.message}`);
          continue;
        }

        console.log(`[check-expired-subscriptions] Found ${instances?.length || 0} instances to deactivate`);

        // Disconnect and disable each instance
        for (const instance of instances || []) {
          const typedInstance = instance as WhatsAppInstance;
          
          // Disconnect from Z-API if connected - ONLY update DB if disconnect succeeds
          if (typedInstance.status === "connected" && typedInstance.instance_id && typedInstance.instance_token) {
            const disconnectResult = await disconnectInstance(typedInstance.instance_id, typedInstance.instance_token);
            
            if (disconnectResult.stillConnected) {
              // Instance still connected - skip DB update, will retry next cycle
              console.warn(`[check-expired-subscriptions] Instance ${typedInstance.id} still connected after disconnect, will retry next cycle`);
              results.errors.push(`Instance ${typedInstance.id} still connected after disconnect attempt`);
              continue;
            }
          }

          // Update instance in database (only if disconnect succeeded or wasn't connected)
          const { error: updateInstError } = await supabase
            .from("whatsapp_instances")
            .update({
              status: "expired",
              phone: null,
              updated_at: now.toISOString(),
            })
            .eq("id", typedInstance.id);

          if (updateInstError) {
            console.error(`Error updating instance ${typedInstance.id}:`, updateInstError);
            results.errors.push(`Update instance error: ${updateInstError.message}`);
          } else {
            results.instancesDisabled++;
            console.log(`[check-expired-subscriptions] Disabled instance ${typedInstance.id}`);
          }
        }

        // Send deactivation notifications
        for (const member of members || []) {
          const typedMember = member as unknown as WorkspaceMember;
          
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
            typedMember.user_id
          );

          if (userError || !userData?.user?.email) {
            console.error(`Could not get email for user ${typedMember.user_id}`);
            continue;
          }

          const userName = typedMember.profiles?.full_name || "";
          const email = userData.user.email;

          // Create in-app notification
          await supabase
            .from("user_notifications")
            .insert({
              user_id: typedMember.user_id,
              title: "Conexões WhatsApp desativadas",
              body: "O período de carência terminou e suas conexões WhatsApp foram desativadas. Renove seu plano para reativá-las.",
              type: "subscription_expired",
              url: "/plans",
            });

          // Send email notification
          const template = getDeactivatedEmailTemplate(userName);
          
          try {
            await resend.emails.send({
              from: "Autozap <noreply@appiautozap.com>",
              to: [email],
              subject: template.subject,
              html: template.html,
            });
            
            results.notificationsSent++;
            console.log(`[check-expired-subscriptions] Sent deactivation email to ${email}`);
          } catch (emailError) {
            console.error(`Failed to send email to ${email}:`, emailError);
            results.errors.push(`Email error: ${email}`);
          }
        }
      } else {
        // Still in grace period - send warning notification (only once per day)
        results.inGracePeriod++;
        console.log(`[check-expired-subscriptions] Workspace ${subscription.workspace_id} in grace period - ${daysLeftInGrace} days left`);

        // Check if we already sent a grace period notification today
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        for (const member of members || []) {
          const typedMember = member as unknown as WorkspaceMember;

          // Check for existing notification today
          const { data: existingNotif } = await supabase
            .from("user_notifications")
            .select("id")
            .eq("user_id", typedMember.user_id)
            .eq("type", "subscription_grace_period")
            .gte("created_at", todayStart.toISOString())
            .limit(1);

          if (existingNotif && existingNotif.length > 0) {
            console.log(`[check-expired-subscriptions] Already notified user ${typedMember.user_id} today`);
            continue;
          }

          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
            typedMember.user_id
          );

          if (userError || !userData?.user?.email) {
            console.error(`Could not get email for user ${typedMember.user_id}`);
            continue;
          }

          const userName = typedMember.profiles?.full_name || "";
          const email = userData.user.email;

          // Create in-app notification
          await supabase
            .from("user_notifications")
            .insert({
              user_id: typedMember.user_id,
              title: `Período de carência: ${daysLeftInGrace} dia(s) restante(s)`,
              body: "Sua assinatura expirou mas suas conexões continuam funcionando. Renove agora para evitar interrupções.",
              type: "subscription_grace_period",
              url: "/plans",
            });

          // Send email notification
          const template = getGracePeriodEmailTemplate(userName, daysLeftInGrace);
          
          try {
            await resend.emails.send({
              from: "Autozap <noreply@appiautozap.com>",
              to: [email],
              subject: template.subject,
              html: template.html,
            });
            
            results.gracePeriodNotifications++;
            console.log(`[check-expired-subscriptions] Sent grace period email to ${email} (${daysLeftInGrace} days left)`);
          } catch (emailError) {
            console.error(`Failed to send email to ${email}:`, emailError);
            results.errors.push(`Email error: ${email}`);
          }
        }
      }
    }

    console.log("[check-expired-subscriptions] Completed:", results);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[check-expired-subscriptions] Error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

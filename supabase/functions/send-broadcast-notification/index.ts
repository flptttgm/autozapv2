import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BroadcastRequest {
  title: string;
  body: string;
  url?: string;
  target_mode?: 'all' | 'filtered' | 'selected';
  channels?: ('in_app' | 'push' | 'email')[];
  filters?: {
    plan_type?: string;
    whatsapp_status?: string;
    onboarding_completed?: boolean;
  };
  selected_user_ids?: string[];
}

const getEmailTemplate = (title: string, body: string, url: string, userName?: string): string => {
  const ctaUrl = url.startsWith('http') ? url : `https://appiautozap.com${url}`;
  // Cores corretas da plataforma (verde WhatsApp)
  const primaryGreen = "#22c55e";
  const primaryGreenDark = "#1ca34d";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header com Logo {a}AutoZap -->
          <tr>
            <td style="background: linear-gradient(135deg, ${primaryGreen} 0%, ${primaryGreenDark} 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700;">
                <span style="color: rgba(255, 255, 255, 0.7);">{a}</span><span style="color: #ffffff;">AutoZap</span>
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${userName ? `<p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">Olá${userName ? `, ${userName}` : ''}!</p>` : ''}
              
              <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 22px; font-weight: 600; line-height: 1.4;">
                ${title}
              </h2>
              
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${body}
              </p>
              
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, ${primaryGreen} 0%, ${primaryGreenDark} 100%); box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Acessar Plataforma →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-align: center;">
                <span style="color: rgba(34, 197, 94, 0.7);">{a}</span><span style="color: #1f2937; font-weight: 600;">AutoZap</span> - Você recebeu este email porque é usuário da plataforma.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} AutoZap. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is platform admin
    const { data: adminCheck } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'platform_admin')
      .maybeSingle();

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Not authorized. Admin access required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      title, 
      body, 
      url = '/', 
      target_mode = 'all',
      channels = ['in_app', 'push'],
      filters,
      selected_user_ids 
    }: BroadcastRequest = await req.json();

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'Title and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sendEmail = channels.includes('email');
    const sendInApp = channels.includes('in_app');
    const sendPush = channels.includes('push');

    console.log(`[Broadcast] Starting notification: "${title}" by admin ${user.id}, mode: ${target_mode}, channels: ${channels.join(', ')}`);

    // Create broadcast record
    const { data: broadcast, error: broadcastError } = await supabaseAdmin
      .from('broadcast_notifications')
      .insert({
        title,
        body,
        url,
        sent_by: user.id,
        status: 'sending',
        channels
      })
      .select()
      .single();

    if (broadcastError) {
      console.error('[Broadcast] Error creating record:', broadcastError);
      throw broadcastError;
    }

    // Get ALL target users with their info
    let targetUsers: { id: string; full_name: string | null; email: string }[] = [];
    
    if (target_mode === 'all') {
      const { data: usersData } = await supabaseAdmin.rpc('get_admin_users_with_email');
      if (usersData) {
        targetUsers = usersData.map((u: any) => ({ id: u.id, full_name: u.full_name, email: u.email }));
      }
    } else if (target_mode === 'selected' && selected_user_ids && selected_user_ids.length > 0) {
      const { data: usersData } = await supabaseAdmin.rpc('get_admin_users_with_email');
      if (usersData) {
        targetUsers = usersData
          .filter((u: any) => selected_user_ids.includes(u.id))
          .map((u: any) => ({ id: u.id, full_name: u.full_name, email: u.email }));
      }
    } else if (target_mode === 'filtered' && filters) {
      const { data: usersData } = await supabaseAdmin.rpc('get_admin_users_with_email');
      
      if (usersData) {
        targetUsers = usersData
          .filter((u: any) => {
            if (filters.plan_type && u.plan_type !== filters.plan_type) return false;
            if (filters.whatsapp_status) {
              const status = u.whatsapp_connected ? 'connected' : 'disconnected';
              if (status !== filters.whatsapp_status) return false;
            }
            if (filters.onboarding_completed !== undefined && u.onboarding_completed !== filters.onboarding_completed) return false;
            return true;
          })
          .map((u: any) => ({ id: u.id, full_name: u.full_name, email: u.email }));
      }
    }

    const targetUserIds = targetUsers.map(u => u.id);
    console.log(`[Broadcast] Target users: ${targetUserIds.length}`);

    // Results tracking
    let inAppNotificationsCreated = 0;
    let successfulPushSends = 0;
    let failedPushSends = 0;
    let successfulEmailSends = 0;
    let failedEmailSends = 0;

    // Create in-app notifications
    if (sendInApp && targetUserIds.length > 0) {
      const inAppNotifications = targetUserIds.map(userId => ({
        user_id: userId,
        broadcast_id: broadcast.id,
        title,
        body,
        url,
        type: 'broadcast',
        is_read: false
      }));

      const batchSize = 100;
      for (let i = 0; i < inAppNotifications.length; i += batchSize) {
        const batch = inAppNotifications.slice(i, i + batchSize);
        const { error: inAppError } = await supabaseAdmin
          .from('user_notifications')
          .insert(batch);

        if (inAppError) {
          console.error('[Broadcast] Error creating in-app notifications batch:', inAppError);
        } else {
          inAppNotificationsCreated += batch.length;
        }
      }
      console.log(`[Broadcast] Created ${inAppNotificationsCreated} in-app notifications`);
    }

    // Handle PUSH notifications
    if (sendPush) {
      let subscriptions: any[] = [];

      if (target_mode === 'all') {
        const { data: allSubs, error: subsError } = await supabaseAdmin
          .from('push_subscriptions')
          .select('*');

        if (subsError) {
          console.error('[Broadcast] Error fetching subscriptions:', subsError);
        } else {
          subscriptions = allSubs || [];
        }
      } else if (targetUserIds.length > 0) {
        const { data: filteredSubs, error: subsError } = await supabaseAdmin
          .from('push_subscriptions')
          .select('*')
          .in('user_id', targetUserIds);

        if (subsError) {
          console.error('[Broadcast] Error fetching subscriptions:', subsError);
        } else {
          subscriptions = filteredSubs || [];
        }
      }

      console.log(`[Broadcast] Found ${subscriptions.length} push subscriptions`);

      const invalidSubscriptions: string[] = [];
      const payload = JSON.stringify({
        title,
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { url },
        tag: `broadcast-${broadcast.id}`,
      });

      for (const subscription of subscriptions) {
        try {
          const response = await fetch(subscription.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Encoding': 'aes128gcm',
              'TTL': '86400',
            },
            body: payload,
          });

          if (response.ok || response.status === 201) {
            successfulPushSends++;
          } else if (response.status === 410 || response.status === 404) {
            invalidSubscriptions.push(subscription.id);
            failedPushSends++;
          } else {
            failedPushSends++;
          }
        } catch (error) {
          failedPushSends++;
          console.error(`[Broadcast] Error sending push:`, error);
        }
      }

      if (invalidSubscriptions.length > 0) {
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .in('id', invalidSubscriptions);
        console.log(`[Broadcast] Removed ${invalidSubscriptions.length} invalid subscriptions`);
      }
      
      console.log(`[Broadcast] Push: ${successfulPushSends} sent, ${failedPushSends} failed`);
    }

    // Handle EMAIL sending
    if (sendEmail && resendApiKey && targetUsers.length > 0) {
      const resend = new Resend(resendApiKey);
      
      console.log(`[Broadcast] Sending emails to ${targetUsers.length} users`);
      
      // Send emails in batches of 10 to avoid rate limits
      const emailBatchSize = 10;
      for (let i = 0; i < targetUsers.length; i += emailBatchSize) {
        const batch = targetUsers.slice(i, i + emailBatchSize);
        
        const emailPromises = batch.map(async (targetUser) => {
          try {
            const html = getEmailTemplate(title, body, url, targetUser.full_name || undefined);
            
            const { error } = await resend.emails.send({
              from: 'Autozap <noreply@appiautozap.com>',
              to: [targetUser.email],
              subject: title,
              html,
            });

            if (error) {
              console.error(`[Broadcast] Email failed for ${targetUser.email}:`, error);
              return false;
            }
            return true;
          } catch (err) {
            console.error(`[Broadcast] Email error for ${targetUser.email}:`, err);
            return false;
          }
        });

        const results = await Promise.all(emailPromises);
        successfulEmailSends += results.filter(r => r).length;
        failedEmailSends += results.filter(r => !r).length;
        
        // Small delay between batches to respect rate limits
        if (i + emailBatchSize < targetUsers.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`[Broadcast] Email: ${successfulEmailSends} sent, ${failedEmailSends} failed`);
    } else if (sendEmail && !resendApiKey) {
      console.error('[Broadcast] Email channel selected but RESEND_API_KEY not configured');
    }

    // Update broadcast record with results
    const { error: updateError } = await supabaseAdmin
      .from('broadcast_notifications')
      .update({
        total_recipients: targetUserIds.length,
        successful_sends: inAppNotificationsCreated,
        failed_sends: targetUserIds.length - inAppNotificationsCreated,
        email_sent: successfulEmailSends,
        email_failed: failedEmailSends,
        status: 'completed'
      })
      .eq('id', broadcast.id);

    if (updateError) {
      console.error('[Broadcast] Error updating record:', updateError);
    }

    console.log(`[Broadcast] Completed: ${inAppNotificationsCreated} in-app, ${successfulPushSends} push, ${successfulEmailSends} email`);

    return new Response(
      JSON.stringify({
        success: true,
        broadcast_id: broadcast.id,
        total_recipients: targetUserIds.length,
        in_app_created: inAppNotificationsCreated,
        push_sent: successfulPushSends,
        push_failed: failedPushSends,
        email_sent: successfulEmailSends,
        email_failed: failedEmailSends,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Broadcast] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

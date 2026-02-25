import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuthErrorPayload {
  error_type: string;
  error_message: string;
  error_code: string;
  user_email?: string;
  stack_trace?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload: AuthErrorPayload = await req.json();
    const { 
      error_type, 
      error_message, 
      error_code, 
      user_email, 
      stack_trace,
      metadata 
    } = payload;

    console.log(`[auth-error-monitor] Received error: ${error_type} - ${error_code}`);

    // 1. Verificar cooldown (5 minutos) para evitar spam de alertas
    const cooldownTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentAlert } = await supabase
      .from('auth_error_alerts')
      .select('id')
      .eq('error_type', error_type)
      .eq('error_code', error_code)
      .gte('created_at', cooldownTime)
      .maybeSingle();

    if (recentAlert) {
      console.log(`[auth-error-monitor] Skipping - cooldown active for ${error_type}/${error_code}`);
      return new Response(
        JSON.stringify({ 
          skipped: true, 
          reason: 'Cooldown period active (5 minutes)' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Registrar o erro na tabela
    const { error: insertError } = await supabase
      .from('auth_error_alerts')
      .insert({
        error_type,
        error_message,
        error_code,
        user_email,
        stack_trace,
        metadata: metadata || {}
      });

    if (insertError) {
      console.error('[auth-error-monitor] Failed to insert alert:', insertError);
    }

    // 3. Buscar admins para notificar
    const { data: admins, error: adminsError } = await supabase
      .from('admin_alert_recipients')
      .select('user_id, email')
      .eq('is_active', true)
      .contains('notification_types', ['auth_errors']);

    if (adminsError) {
      console.error('[auth-error-monitor] Failed to fetch admins:', adminsError);
    }

    // 4. Criar notificações in-app para cada admin
    let notificationsSent = 0;
    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.user_id,
        title: '🚨 ALERTA: Erro de Autenticação',
        body: `Erro ${error_type}: ${error_message?.substring(0, 100) || 'Erro desconhecido'}. Email: ${user_email || 'N/A'}`,
        type: 'critical_alert',
        url: '/admin/logs'
      }));

      const { error: notifError } = await supabase
        .from('user_notifications')
        .insert(notifications);

      if (notifError) {
        console.error('[auth-error-monitor] Failed to create notifications:', notifError);
      } else {
        notificationsSent = notifications.length;
        console.log(`[auth-error-monitor] Sent ${notificationsSent} notifications`);
      }

      // 5. Tentar enviar push notifications
      for (const admin of admins) {
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              workspace_id: null, // Não é específico de workspace
              user_id: admin.user_id,
              title: '🚨 ALERTA CRÍTICO',
              body: `Erro de autenticação: ${error_type}`,
              url: '/admin/logs',
              tag: 'auth-error'
            }
          });
        } catch (pushError) {
          console.error(`[auth-error-monitor] Push failed for ${admin.email}:`, pushError);
        }
      }
    }

    // 6. Registrar no platform_logs para auditoria
    await supabase.from('platform_logs').insert({
      action: 'create',
      entity_type: 'config',
      entity_id: 'auth_error_alert',
      details: {
        error_type,
        error_message,
        error_code,
        user_email,
        admins_notified: notificationsSent,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`[auth-error-monitor] Alert processed successfully. Admins notified: ${notificationsSent}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        admins_notified: notificationsSent,
        alert_logged: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[auth-error-monitor] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


-- Dropar a função existente para poder alterar o retorno
DROP FUNCTION IF EXISTS public.get_platform_stats();

-- Recriar com os novos campos de trials
CREATE OR REPLACE FUNCTION public.get_platform_stats()
 RETURNS TABLE(total_users bigint, total_workspaces bigint, active_workspaces bigint, total_leads bigint, total_messages bigint, visits_today bigint, unique_visitors_today bigint, total_visits bigint, whatsapp_connected bigint, whatsapp_total bigint, total_trials bigint, expired_trials bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT COUNT(*) FROM auth.users)::bigint as total_users,
    (SELECT COUNT(*) FROM workspaces)::bigint as total_workspaces,
    (SELECT COUNT(DISTINCT s.workspace_id) FROM subscriptions s
     WHERE s.status NOT IN ('expired', 'canceled')
       AND (
         (s.plan_type = 'trial' AND (s.trial_ends_at IS NULL OR s.trial_ends_at >= NOW()))
         OR
         (s.plan_type != 'trial' AND (s.current_period_end IS NULL OR s.current_period_end >= NOW() - INTERVAL '3 days'))
       )
    )::bigint as active_workspaces,
    (SELECT COUNT(*) FROM leads)::bigint as total_leads,
    (SELECT COUNT(*) FROM messages)::bigint as total_messages,
    (SELECT COUNT(*) FROM page_views 
     WHERE created_at >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC')::bigint as visits_today,
    (SELECT COUNT(DISTINCT visitor_id) FROM page_views 
     WHERE created_at >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC')::bigint as unique_visitors_today,
    (SELECT COUNT(*) FROM page_views)::bigint as total_visits,
    (SELECT COUNT(*) FROM whatsapp_instances WHERE status = 'connected')::bigint as whatsapp_connected,
    (SELECT COUNT(*) FROM whatsapp_instances)::bigint as whatsapp_total,
    (SELECT COUNT(*) FROM subscriptions WHERE plan_type = 'trial')::bigint as total_trials,
    (SELECT COUNT(*) FROM subscriptions WHERE plan_type = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at < NOW())::bigint as expired_trials;
$function$

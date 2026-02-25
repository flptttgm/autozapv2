-- Atualizar a função get_platform_stats para usar meia-noite do dia atual (timezone Brasil)
DROP FUNCTION IF EXISTS public.get_platform_stats();

CREATE FUNCTION public.get_platform_stats()
RETURNS TABLE(
  total_users bigint, 
  total_workspaces bigint, 
  total_leads bigint, 
  total_messages bigint, 
  visits_today bigint, 
  unique_visitors_today bigint, 
  total_visits bigint,
  whatsapp_connected bigint,
  whatsapp_total bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT COUNT(*) FROM auth.users)::bigint as total_users,
    (SELECT COUNT(*) FROM workspaces)::bigint as total_workspaces,
    (SELECT COUNT(*) FROM leads)::bigint as total_leads,
    (SELECT COUNT(*) FROM messages)::bigint as total_messages,
    -- Visitas desde meia-noite do dia atual no horário de Brasília
    (SELECT COUNT(*) FROM page_views 
     WHERE created_at >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC')::bigint as visits_today,
    -- Visitantes únicos desde meia-noite do dia atual no horário de Brasília
    (SELECT COUNT(DISTINCT visitor_id) FROM page_views 
     WHERE created_at >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC')::bigint as unique_visitors_today,
    (SELECT COUNT(*) FROM page_views)::bigint as total_visits,
    (SELECT COUNT(*) FROM whatsapp_instances WHERE status = 'connected')::bigint as whatsapp_connected,
    (SELECT COUNT(*) FROM whatsapp_instances)::bigint as whatsapp_total;
$function$;
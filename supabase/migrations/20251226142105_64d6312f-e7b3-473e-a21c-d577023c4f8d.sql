-- Drop existing function first to allow changing return type
DROP FUNCTION IF EXISTS public.get_admin_workspaces_with_stats();

-- Recreate function with whatsapp_phone column
CREATE OR REPLACE FUNCTION public.get_admin_workspaces_with_stats()
 RETURNS TABLE(
   id uuid, 
   name text, 
   owner_id uuid, 
   owner_name text, 
   owner_email text, 
   created_at timestamp with time zone, 
   plan_type text, 
   plan_status text, 
   leads_count bigint, 
   messages_count bigint, 
   members_count bigint, 
   whatsapp_status character varying,
   whatsapp_phone text
 )
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    w.id,
    w.name,
    w.owner_id,
    p.full_name as owner_name,
    u.email::text as owner_email,
    w.created_at,
    s.plan_type,
    s.status as plan_status,
    (SELECT COUNT(*) FROM leads l WHERE l.workspace_id = w.id)::bigint as leads_count,
    (SELECT COUNT(*) FROM messages m WHERE m.workspace_id = w.id)::bigint as messages_count,
    (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id)::bigint as members_count,
    (SELECT wi.status FROM whatsapp_instances wi WHERE wi.workspace_id = w.id ORDER BY (wi.status = 'connected') DESC, wi.created_at DESC LIMIT 1) as whatsapp_status,
    (SELECT wi.phone FROM whatsapp_instances wi 
     WHERE wi.workspace_id = w.id AND wi.phone IS NOT NULL 
     ORDER BY (wi.status = 'connected') DESC, wi.created_at DESC 
     LIMIT 1
    )::text as whatsapp_phone
  FROM workspaces w
  LEFT JOIN profiles p ON p.id = w.owner_id
  LEFT JOIN auth.users u ON u.id = w.owner_id
  LEFT JOIN subscriptions s ON s.workspace_id = w.id
  ORDER BY w.created_at DESC;
$function$;
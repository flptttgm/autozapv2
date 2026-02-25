
-- Drop existing function first to allow changing return type
DROP FUNCTION IF EXISTS public.get_admin_users_with_email();

-- Recreate function with whatsapp_phone column
CREATE OR REPLACE FUNCTION public.get_admin_users_with_email()
 RETURNS TABLE(
   id uuid, 
   email text, 
   full_name text, 
   company_name text, 
   workspace_id uuid, 
   workspace_name text, 
   onboarding_completed boolean, 
   created_at timestamp with time zone, 
   plan_type text, 
   plan_status text, 
   leads_count bigint, 
   messages_count bigint, 
   whatsapp_connected boolean,
   whatsapp_phone text
 )
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.id,
    u.email::text,
    p.full_name,
    p.company_name,
    p.workspace_id,
    w.name as workspace_name,
    p.onboarding_completed,
    p.created_at,
    s.plan_type,
    s.status as plan_status,
    (SELECT COUNT(*) FROM leads l WHERE l.workspace_id = p.workspace_id)::bigint as leads_count,
    (SELECT COUNT(*) FROM messages m WHERE m.workspace_id = p.workspace_id)::bigint as messages_count,
    EXISTS(SELECT 1 FROM whatsapp_instances wi WHERE wi.workspace_id = p.workspace_id AND wi.status = 'connected') as whatsapp_connected,
    (SELECT wi.phone FROM whatsapp_instances wi 
     WHERE wi.workspace_id = p.workspace_id AND wi.phone IS NOT NULL 
     ORDER BY (wi.status = 'connected') DESC, wi.created_at DESC 
     LIMIT 1
    )::text as whatsapp_phone
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN workspaces w ON w.id = p.workspace_id
  LEFT JOIN subscriptions s ON s.workspace_id = p.workspace_id
  ORDER BY p.created_at DESC;
$function$;

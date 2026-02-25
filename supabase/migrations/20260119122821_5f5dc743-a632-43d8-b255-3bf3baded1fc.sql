DROP FUNCTION IF EXISTS public.get_admin_whatsapp_instances();

CREATE OR REPLACE FUNCTION public.get_admin_whatsapp_instances()
 RETURNS TABLE(
   id uuid, 
   workspace_id uuid, 
   workspace_name text, 
   instance_id text, 
   instance_token text, 
   phone_number text,
   status text, 
   is_active boolean, 
   created_at timestamp with time zone, 
   owner_email text,
   subscribed boolean,
   subscribed_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado - apenas administradores da plataforma';
  END IF;
  
  RETURN QUERY
  SELECT 
    wi.id,
    wi.workspace_id,
    w.name::text as workspace_name,
    wi.instance_id::text,
    wi.instance_token::text,
    wi.phone::text as phone_number,
    wi.status::text,
    NOT COALESCE(wi.is_paused, false) as is_active,
    wi.created_at,
    u.email::text as owner_email,
    wi.subscribed,
    wi.subscribed_at
  FROM whatsapp_instances wi
  LEFT JOIN workspaces w ON w.id = wi.workspace_id
  LEFT JOIN profiles p ON p.workspace_id = wi.workspace_id
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY wi.created_at DESC;
END;
$function$;
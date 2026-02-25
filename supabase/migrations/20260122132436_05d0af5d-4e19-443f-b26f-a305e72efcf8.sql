-- Fix get_admin_whatsapp_instances to avoid row duplication
-- Using subquery instead of JOIN to get only owner email

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
    RAISE EXCEPTION 'Acesso negado';
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
    (SELECT u.email::text 
     FROM workspace_members wm 
     JOIN auth.users u ON u.id = wm.user_id 
     WHERE wm.workspace_id = wi.workspace_id 
       AND wm.role = 'owner' 
     LIMIT 1
    ) as owner_email,
    wi.subscribed,
    wi.subscribed_at
  FROM whatsapp_instances wi
  LEFT JOIN workspaces w ON w.id = wi.workspace_id
  ORDER BY wi.created_at DESC;
END;
$function$;
-- Drop existing function and recreate with new columns
DROP FUNCTION IF EXISTS public.get_admin_whatsapp_instances();

CREATE FUNCTION public.get_admin_whatsapp_instances()
RETURNS TABLE(
  id uuid,
  workspace_id uuid,
  instance_id varchar,
  phone varchar,
  status varchar,
  connected_at timestamptz,
  created_at timestamptz,
  workspace_name text,
  owner_name text,
  owner_email text,
  plan_type text,
  subscribed boolean,
  subscribed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    wi.id,
    wi.workspace_id,
    wi.instance_id,
    wi.phone,
    wi.status,
    wi.connected_at,
    wi.created_at,
    w.name as workspace_name,
    p.full_name as owner_name,
    u.email::text as owner_email,
    s.plan_type,
    wi.subscribed,
    wi.subscribed_at
  FROM whatsapp_instances wi
  LEFT JOIN workspaces w ON w.id = wi.workspace_id
  LEFT JOIN profiles p ON p.id = w.owner_id
  LEFT JOIN auth.users u ON u.id = w.owner_id
  LEFT JOIN subscriptions s ON s.workspace_id = wi.workspace_id
  ORDER BY wi.created_at DESC;
$function$;
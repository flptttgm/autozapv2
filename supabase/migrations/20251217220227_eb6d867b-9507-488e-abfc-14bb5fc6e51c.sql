-- Function to get all users with email from auth.users
CREATE OR REPLACE FUNCTION public.get_admin_users_with_email()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  company_name text,
  workspace_id uuid,
  workspace_name text,
  onboarding_completed boolean,
  created_at timestamptz,
  plan_type text,
  plan_status text,
  leads_count bigint,
  messages_count bigint,
  whatsapp_connected boolean
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
    EXISTS(SELECT 1 FROM whatsapp_instances wi WHERE wi.workspace_id = p.workspace_id AND wi.status = 'connected') as whatsapp_connected
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN workspaces w ON w.id = p.workspace_id
  LEFT JOIN subscriptions s ON s.workspace_id = p.workspace_id
  ORDER BY p.created_at DESC;
$$;

-- Function to get WhatsApp instances with user info
CREATE OR REPLACE FUNCTION public.get_admin_whatsapp_instances()
RETURNS TABLE (
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
  plan_type text
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
    s.plan_type
  FROM whatsapp_instances wi
  LEFT JOIN workspaces w ON w.id = wi.workspace_id
  LEFT JOIN profiles p ON p.id = w.owner_id
  LEFT JOIN auth.users u ON u.id = w.owner_id
  LEFT JOIN subscriptions s ON s.workspace_id = wi.workspace_id
  ORDER BY wi.created_at DESC;
$$;

-- Function to get subscriptions with user info
CREATE OR REPLACE FUNCTION public.get_admin_subscriptions_with_user()
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  workspace_name text,
  owner_name text,
  owner_email text,
  plan_type text,
  status text,
  billing_cycle text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id,
    s.workspace_id,
    w.name as workspace_name,
    p.full_name as owner_name,
    u.email::text as owner_email,
    s.plan_type,
    s.status,
    s.billing_cycle,
    s.trial_ends_at,
    s.current_period_end,
    s.created_at
  FROM subscriptions s
  LEFT JOIN workspaces w ON w.id = s.workspace_id
  LEFT JOIN profiles p ON p.id = w.owner_id
  LEFT JOIN auth.users u ON u.id = w.owner_id
  ORDER BY s.created_at DESC;
$$;

-- Function to get workspaces with stats
CREATE OR REPLACE FUNCTION public.get_admin_workspaces_with_stats()
RETURNS TABLE (
  id uuid,
  name text,
  owner_id uuid,
  owner_name text,
  owner_email text,
  created_at timestamptz,
  plan_type text,
  plan_status text,
  leads_count bigint,
  messages_count bigint,
  members_count bigint,
  whatsapp_status varchar
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
    (SELECT wi.status FROM whatsapp_instances wi WHERE wi.workspace_id = w.id LIMIT 1) as whatsapp_status
  FROM workspaces w
  LEFT JOIN profiles p ON p.id = w.owner_id
  LEFT JOIN auth.users u ON u.id = w.owner_id
  LEFT JOIN subscriptions s ON s.workspace_id = w.id
  ORDER BY w.created_at DESC;
$$;

-- Function to get expiring trials
CREATE OR REPLACE FUNCTION public.get_expiring_trials(hours_ahead integer DEFAULT 48)
RETURNS TABLE (
  workspace_id uuid,
  workspace_name text,
  owner_name text,
  owner_email text,
  trial_ends_at timestamptz
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.workspace_id,
    w.name as workspace_name,
    p.full_name as owner_name,
    u.email::text as owner_email,
    s.trial_ends_at
  FROM subscriptions s
  LEFT JOIN workspaces w ON w.id = s.workspace_id
  LEFT JOIN profiles p ON p.id = w.owner_id
  LEFT JOIN auth.users u ON u.id = w.owner_id
  WHERE s.plan_type = 'trial' 
    AND s.trial_ends_at IS NOT NULL
    AND s.trial_ends_at > NOW()
    AND s.trial_ends_at <= NOW() + (hours_ahead || ' hours')::interval
  ORDER BY s.trial_ends_at ASC;
$$;

-- Function to get recent users with email for dashboard
CREATE OR REPLACE FUNCTION public.get_admin_recent_users(limit_count integer DEFAULT 5)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    u.email::text,
    p.full_name,
    p.created_at
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC
  LIMIT limit_count;
$$;
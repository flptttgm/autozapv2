-- Primeiro remover as funções existentes para poder recriar com verificação de admin
DROP FUNCTION IF EXISTS public.get_platform_stats();
DROP FUNCTION IF EXISTS public.get_admin_recent_users(integer);
DROP FUNCTION IF EXISTS public.get_admin_users_with_email();
DROP FUNCTION IF EXISTS public.get_admin_workspaces_with_stats();
DROP FUNCTION IF EXISTS public.get_admin_subscriptions_with_user();
DROP FUNCTION IF EXISTS public.get_admin_whatsapp_instances();
DROP FUNCTION IF EXISTS public.get_expiring_trials(integer);

-- 1. get_platform_stats - com verificação de admin
CREATE FUNCTION public.get_platform_stats()
RETURNS TABLE(
  total_users bigint,
  total_workspaces bigint,
  total_leads bigint,
  total_messages bigint,
  active_subscriptions bigint,
  trial_users bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado - apenas administradores da plataforma';
  END IF;
  
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM auth.users)::bigint as total_users,
    (SELECT COUNT(*) FROM workspaces)::bigint as total_workspaces,
    (SELECT COUNT(*) FROM leads)::bigint as total_leads,
    (SELECT COUNT(*) FROM messages)::bigint as total_messages,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'active')::bigint as active_subscriptions,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'trial')::bigint as trial_users;
END;
$$;

-- 2. get_admin_recent_users - com verificação de admin
CREATE FUNCTION public.get_admin_recent_users(days_limit integer DEFAULT 7)
RETURNS TABLE(
  id uuid,
  email text,
  created_at timestamptz,
  full_name text,
  company_name text,
  workspace_id uuid
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado - apenas administradores da plataforma';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    u.created_at,
    p.full_name,
    p.company_name,
    p.workspace_id
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.created_at >= NOW() - (days_limit || ' days')::interval
  ORDER BY u.created_at DESC;
END;
$$;

-- 3. get_admin_users_with_email - com verificação de admin
CREATE FUNCTION public.get_admin_users_with_email()
RETURNS TABLE(
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  full_name text,
  company_name text,
  workspace_id uuid,
  onboarding_completed boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado - apenas administradores da plataforma';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    p.full_name,
    p.company_name,
    p.workspace_id,
    p.onboarding_completed
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- 4. get_admin_workspaces_with_stats - com verificação de admin
CREATE FUNCTION public.get_admin_workspaces_with_stats()
RETURNS TABLE(
  id uuid,
  name text,
  created_at timestamptz,
  owner_email text,
  owner_name text,
  lead_count bigint,
  message_count bigint,
  subscription_status text,
  plan_type text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado - apenas administradores da plataforma';
  END IF;
  
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.created_at,
    u.email::text as owner_email,
    p.full_name as owner_name,
    (SELECT COUNT(*) FROM leads l WHERE l.workspace_id = w.id)::bigint as lead_count,
    (SELECT COUNT(*) FROM messages m WHERE m.workspace_id = w.id)::bigint as message_count,
    s.status as subscription_status,
    s.plan_type
  FROM workspaces w
  LEFT JOIN profiles p ON p.workspace_id = w.id
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN subscriptions s ON s.workspace_id = w.id
  ORDER BY w.created_at DESC;
END;
$$;

-- 5. get_admin_subscriptions_with_user - com verificação de admin
CREATE FUNCTION public.get_admin_subscriptions_with_user()
RETURNS TABLE(
  id uuid,
  workspace_id uuid,
  workspace_name text,
  status text,
  plan_type text,
  billing_cycle text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  created_at timestamptz,
  owner_email text,
  owner_name text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado - apenas administradores da plataforma';
  END IF;
  
  RETURN QUERY
  SELECT 
    s.id,
    s.workspace_id,
    w.name as workspace_name,
    s.status,
    s.plan_type,
    s.billing_cycle,
    s.current_period_start,
    s.current_period_end,
    s.trial_end,
    s.created_at,
    u.email::text as owner_email,
    p.full_name as owner_name
  FROM subscriptions s
  LEFT JOIN workspaces w ON w.id = s.workspace_id
  LEFT JOIN profiles p ON p.workspace_id = s.workspace_id
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY s.created_at DESC;
END;
$$;

-- 6. get_admin_whatsapp_instances - com verificação de admin
CREATE FUNCTION public.get_admin_whatsapp_instances()
RETURNS TABLE(
  id uuid,
  workspace_id uuid,
  workspace_name text,
  instance_id text,
  instance_token text,
  phone_number text,
  status text,
  is_active boolean,
  created_at timestamptz,
  owner_email text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado - apenas administradores da plataforma';
  END IF;
  
  RETURN QUERY
  SELECT 
    wi.id,
    wi.workspace_id,
    w.name as workspace_name,
    wi.instance_id,
    wi.instance_token,
    wi.phone_number,
    wi.status,
    wi.is_active,
    wi.created_at,
    u.email::text as owner_email
  FROM whatsapp_instances wi
  LEFT JOIN workspaces w ON w.id = wi.workspace_id
  LEFT JOIN profiles p ON p.workspace_id = wi.workspace_id
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY wi.created_at DESC;
END;
$$;

-- 7. get_expiring_trials - com verificação de admin
CREATE FUNCTION public.get_expiring_trials(days_until_expiry integer DEFAULT 3)
RETURNS TABLE(
  workspace_id uuid,
  workspace_name text,
  owner_email text,
  owner_name text,
  trial_end timestamptz,
  days_remaining integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado - apenas administradores da plataforma';
  END IF;
  
  RETURN QUERY
  SELECT 
    s.workspace_id,
    w.name as workspace_name,
    u.email::text as owner_email,
    p.full_name as owner_name,
    s.trial_end,
    EXTRACT(DAY FROM (s.trial_end - NOW()))::integer as days_remaining
  FROM subscriptions s
  LEFT JOIN workspaces w ON w.id = s.workspace_id
  LEFT JOIN profiles p ON p.workspace_id = s.workspace_id
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE s.status = 'trial'
    AND s.trial_end IS NOT NULL
    AND s.trial_end <= NOW() + (days_until_expiry || ' days')::interval
    AND s.trial_end > NOW()
  ORDER BY s.trial_end ASC;
END;
$$;
-- Fix get_expiring_trials function - use correct column names and plan_type filter
DROP FUNCTION IF EXISTS public.get_expiring_trials(integer);

CREATE FUNCTION public.get_expiring_trials(days_until_expiry integer DEFAULT 2)
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
    s.trial_ends_at as trial_end,
    EXTRACT(DAY FROM (s.trial_ends_at - NOW()))::integer as days_remaining
  FROM subscriptions s
  LEFT JOIN workspaces w ON w.id = s.workspace_id
  LEFT JOIN profiles p ON p.workspace_id = s.workspace_id
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE s.plan_type = 'trial'
    AND s.status = 'active'
    AND s.trial_ends_at IS NOT NULL
    AND s.trial_ends_at <= NOW() + (days_until_expiry || ' days')::interval
    AND s.trial_ends_at > NOW()
  ORDER BY s.trial_ends_at ASC;
END;
$$;
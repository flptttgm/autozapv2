-- Drop existing function and recreate with new return type including lead/message counts
DROP FUNCTION IF EXISTS public.get_admin_subscriptions_detailed();

CREATE FUNCTION public.get_admin_subscriptions_detailed()
RETURNS TABLE(
  subscription_id uuid,
  workspace_id uuid,
  workspace_name text,
  owner_id uuid,
  owner_email text,
  owner_name text,
  plan_type text,
  status text,
  effective_status text,
  billing_cycle text,
  connections_limit integer,
  connections_extra integer,
  members_limit integer,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz,
  days_until_expiration integer,
  is_in_grace_period boolean,
  grace_period_end timestamptz,
  lead_count bigint,
  message_count bigint
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id as subscription_id,
    s.workspace_id,
    w.name as workspace_name,
    wm.user_id as owner_id,
    u.email as owner_email,
    p.full_name as owner_name,
    s.plan_type,
    s.status,
    CASE 
      WHEN s.status = 'active' AND s.current_period_end < NOW() THEN 'expired'
      WHEN s.status = 'active' AND s.current_period_end < NOW() + INTERVAL '3 days' THEN 'expiring_soon'
      WHEN s.status = 'past_due' AND s.current_period_end >= NOW() - INTERVAL '3 days' THEN 'grace_period'
      WHEN s.status = 'past_due' AND s.current_period_end < NOW() - INTERVAL '3 days' THEN 'overdue'
      ELSE s.status
    END as effective_status,
    s.billing_cycle,
    s.connections_limit,
    s.connections_extra,
    s.members_limit,
    s.current_period_start,
    s.current_period_end,
    s.trial_ends_at,
    s.created_at,
    EXTRACT(DAY FROM (s.current_period_end - NOW()))::integer as days_until_expiration,
    (s.status = 'past_due' AND s.current_period_end >= NOW() - INTERVAL '3 days') as is_in_grace_period,
    CASE 
      WHEN s.status = 'past_due' THEN s.current_period_end + INTERVAL '3 days'
      ELSE NULL
    END as grace_period_end,
    (SELECT COUNT(*) FROM leads l WHERE l.workspace_id = s.workspace_id) as lead_count,
    (SELECT COUNT(*) FROM messages m 
     JOIN leads l ON l.id = m.lead_id 
     WHERE l.workspace_id = s.workspace_id) as message_count
  FROM subscriptions s
  LEFT JOIN workspaces w ON w.id = s.workspace_id
  LEFT JOIN workspace_members wm ON wm.workspace_id = s.workspace_id AND wm.role = 'owner'
  LEFT JOIN profiles p ON p.id = wm.user_id
  LEFT JOIN auth.users u ON u.id = wm.user_id
  ORDER BY s.created_at DESC;
$$;
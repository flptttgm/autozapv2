-- Update function to correctly handle trial vs paid subscription expiration
-- Trial: NO grace period - expires immediately
-- Paid: 3-day grace period before marking as expired

CREATE OR REPLACE FUNCTION public.get_admin_subscriptions_detailed()
RETURNS TABLE(
  id uuid, 
  workspace_id uuid, 
  workspace_name text, 
  owner_name text, 
  owner_email text, 
  plan_type text, 
  status text, 
  billing_cycle text, 
  trial_ends_at timestamp with time zone, 
  current_period_end timestamp with time zone, 
  created_at timestamp with time zone, 
  asaas_subscription_id text, 
  connections_limit integer, 
  connections_extra integer, 
  is_grace_period boolean, 
  grace_days_left integer, 
  days_until_expiration integer, 
  effective_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    s.created_at,
    s.asaas_subscription_id,
    s.connections_limit,
    s.connections_extra,
    -- is_grace_period: ONLY for paid plans (NOT trial)
    CASE 
      WHEN s.plan_type != 'trial' 
        AND s.status = 'active' 
        AND s.current_period_end IS NOT NULL 
        AND s.current_period_end < NOW() 
        AND s.current_period_end > NOW() - INTERVAL '3 days'
      THEN true
      ELSE false
    END as is_grace_period,
    -- grace_days_left: ONLY for paid plans (NOT trial)
    CASE 
      WHEN s.plan_type != 'trial' AND s.current_period_end IS NOT NULL AND s.current_period_end < NOW() THEN
        GREATEST(0, 3 - EXTRACT(DAY FROM NOW() - s.current_period_end)::integer)
      ELSE 0
    END as grace_days_left,
    -- days_until_expiration (positive = days left, negative = days overdue)
    CASE 
      WHEN s.plan_type = 'trial' AND s.trial_ends_at IS NOT NULL THEN
        EXTRACT(DAY FROM s.trial_ends_at - NOW())::integer
      WHEN s.current_period_end IS NOT NULL THEN
        EXTRACT(DAY FROM s.current_period_end - NOW())::integer
      ELSE NULL
    END as days_until_expiration,
    -- effective_status: Trial has NO grace period, paid plans do
    CASE 
      WHEN s.status = 'canceled' THEN 'canceled'
      WHEN s.status = 'expired' THEN 'expired'
      -- Trial: active or expired immediately, NO grace period
      WHEN s.plan_type = 'trial' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at < NOW() THEN 'expired'
      WHEN s.plan_type = 'trial' AND (s.trial_ends_at IS NULL OR s.trial_ends_at >= NOW()) THEN 'active'
      -- Paid plans: with grace period
      WHEN s.plan_type != 'trial' 
        AND s.current_period_end IS NOT NULL 
        AND s.current_period_end < NOW() 
        AND s.current_period_end > NOW() - INTERVAL '3 days' THEN 'grace_period'
      WHEN s.plan_type != 'trial' 
        AND s.current_period_end IS NOT NULL 
        AND s.current_period_end < NOW() - INTERVAL '3 days' THEN 'expired'
      ELSE 'active'
    END as effective_status
  FROM subscriptions s
  LEFT JOIN workspaces w ON w.id = s.workspace_id
  LEFT JOIN profiles p ON p.id = w.owner_id
  LEFT JOIN auth.users u ON u.id = w.owner_id
  ORDER BY s.created_at DESC;
$function$;
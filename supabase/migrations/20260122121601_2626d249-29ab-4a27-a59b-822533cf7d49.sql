-- Create public function for statistics page (without admin check)
CREATE OR REPLACE FUNCTION public.get_public_platform_stats()
RETURNS TABLE(
  total_users bigint,
  total_workspaces bigint,
  total_leads bigint,
  total_messages bigint,
  active_subscriptions bigint,
  trial_users bigint
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (SELECT COUNT(*) FROM auth.users)::bigint as total_users,
    (SELECT COUNT(*) FROM workspaces)::bigint as total_workspaces,
    (SELECT COUNT(*) FROM leads)::bigint as total_leads,
    (SELECT COUNT(*) FROM messages)::bigint as total_messages,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'active')::bigint as active_subscriptions,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'trial')::bigint as trial_users;
$$;
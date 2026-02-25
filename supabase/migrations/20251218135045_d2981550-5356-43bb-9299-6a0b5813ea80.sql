-- Add RLS policy for platform admins to view all push_subscriptions
CREATE POLICY "Platform admins can view all push_subscriptions"
ON push_subscriptions FOR SELECT
USING (is_platform_admin(auth.uid()));
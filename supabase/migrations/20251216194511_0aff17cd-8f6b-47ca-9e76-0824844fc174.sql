-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Members can view workspace invites" ON public.invites;

-- Create new policy: Only admins and the invited email can view invites
CREATE POLICY "Admins and invited users can view invites"
ON public.invites
FOR SELECT
USING (
  workspace_id = get_user_workspace_id() 
  AND (
    -- Admins can see all workspace invites
    is_workspace_admin(workspace_id, auth.uid())
    OR 
    -- Users can see invites sent to their own email
    email = (auth.jwt() ->> 'email')
  )
);
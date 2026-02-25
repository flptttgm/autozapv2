-- Drop existing problematic policies on workspace_members
DROP POLICY IF EXISTS "Users can view workspace members where they are members" ON public.workspace_members;

-- Create a simpler, non-recursive policy for viewing workspace members
-- Use a direct check without subquery that references the same table
CREATE POLICY "Users can view own workspace members"
ON public.workspace_members
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Fix invites policies that also reference workspace_members causing recursion
DROP POLICY IF EXISTS "Members can view workspace invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can create invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can update invites" ON public.invites;

-- Recreate invites policies using profiles table instead
CREATE POLICY "Members can view workspace invites"
ON public.invites
FOR SELECT
USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Admins can create invites"
ON public.invites
FOR INSERT
WITH CHECK (
  workspace_id = get_user_workspace_id() 
  AND is_workspace_admin(workspace_id, auth.uid())
);

CREATE POLICY "Admins can update invites"
ON public.invites
FOR UPDATE
USING (
  workspace_id = get_user_workspace_id()
  AND is_workspace_admin(workspace_id, auth.uid())
);
-- Fix workspace_profiles RLS policies to avoid infinite recursion
-- The current policies query workspace_members which has its own RLS policies,
-- causing infinite recursion. Using get_user_workspace_id() (SECURITY DEFINER) instead.

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their workspace profiles" ON public.workspace_profiles;
DROP POLICY IF EXISTS "Workspace admins can update workspace profiles" ON public.workspace_profiles;
DROP POLICY IF EXISTS "Workspace admins can insert workspace profiles" ON public.workspace_profiles;

-- Recreate policies using the SECURITY DEFINER helper function
CREATE POLICY "Users can view their workspace profiles"
  ON public.workspace_profiles
  FOR SELECT
  USING (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Workspace admins can update workspace profiles"
  ON public.workspace_profiles
  FOR UPDATE
  USING (workspace_id = public.get_user_workspace_id())
  WITH CHECK (workspace_id = public.get_user_workspace_id());

CREATE POLICY "Workspace admins can insert workspace profiles"
  ON public.workspace_profiles
  FOR INSERT
  WITH CHECK (workspace_id = public.get_user_workspace_id());

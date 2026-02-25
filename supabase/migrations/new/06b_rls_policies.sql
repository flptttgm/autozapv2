-- ============================================
-- 06b. RLS Policies & Helper Functions (Part 2 of 3)
-- ============================================

-- Helper function
CREATE OR REPLACE FUNCTION public.get_user_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Service role full access (for edge functions & trigger)
DROP POLICY IF EXISTS "Service role full access" ON public.profiles;
CREATE POLICY "Service role full access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.workspace_members;
CREATE POLICY "Service role full access" ON public.workspace_members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.subscriptions;
CREATE POLICY "Service role full access" ON public.subscriptions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.custom_templates;
CREATE POLICY "Service role full access" ON public.custom_templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.agent_routing_config;
CREATE POLICY "Service role full access" ON public.agent_routing_config FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.invites;
CREATE POLICY "Service role full access" ON public.invites FOR ALL USING (true) WITH CHECK (true);

-- Profiles: user can view/update own
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Workspaces: expanded policies
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON public.workspaces;
CREATE POLICY "Users can view workspaces they are members of" ON public.workspaces FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own workspace" ON public.workspaces;
CREATE POLICY "Users can update their own workspace" ON public.workspaces FOR UPDATE TO authenticated USING (owner_id = auth.uid());

-- Workspace members
DROP POLICY IF EXISTS "Members can view their workspace members" ON public.workspace_members;
CREATE POLICY "Members can view their workspace members" ON public.workspace_members FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- Subscriptions
DROP POLICY IF EXISTS "Members can view workspace subscription" ON public.subscriptions;
CREATE POLICY "Members can view workspace subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

-- Custom templates
DROP POLICY IF EXISTS "Members can view workspace custom_templates" ON public.custom_templates;
CREATE POLICY "Members can view workspace custom_templates" ON public.custom_templates FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Members can create workspace custom_templates" ON public.custom_templates;
CREATE POLICY "Members can create workspace custom_templates" ON public.custom_templates FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Members can update workspace custom_templates" ON public.custom_templates;
CREATE POLICY "Members can update workspace custom_templates" ON public.custom_templates FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Members can delete workspace custom_templates" ON public.custom_templates;
CREATE POLICY "Members can delete workspace custom_templates" ON public.custom_templates FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

-- Agent routing config
DROP POLICY IF EXISTS "Workspace members can view routing config" ON public.agent_routing_config;
CREATE POLICY "Workspace members can view routing config" ON public.agent_routing_config FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Workspace members can insert routing config" ON public.agent_routing_config;
CREATE POLICY "Workspace members can insert routing config" ON public.agent_routing_config FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_workspace_id());

DROP POLICY IF EXISTS "Workspace members can update routing config" ON public.agent_routing_config;
CREATE POLICY "Workspace members can update routing config" ON public.agent_routing_config FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_workspace_id());

SELECT 'Part 2/3 done: All RLS policies created!' as result;

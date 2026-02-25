-- Fix permissive INSERT policies for quotes, custom_templates, and agent_routing_config

-- 1. Fix quotes INSERT policy
DROP POLICY IF EXISTS "Users can create quotes in their workspace" ON quotes;
CREATE POLICY "Users can create quotes in their workspace" ON quotes
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

-- 2. Fix custom_templates INSERT policy
DROP POLICY IF EXISTS "Members can create workspace custom_templates" ON custom_templates;
CREATE POLICY "Members can create workspace custom_templates" ON custom_templates
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

-- 3. Fix agent_routing_config INSERT policy
DROP POLICY IF EXISTS "Workspace members can insert routing config" ON agent_routing_config;
CREATE POLICY "Workspace members can insert routing config" ON agent_routing_config
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);
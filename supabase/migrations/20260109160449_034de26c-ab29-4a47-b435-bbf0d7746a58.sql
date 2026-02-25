-- =====================================================
-- FIX EXISTING ACCOUNTS: Set default_agent_id to support agent
-- =====================================================

-- 1. Update existing agent_routing_config entries that have NULL default_agent_id
UPDATE public.agent_routing_config arc
SET 
  default_agent_id = (
    SELECT ct.id 
    FROM public.custom_templates ct 
    WHERE ct.workspace_id = arc.workspace_id 
    AND ct.agent_type = 'support' 
    ORDER BY ct.created_at ASC
    LIMIT 1
  ),
  updated_at = now()
WHERE arc.default_agent_id IS NULL;

-- 2. Create agent_routing_config for workspaces that have agents but no routing config
INSERT INTO public.agent_routing_config (
  workspace_id, 
  is_routing_enabled, 
  default_agent_id, 
  routing_mode, 
  transition_style
)
SELECT DISTINCT 
  ct.workspace_id,
  true,
  (
    SELECT sub_ct.id 
    FROM public.custom_templates sub_ct 
    WHERE sub_ct.workspace_id = ct.workspace_id 
    AND sub_ct.agent_type = 'support' 
    ORDER BY sub_ct.created_at ASC
    LIMIT 1
  ),
  'ai',
  'friendly'
FROM public.custom_templates ct
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.agent_routing_config arc 
  WHERE arc.workspace_id = ct.workspace_id
)
AND ct.agent_type IS NOT NULL
GROUP BY ct.workspace_id;
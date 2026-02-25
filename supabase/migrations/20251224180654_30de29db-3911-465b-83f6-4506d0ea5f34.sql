-- Add columns for agent-specific knowledge base items
ALTER TABLE public.knowledge_base 
ADD COLUMN is_global boolean DEFAULT true,
ADD COLUMN agent_ids uuid[] DEFAULT '{}'::uuid[];

-- Add comment for documentation
COMMENT ON COLUMN public.knowledge_base.is_global IS 'If true, this knowledge item is available to all agents';
COMMENT ON COLUMN public.knowledge_base.agent_ids IS 'Array of custom_templates IDs that can use this knowledge item when is_global is false';
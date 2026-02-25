-- =============================================
-- PHASE 1: Database Structure for Multi-Agent System
-- =============================================

-- 1.1 Add columns to custom_templates for agent routing
ALTER TABLE custom_templates 
ADD COLUMN IF NOT EXISTS agent_type VARCHAR(50) DEFAULT 'general',
ADD COLUMN IF NOT EXISTS agent_persona_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS trigger_keywords JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS trigger_intents JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS transition_message TEXT,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

COMMENT ON COLUMN custom_templates.agent_type IS 'Tipo do agente: sales, support, scheduling, financial, technical, general';
COMMENT ON COLUMN custom_templates.agent_persona_name IS 'Nome da persona do agente (ex: Mariana, Luana, Carlos)';
COMMENT ON COLUMN custom_templates.trigger_keywords IS 'Palavras-chave que ativam este agente';
COMMENT ON COLUMN custom_templates.trigger_intents IS 'Intenções detectadas por IA que ativam o agente';
COMMENT ON COLUMN custom_templates.transition_message IS 'Mensagem enviada quando este agente assume a conversa';
COMMENT ON COLUMN custom_templates.priority IS 'Prioridade quando múltiplos agentes podem responder (maior = mais prioritário)';

-- 1.2 Create agent_routing_config table
CREATE TABLE IF NOT EXISTS agent_routing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  is_routing_enabled BOOLEAN DEFAULT false,
  default_agent_id UUID REFERENCES custom_templates(id) ON DELETE SET NULL,
  routing_mode VARCHAR(50) DEFAULT 'keywords',
  transition_style VARCHAR(50) DEFAULT 'friendly',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id)
);

COMMENT ON COLUMN agent_routing_config.routing_mode IS 'keywords = rápido por palavras | ai = análise inteligente por IA';
COMMENT ON COLUMN agent_routing_config.transition_style IS 'friendly = transição amigável | silent = sem mensagem | formal = formal';

-- Enable RLS on agent_routing_config
ALTER TABLE agent_routing_config ENABLE ROW LEVEL SECURITY;

-- Policy for workspace members to manage routing config
CREATE POLICY "Workspace members can view routing config"
ON agent_routing_config FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Workspace members can insert routing config"
ON agent_routing_config FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Workspace members can update routing config"
ON agent_routing_config FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Workspace members can delete routing config"
ON agent_routing_config FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  )
);

-- 1.3 Add agent tracking columns to chat_memory
ALTER TABLE chat_memory
ADD COLUMN IF NOT EXISTS current_agent_id UUID REFERENCES custom_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS agent_history JSONB DEFAULT '[]';

COMMENT ON COLUMN chat_memory.current_agent_id IS 'Agente atual ativo nesta conversa';
COMMENT ON COLUMN chat_memory.agent_history IS 'Histórico de trocas de agente [{agent_id, switched_at, reason}]';

-- Create index for faster agent lookups
CREATE INDEX IF NOT EXISTS idx_custom_templates_agent_type ON custom_templates(agent_type);
CREATE INDEX IF NOT EXISTS idx_custom_templates_workspace_priority ON custom_templates(workspace_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_chat_memory_current_agent ON chat_memory(current_agent_id);
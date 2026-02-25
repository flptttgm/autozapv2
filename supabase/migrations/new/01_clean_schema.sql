-- ============================================
-- AUTOZAP - Clean Database Schema v2
-- New Supabase: hmoekghvlyfyfjobyufq
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- 0. CLEANUP (Ensure fresh start)
-- ============================================
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.system_config CASCADE;
DROP TABLE IF EXISTS public.knowledge_base CASCADE;
DROP TABLE IF EXISTS public.chat_memory CASCADE;
DROP TABLE IF EXISTS public.message_buffer CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.whatsapp_instances CASCADE;
DROP TABLE IF EXISTS public.ai_agents CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.platform_logs CASCADE;

-- ============================================
-- 1. WORKSPACES (multi-tenant root)
-- ============================================
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. WHATSAPP_INSTANCES (conexões WhatsApp)
-- ============================================
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  instance_token TEXT, -- Token da instância Z-API (necessário para enviar msgs)
  display_name TEXT,
  phone TEXT,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'expired', 'blocked')),
  is_connected BOOLEAN DEFAULT false,
  is_paused BOOLEAN DEFAULT false,
  subscribed BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ,
  ai_agent_id UUID, -- linked AI agent (FK added after ai_agents table)
  ai_mode TEXT DEFAULT 'all' CHECK (ai_mode IN ('all', 'selective', 'off')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, instance_id)
);

-- ============================================
-- 3. LEADS (contatos/clientes)
-- ============================================
DO $$ BEGIN
    CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  status lead_status DEFAULT 'new',
  score INTEGER DEFAULT 0,
  ai_enabled BOOLEAN DEFAULT true,
  sentiment_score REAL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, phone)
);

CREATE INDEX idx_leads_workspace ON public.leads(workspace_id);
CREATE INDEX idx_leads_phone ON public.leads(phone);

-- ============================================
-- 4. MESSAGES (histórico de mensagens)
-- ============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  chat_id TEXT NOT NULL,
  content TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_chat ON public.messages(chat_id);
CREATE INDEX idx_messages_lead ON public.messages(lead_id);
CREATE INDEX idx_messages_workspace_created ON public.messages(workspace_id, created_at DESC);

-- ============================================
-- 5. MESSAGE_BUFFER (fila de processamento)
-- ============================================
CREATE TABLE public.message_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  instance_id TEXT,
  content TEXT NOT NULL,
  is_group BOOLEAN DEFAULT false,
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_buffer_chat_unprocessed ON public.message_buffer(chat_id, is_processed) WHERE is_processed = false;

-- ============================================
-- 6. AI_AGENTS (templates de IA - substitui custom_templates)
-- ============================================
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  persona_name TEXT, -- "Ana", "Carlos", etc.
  agent_type TEXT DEFAULT 'general' CHECK (agent_type IN ('general', 'sales', 'support', 'scheduling', 'financial', 'technical')),
  system_prompt TEXT NOT NULL,
  personality JSONB DEFAULT '{"tone": 70, "verbosity": 50, "proactivity": 60, "use_emojis": true}',
  behavior JSONB DEFAULT '{"business_hours": {"start": "08:00", "end": "18:00", "enabled": false}, "human_transfer_keywords": ["atendente", "humano"], "appointment_detection": true}',
  quick_replies JSONB DEFAULT '[]',
  routing_keywords TEXT[] DEFAULT '{}', -- keywords that trigger this agent
  transition_message TEXT, -- greeting message when agent takes over
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agents_workspace ON public.ai_agents(workspace_id);

-- Add FK from whatsapp_instances to ai_agents
ALTER TABLE public.whatsapp_instances 
  ADD CONSTRAINT fk_whatsapp_ai_agent 
  FOREIGN KEY (ai_agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;

-- ============================================
-- 7. CHAT_MEMORY (contexto da conversa - REDESENHADO)
-- ============================================
CREATE TABLE public.chat_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  
  -- Conversation data
  conversation_history JSONB DEFAULT '[]', -- últimas 30 mensagens raw
  conversation_summary TEXT, -- resumo comprimido das mensagens antigas (gerado pela IA)
  
  -- AI state
  current_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  ai_paused BOOLEAN DEFAULT false,
  ai_force_enabled BOOLEAN,
  pause_reason TEXT,
  paused_at TIMESTAMPTZ,
  
  -- Context flags
  context_flags JSONB DEFAULT '{}', -- flags de estado (pending_reschedule, etc.)
  
  -- Timestamps
  last_interaction TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(chat_id, workspace_id)
);

CREATE INDEX idx_chat_memory_lead ON public.chat_memory(lead_id, workspace_id);

-- ============================================
-- 8. KNOWLEDGE_BASE (base de conhecimento + embeddings)
-- ============================================
CREATE TABLE public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  keywords TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_global BOOLEAN DEFAULT true,
  agent_ids UUID[] DEFAULT '{}', -- quais agents podem usar este item
  embedding vector(768), -- embedding para search semântica
  embedding_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kb_workspace_active ON public.knowledge_base(workspace_id, is_active) WHERE is_active = true;

-- ============================================
-- 9. SYSTEM_CONFIG (configs globais do workspace)
-- ============================================
CREATE TABLE public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, config_key)
);

-- ============================================
-- 10. APPOINTMENTS (agendamentos)
-- ============================================
DO $$ BEGIN
    CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'pending_lead');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status appointment_status DEFAULT 'scheduled',
  lead_confirmed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_appointments_workspace ON public.appointments(workspace_id);
CREATE INDEX idx_appointments_lead ON public.appointments(lead_id);
CREATE INDEX idx_appointments_time ON public.appointments(workspace_id, start_time);

-- ============================================
-- 11. PLATFORM_LOGS (logging de erros/ações)
-- ============================================
CREATE TABLE public.platform_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- RPC: Semantic search on knowledge_base
-- ============================================
CREATE OR REPLACE FUNCTION public.match_knowledge_base(
  query_embedding vector(768),
  p_workspace_id UUID,
  p_agent_id UUID DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.4,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  keywords TEXT[],
  priority INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    kb.keywords,
    kb.priority,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base kb
  WHERE kb.workspace_id = p_workspace_id
    AND kb.is_active = true
    AND kb.embedding IS NOT NULL
    AND (kb.is_global = true OR (p_agent_id IS NOT NULL AND p_agent_id = ANY(kb.agent_ids)))
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- ============================================
-- RLS POLICIES (basic)
-- ============================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_buffer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_logs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by edge functions)
CREATE POLICY "Service role full access" ON public.workspaces FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.message_buffer FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.chat_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.whatsapp_instances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.ai_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.knowledge_base FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.system_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.appointments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.platform_logs FOR ALL USING (true) WITH CHECK (true);

-- Authenticated users see their workspace data
CREATE POLICY "Users see own workspace" ON public.workspaces 
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users manage own workspace data" ON public.leads
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users manage own workspace data" ON public.messages
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users manage own workspace data" ON public.ai_agents
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users manage own workspace data" ON public.knowledge_base
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users manage own workspace data" ON public.appointments
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users manage own workspace data" ON public.whatsapp_instances
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users manage own workspace data" ON public.system_config
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

-- ============================================
-- Updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_whatsapp_instances_updated_at BEFORE UPDATE ON public.whatsapp_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_chat_memory_updated_at BEFORE UPDATE ON public.chat_memory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON public.knowledge_base FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON public.system_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

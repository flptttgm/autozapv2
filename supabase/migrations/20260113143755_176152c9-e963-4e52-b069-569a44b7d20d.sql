-- =============================================
-- FASE 1: Sistema de Tags para Leads
-- =============================================

-- Tabela de definição de tags (criadas pelo workspace)
CREATE TABLE public.lead_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

-- Tabela de associação lead-tag
CREATE TABLE public.lead_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.lead_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, tag_id)
);

-- Índices para performance
CREATE INDEX idx_lead_tags_workspace ON public.lead_tags(workspace_id);
CREATE INDEX idx_lead_tag_assignments_lead ON public.lead_tag_assignments(lead_id);
CREATE INDEX idx_lead_tag_assignments_tag ON public.lead_tag_assignments(tag_id);

-- Enable RLS
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies para lead_tags
CREATE POLICY "Users can view tags from their workspace"
ON public.lead_tags
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can create tags in their workspace"
ON public.lead_tags
FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update tags in their workspace"
ON public.lead_tags
FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete tags from their workspace"
ON public.lead_tags
FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- RLS Policies para lead_tag_assignments
CREATE POLICY "Users can view tag assignments from their workspace"
ON public.lead_tag_assignments
FOR SELECT
USING (
  lead_id IN (
    SELECT l.id FROM public.leads l
    WHERE l.workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create tag assignments in their workspace"
ON public.lead_tag_assignments
FOR INSERT
WITH CHECK (
  lead_id IN (
    SELECT l.id FROM public.leads l
    WHERE l.workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete tag assignments from their workspace"
ON public.lead_tag_assignments
FOR DELETE
USING (
  lead_id IN (
    SELECT l.id FROM public.leads l
    WHERE l.workspace_id IN (
      SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_lead_tags_updated_at
BEFORE UPDATE ON public.lead_tags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FASE 2: Modo Seletivo na Instância WhatsApp
-- =============================================

-- Adicionar colunas para modo seletivo
ALTER TABLE public.whatsapp_instances
ADD COLUMN ai_mode VARCHAR(20) NOT NULL DEFAULT 'all',
ADD COLUMN selective_tags UUID[] DEFAULT '{}';

-- Constraint para validar valores de ai_mode
ALTER TABLE public.whatsapp_instances
ADD CONSTRAINT chk_ai_mode CHECK (ai_mode IN ('all', 'selective'));

-- =============================================
-- FASE 3: Override Individual por Chat
-- =============================================

-- Adicionar coluna para override manual
-- null = segue regra da instância
-- true = força IA ativa
-- false = força IA desativada
ALTER TABLE public.chat_memory
ADD COLUMN ai_force_enabled BOOLEAN DEFAULT null;

-- Comentário explicativo
COMMENT ON COLUMN public.chat_memory.ai_force_enabled IS 
'Override manual para IA: null=segue instância, true=força ativado, false=força desativado';

COMMENT ON COLUMN public.whatsapp_instances.ai_mode IS 
'Modo de resposta da IA: all=responde todos, selective=responde apenas leads com tags específicas';

COMMENT ON COLUMN public.whatsapp_instances.selective_tags IS 
'Array de IDs de tags que ativam a IA quando ai_mode=selective';
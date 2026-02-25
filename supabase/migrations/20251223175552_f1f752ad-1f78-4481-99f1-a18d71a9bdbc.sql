-- Tabela permanente para registrar números de telefone usados
-- Esta tabela NUNCA deve ser deletada quando uma instância é excluída
CREATE TABLE public.phone_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  first_connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_at TIMESTAMPTZ,
  blocked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(phone)
);

-- Enable RLS
ALTER TABLE public.phone_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view workspace phone_registry"
ON public.phone_registry
FOR SELECT
USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Platform admins can view all phone_registry"
ON public.phone_registry
FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage phone_registry"
ON public.phone_registry
FOR ALL
USING (is_platform_admin(auth.uid()));

-- Índice para buscas rápidas por telefone
CREATE INDEX idx_phone_registry_phone ON public.phone_registry(phone);
CREATE INDEX idx_phone_registry_workspace ON public.phone_registry(workspace_id);
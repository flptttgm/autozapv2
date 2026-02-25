-- Tabela de configuração PIX do workspace
CREATE TABLE public.pix_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  pix_key TEXT NOT NULL,
  pix_key_type VARCHAR(20) NOT NULL CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')),
  receiver_name VARCHAR(25) NOT NULL,
  receiver_city VARCHAR(15) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id)
);

-- Tabela de cobranças
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'overdue', 'canceled')),
  pix_code TEXT,
  pix_qr_code TEXT,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'scheduled', 'agent'))
);

-- Tabela de cobranças agendadas/recorrentes
CREATE TABLE public.scheduled_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'custom')),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
  custom_days INTEGER CHECK (custom_days >= 1),
  next_due_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.pix_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_invoices ENABLE ROW LEVEL SECURITY;

-- Políticas para pix_config
CREATE POLICY "Members can view workspace pix_config"
  ON public.pix_config FOR SELECT
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Admins can create workspace pix_config"
  ON public.pix_config FOR INSERT
  WITH CHECK (workspace_id = get_user_workspace_id() AND is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Admins can update workspace pix_config"
  ON public.pix_config FOR UPDATE
  USING (workspace_id = get_user_workspace_id() AND is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Admins can delete workspace pix_config"
  ON public.pix_config FOR DELETE
  USING (workspace_id = get_user_workspace_id() AND is_workspace_admin(workspace_id, auth.uid()));

-- Políticas para invoices
CREATE POLICY "Members can view workspace invoices"
  ON public.invoices FOR SELECT
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can create workspace invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can update workspace invoices"
  ON public.invoices FOR UPDATE
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can delete workspace invoices"
  ON public.invoices FOR DELETE
  USING (workspace_id = get_user_workspace_id());

-- Políticas para scheduled_invoices
CREATE POLICY "Members can view workspace scheduled_invoices"
  ON public.scheduled_invoices FOR SELECT
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can create workspace scheduled_invoices"
  ON public.scheduled_invoices FOR INSERT
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can update workspace scheduled_invoices"
  ON public.scheduled_invoices FOR UPDATE
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can delete workspace scheduled_invoices"
  ON public.scheduled_invoices FOR DELETE
  USING (workspace_id = get_user_workspace_id());

-- Índices para performance
CREATE INDEX idx_invoices_workspace_id ON public.invoices(workspace_id);
CREATE INDEX idx_invoices_lead_id ON public.invoices(lead_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_scheduled_invoices_workspace_id ON public.scheduled_invoices(workspace_id);
CREATE INDEX idx_scheduled_invoices_next_due_date ON public.scheduled_invoices(next_due_date);
CREATE INDEX idx_scheduled_invoices_is_active ON public.scheduled_invoices(is_active);

-- Trigger para updated_at
CREATE TRIGGER update_pix_config_updated_at
  BEFORE UPDATE ON public.pix_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_invoices_updated_at
  BEFORE UPDATE ON public.scheduled_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
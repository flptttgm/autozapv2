-- Create asaas_customers table to store Asaas customer IDs linked to workspaces
CREATE TABLE public.asaas_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  asaas_customer_id TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id)
);

-- Create payments_history table to log all payments
CREATE TABLE public.payments_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  asaas_payment_id TEXT NOT NULL,
  asaas_subscription_id TEXT,
  billing_type TEXT NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  billing_cycle TEXT NOT NULL,
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  boleto_url TEXT,
  boleto_barcode TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE public.asaas_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for asaas_customers
CREATE POLICY "Members can view workspace asaas_customers"
ON public.asaas_customers FOR SELECT
USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can create workspace asaas_customers"
ON public.asaas_customers FOR INSERT
WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can update workspace asaas_customers"
ON public.asaas_customers FOR UPDATE
USING (workspace_id = get_user_workspace_id());

-- RLS policies for payments_history
CREATE POLICY "Members can view workspace payments_history"
ON public.payments_history FOR SELECT
USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can create workspace payments_history"
ON public.payments_history FOR INSERT
WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can update workspace payments_history"
ON public.payments_history FOR UPDATE
USING (workspace_id = get_user_workspace_id());

-- Add triggers for updated_at
CREATE TRIGGER update_asaas_customers_updated_at
BEFORE UPDATE ON public.asaas_customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_history_updated_at
BEFORE UPDATE ON public.payments_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
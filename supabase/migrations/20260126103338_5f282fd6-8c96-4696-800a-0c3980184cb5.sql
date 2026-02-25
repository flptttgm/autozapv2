-- Tabela de roles de vendedor (seguindo padrão de segurança)
CREATE TABLE public.seller_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'seller',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Funcao para verificar se usuario e vendedor (SECURITY DEFINER para evitar recursao RLS)
CREATE OR REPLACE FUNCTION public.is_seller(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.seller_roles
    WHERE user_id = _user_id
      AND role = 'seller'
  )
$$;

-- Tabela de vendedores
CREATE TABLE public.sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cpf_cnpj TEXT,
  asaas_wallet_id TEXT,
  installation_fee NUMERIC DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'suspended')),
  referral_code TEXT UNIQUE NOT NULL,
  total_sales INTEGER DEFAULT 0,
  total_commission NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de vendas dos vendedores
CREATE TABLE public.seller_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  payment_id TEXT,
  plan_type TEXT NOT NULL,
  billing_cycle TEXT DEFAULT 'monthly',
  sale_value NUMERIC NOT NULL,
  commission_value NUMERIC NOT NULL,
  commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para seller_roles
ALTER TABLE public.seller_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own seller role"
  ON public.seller_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins can manage seller_roles"
  ON public.seller_roles FOR ALL
  USING (is_platform_admin(auth.uid()));

-- RLS para sellers
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view own data"
  ON public.sellers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Sellers can update own data"
  ON public.sellers FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins can manage sellers"
  ON public.sellers FOR ALL
  USING (is_platform_admin(auth.uid()));

-- RLS para seller_sales
ALTER TABLE public.seller_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view own sales"
  ON public.seller_sales FOR SELECT
  USING (seller_id IN (
    SELECT id FROM public.sellers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Platform admins can manage seller_sales"
  ON public.seller_sales FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sellers_updated_at
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_sellers_referral_code ON public.sellers(referral_code);
CREATE INDEX idx_sellers_status ON public.sellers(status);
CREATE INDEX idx_seller_sales_seller_id ON public.seller_sales(seller_id);
CREATE INDEX idx_seller_sales_created_at ON public.seller_sales(created_at DESC);
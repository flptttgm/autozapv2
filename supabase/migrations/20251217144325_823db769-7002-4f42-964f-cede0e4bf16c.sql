-- Criar tabela de variantes de teste A/B
CREATE TABLE public.ab_test_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_name VARCHAR(100) NOT NULL,
  variant_key VARCHAR(10) NOT NULL,
  variant_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  weight INTEGER DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(test_name, variant_key)
);

-- Criar tabela de sessões de teste A/B
CREATE TABLE public.ab_test_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id VARCHAR(100) NOT NULL,
  test_name VARCHAR(100) NOT NULL,
  variant_key VARCHAR(10) NOT NULL,
  converted BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(visitor_id, test_name)
);

-- Adicionar coluna ab_variant na tabela landing_leads
ALTER TABLE public.landing_leads ADD COLUMN IF NOT EXISTS ab_variant VARCHAR(10);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.ab_test_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ab_test_variants (leitura pública, escrita admin)
CREATE POLICY "Anyone can view active variants" ON public.ab_test_variants
  FOR SELECT USING (is_active = true);

CREATE POLICY "Platform admins can manage variants" ON public.ab_test_variants
  FOR ALL USING (is_platform_admin(auth.uid()));

-- Políticas RLS para ab_test_sessions (inserção pública, leitura admin)
CREATE POLICY "Anyone can insert sessions" ON public.ab_test_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update own session" ON public.ab_test_sessions
  FOR UPDATE USING (true);

CREATE POLICY "Platform admins can view sessions" ON public.ab_test_sessions
  FOR SELECT USING (is_platform_admin(auth.uid()));

-- Inserir variantes iniciais do teste de hero
INSERT INTO public.ab_test_variants (test_name, variant_key, variant_name, weight) VALUES
  ('hero_v1', 'A', 'Controle (Atual)', 25),
  ('hero_v1', 'B', 'Foco no Preço', 25),
  ('hero_v1', 'C', 'Foco na Facilidade', 25),
  ('hero_v1', 'D', 'Preço + Facilidade', 25);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ab_test_variants_updated_at
  BEFORE UPDATE ON public.ab_test_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
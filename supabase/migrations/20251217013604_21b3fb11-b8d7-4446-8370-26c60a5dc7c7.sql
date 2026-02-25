-- Criar tabela para capturar leads da landing page
CREATE TABLE public.landing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'hero_cta',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY;

-- Permitir INSERT público (sem autenticação)
CREATE POLICY "Allow public insert on landing_leads"
ON public.landing_leads FOR INSERT TO anon
WITH CHECK (true);

-- Permitir platform admins visualizarem os leads
CREATE POLICY "Platform admins can view landing_leads"
ON public.landing_leads FOR SELECT
USING (public.is_platform_admin(auth.uid()));

-- Índice para busca rápida por email
CREATE INDEX idx_landing_leads_email ON public.landing_leads(email);
-- Permitir que usuários anônimos (não logados) façam INSERT na tabela landing_leads
GRANT INSERT ON public.landing_leads TO anon;

-- Garantir que o role anon pode usar o schema public
GRANT USAGE ON SCHEMA public TO anon;
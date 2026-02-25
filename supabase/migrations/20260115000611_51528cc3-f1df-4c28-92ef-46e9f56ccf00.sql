-- Adicionar coluna ai_enabled na tabela leads
-- Se true, a IA pode responder este lead quando em modo seletivo
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS ai_enabled boolean DEFAULT false;

COMMENT ON COLUMN public.leads.ai_enabled IS 
'Se true, a IA pode responder este lead quando a instância está em modo seletivo.';
-- Adicionar coluna is_favorite na tabela leads
ALTER TABLE public.leads 
ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;

-- Criar índice para ordenação eficiente por favoritos
CREATE INDEX idx_leads_is_favorite ON public.leads(workspace_id, is_favorite DESC);
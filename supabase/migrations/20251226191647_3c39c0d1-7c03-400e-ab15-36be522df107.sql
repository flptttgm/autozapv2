-- Adicionar coluna de status de embedding na knowledge_base
ALTER TABLE public.knowledge_base 
ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(20) DEFAULT 'pending';

-- Atualizar itens existentes com embedding para 'completed'
UPDATE public.knowledge_base 
SET embedding_status = 'completed' 
WHERE embedding IS NOT NULL;

-- Atualizar itens existentes sem embedding para 'pending'
UPDATE public.knowledge_base 
SET embedding_status = 'pending' 
WHERE embedding IS NULL;

-- Criar índice para facilitar consultas de itens pendentes
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding_status 
ON public.knowledge_base(embedding_status);

-- Criar função para obter estatísticas de embeddings (para o admin dashboard)
CREATE OR REPLACE FUNCTION public.get_embedding_stats()
RETURNS TABLE(
  total_items bigint,
  items_with_embedding bigint,
  items_pending bigint,
  items_failed bigint,
  workspaces_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COUNT(*)::bigint as total_items,
    COUNT(*) FILTER (WHERE embedding_status = 'completed')::bigint as items_with_embedding,
    COUNT(*) FILTER (WHERE embedding_status = 'pending')::bigint as items_pending,
    COUNT(*) FILTER (WHERE embedding_status = 'failed')::bigint as items_failed,
    COUNT(DISTINCT workspace_id)::bigint as workspaces_count
  FROM knowledge_base
  WHERE is_active = true;
$$;

-- Criar função para obter detalhes de embeddings por workspace
CREATE OR REPLACE FUNCTION public.get_embedding_stats_by_workspace()
RETURNS TABLE(
  workspace_id uuid,
  workspace_name text,
  total_items bigint,
  items_completed bigint,
  items_pending bigint,
  items_failed bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    kb.workspace_id,
    w.name as workspace_name,
    COUNT(*)::bigint as total_items,
    COUNT(*) FILTER (WHERE kb.embedding_status = 'completed')::bigint as items_completed,
    COUNT(*) FILTER (WHERE kb.embedding_status = 'pending')::bigint as items_pending,
    COUNT(*) FILTER (WHERE kb.embedding_status = 'failed')::bigint as items_failed
  FROM knowledge_base kb
  LEFT JOIN workspaces w ON w.id = kb.workspace_id
  WHERE kb.is_active = true
  GROUP BY kb.workspace_id, w.name
  ORDER BY items_pending DESC, w.name;
$$;
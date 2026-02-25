-- Fase 4: Criar RPC para métricas de qualidade de embeddings
CREATE OR REPLACE FUNCTION get_embedding_quality_stats(p_workspace_id UUID DEFAULT NULL)
RETURNS TABLE (
  tipo TEXT,
  total BIGINT
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN embedding IS NULL THEN 'SEM_EMBEDDING'
      WHEN embedding::text LIKE '%,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]' THEN 'HASH_FALLBACK'
      ELSE 'AI_GENERATED'
    END as tipo,
    COUNT(*) as total
  FROM knowledge_base 
  WHERE (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
    AND is_active = true
  GROUP BY 1
  ORDER BY 1;
$$;
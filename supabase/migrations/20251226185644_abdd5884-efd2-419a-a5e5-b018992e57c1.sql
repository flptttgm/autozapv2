-- Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Adicionar coluna de embedding na tabela knowledge_base (384 dimensões para gte-small)
ALTER TABLE knowledge_base 
ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Criar índice para busca rápida de similaridade
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
ON knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Criar função de busca semântica
CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding vector(384),
  p_workspace_id uuid,
  p_agent_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title varchar,
  content text,
  category varchar,
  keywords text[],
  priority int,
  similarity float
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    kb.keywords,
    kb.priority,
    1 - (kb.embedding <=> query_embedding) as similarity
  FROM knowledge_base kb
  WHERE kb.workspace_id = p_workspace_id
    AND kb.is_active = true
    AND kb.embedding IS NOT NULL
    AND (
      -- Item é global (aplica a todos os agentes)
      kb.is_global = true
      OR 
      -- Ou está vinculado ao agente específico
      (p_agent_id IS NOT NULL AND p_agent_id = ANY(kb.agent_ids))
    )
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.priority DESC, kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
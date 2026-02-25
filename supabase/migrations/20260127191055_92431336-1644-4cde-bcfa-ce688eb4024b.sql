-- ============================================
-- MIGRATION: Quick Reply Embeddings for Hybrid Mode
-- ============================================

-- 1. Create quick_reply_embeddings table
CREATE TABLE IF NOT EXISTS quick_reply_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES custom_templates(id) ON DELETE CASCADE,
  quick_reply_id TEXT NOT NULL,
  trigger_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  -- Generated column for consistent embedding source
  combined_text TEXT GENERATED ALWAYS AS (trigger_text || E'\n\n' || response_text) STORED,
  is_enabled BOOLEAN DEFAULT true,
  embedding vector(384),
  embedding_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(template_id, quick_reply_id)
);

-- 2. Create vector index (IVFFlat for cosine similarity)
CREATE INDEX IF NOT EXISTS quick_reply_embeddings_vector_idx 
ON quick_reply_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50);

-- 3. Create lookup index for efficient queries
CREATE INDEX IF NOT EXISTS quick_reply_embeddings_lookup_idx 
ON quick_reply_embeddings(workspace_id, is_enabled, embedding_status) 
WHERE is_enabled = true AND embedding_status = 'completed';

-- 4. Add hybrid_threshold column to agent_routing_config
ALTER TABLE agent_routing_config 
ADD COLUMN IF NOT EXISTS hybrid_threshold FLOAT DEFAULT 0.70
CHECK (hybrid_threshold >= 0.5 AND hybrid_threshold <= 0.95);

COMMENT ON COLUMN agent_routing_config.hybrid_threshold IS 
  'Threshold de similaridade para modo híbrido (0.50 a 0.95)';

-- 5. Create function to match quick replies via semantic search
CREATE OR REPLACE FUNCTION match_quick_replies(
  query_embedding vector(384),
  p_workspace_id uuid,
  p_template_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.70,
  match_count int DEFAULT 1
)
RETURNS TABLE (
  id uuid,
  template_id uuid,
  quick_reply_id text,
  trigger_text text,
  response_text text,
  similarity float
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qre.id,
    qre.template_id,
    qre.quick_reply_id,
    qre.trigger_text,
    qre.response_text,
    1 - (qre.embedding <=> query_embedding) as similarity
  FROM quick_reply_embeddings qre
  WHERE qre.workspace_id = p_workspace_id
    AND qre.is_enabled = true
    AND qre.embedding IS NOT NULL
    AND qre.embedding_status = 'completed'
    AND (p_template_id IS NULL OR qre.template_id = p_template_id)
    AND 1 - (qre.embedding <=> query_embedding) > match_threshold
  ORDER BY qre.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Create function for atomic claiming of pending embeddings (concurrency safe)
CREATE OR REPLACE FUNCTION claim_pending_quick_reply_embeddings(
  p_batch_size INT DEFAULT 20
)
RETURNS SETOF quick_reply_embeddings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE quick_reply_embeddings
  SET embedding_status = 'processing',
      updated_at = NOW()
  WHERE id IN (
    SELECT qre.id FROM quick_reply_embeddings qre
    WHERE qre.embedding_status = 'pending'
      AND qre.is_enabled = true
    ORDER BY qre.updated_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- 7. Create trigger function to sync quick replies to embeddings table
CREATE OR REPLACE FUNCTION queue_quick_reply_embedding()
RETURNS TRIGGER AS $$
DECLARE
  qr RECORD;
  workspace_id_val UUID;
  old_quick_replies JSONB;
  new_quick_replies JSONB;
  qr_id TEXT;
  new_trigger TEXT;
  new_response TEXT;
  new_enabled BOOLEAN;
  existing_record RECORD;
BEGIN
  -- Safe access to OLD (only exists in UPDATE)
  IF TG_OP = 'UPDATE' THEN
    old_quick_replies := COALESCE(OLD.config->'quick_replies', '[]'::jsonb);
  ELSE
    old_quick_replies := '[]'::jsonb;
  END IF;
  
  new_quick_replies := COALESCE(NEW.config->'quick_replies', '[]'::jsonb);
  
  -- Skip if nothing changed (UPDATE only)
  IF TG_OP = 'UPDATE' AND old_quick_replies = new_quick_replies THEN
    RETURN NEW;
  END IF;

  workspace_id_val := NEW.workspace_id;

  -- If no quick_replies, delete all embeddings for this template
  IF new_quick_replies = '[]'::jsonb OR new_quick_replies IS NULL THEN
    DELETE FROM quick_reply_embeddings WHERE template_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Process each quick reply
  FOR qr IN SELECT * FROM jsonb_array_elements(new_quick_replies)
  LOOP
    IF qr.value->>'id' IS NOT NULL AND qr.value->>'trigger' IS NOT NULL THEN
      qr_id := qr.value->>'id';
      new_trigger := trim(COALESCE(qr.value->>'trigger', ''));
      new_response := trim(COALESCE(qr.value->>'response', ''));
      new_enabled := COALESCE((qr.value->>'enabled')::boolean, true);
      
      -- Check for existing record
      SELECT * INTO existing_record 
      FROM quick_reply_embeddings 
      WHERE template_id = NEW.id AND quick_reply_id = qr_id;
      
      IF existing_record IS NULL THEN
        -- INSERT new record
        INSERT INTO quick_reply_embeddings (
          workspace_id, template_id, quick_reply_id,
          trigger_text, response_text, is_enabled,
          embedding_status, updated_at
        ) VALUES (
          workspace_id_val, NEW.id, qr_id,
          new_trigger, new_response, new_enabled,
          'pending', NOW()
        );
      ELSE
        -- Check what changed (with trim normalization)
        IF trim(existing_record.trigger_text) != new_trigger 
           OR trim(existing_record.response_text) != new_response THEN
          -- Trigger or response changed -> needs new embedding
          UPDATE quick_reply_embeddings SET
            trigger_text = new_trigger,
            response_text = new_response,
            is_enabled = new_enabled,
            embedding_status = 'pending',
            embedding = NULL,
            updated_at = NOW()
          WHERE id = existing_record.id;
        ELSIF existing_record.is_enabled != new_enabled THEN
          -- Only enabled changed -> DON'T reprocess embedding
          UPDATE quick_reply_embeddings SET
            is_enabled = new_enabled,
            updated_at = NOW()
          WHERE id = existing_record.id;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  -- Delete embeddings for removed quick replies
  DELETE FROM quick_reply_embeddings 
  WHERE template_id = NEW.id
    AND quick_reply_id NOT IN (
      SELECT value->>'id' 
      FROM jsonb_array_elements(new_quick_replies)
      WHERE value->>'id' IS NOT NULL
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger on custom_templates
DROP TRIGGER IF EXISTS template_quick_reply_sync ON custom_templates;
CREATE TRIGGER template_quick_reply_sync
AFTER INSERT OR UPDATE OF config ON custom_templates
FOR EACH ROW
EXECUTE FUNCTION queue_quick_reply_embedding();

-- 9. Enable RLS
ALTER TABLE quick_reply_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace quick reply embeddings"
ON quick_reply_embeddings FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);
-- ==============================================
-- FASE 1: Alterar CRON para cada 15 minutos
-- ==============================================
SELECT cron.alter_job(
  job_id := 7,
  schedule := '*/15 * * * *'
);

-- ==============================================
-- FASE 2: Trigger para gerar embedding automaticamente
-- ==============================================

-- Função que dispara a geração de embedding (assíncrona via pg_net)
CREATE OR REPLACE FUNCTION trigger_generate_embedding_async()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_hash TEXT;
  new_hash TEXT;
BEGIN
  -- Proteção anti-loop: só dispara se conteúdo realmente mudou (UPDATE apenas)
  IF TG_OP = 'UPDATE' THEN
    old_hash := MD5(
      COALESCE(OLD.title::text, '') || 
      COALESCE(OLD.content::text, '') || 
      COALESCE(array_to_string(OLD.keywords, ','), '')
    );
    new_hash := MD5(
      COALESCE(NEW.title::text, '') || 
      COALESCE(NEW.content::text, '') || 
      COALESCE(array_to_string(NEW.keywords, ','), '')
    );
    
    IF old_hash = new_hash THEN
      -- Conteúdo não mudou, não disparar
      RETURN NEW;
    END IF;
  END IF;

  -- Chamar edge function via pg_net (assíncrono, não bloqueia)
  PERFORM net.http_post(
    url := 'https://ldcqgdrutloatcmtxquw.supabase.co/functions/v1/generate-embedding',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkY3FnZHJ1dGxvYXRjbXR4cXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODIyNDEsImV4cCI6MjA3OTc1ODI0MX0.57f08x5YXbCqIyM5-ojbnpBPBrPb2TEnhf8JBmrJWHE'
    ),
    body := jsonb_build_object(
      'action', 'generate_for_item',
      'knowledge_item_id', NEW.id
    )
  );
  
  RETURN NEW;
END;
$$;

-- Dropar trigger existente se houver
DROP TRIGGER IF EXISTS kb_auto_embed_trigger ON knowledge_base;

-- Criar trigger que executa após INSERT ou UPDATE de title/content/keywords
CREATE TRIGGER kb_auto_embed_trigger
AFTER INSERT OR UPDATE OF title, content, keywords ON knowledge_base
FOR EACH ROW
WHEN (NEW.embedding_status = 'pending' AND NEW.is_active = true)
EXECUTE FUNCTION trigger_generate_embedding_async();
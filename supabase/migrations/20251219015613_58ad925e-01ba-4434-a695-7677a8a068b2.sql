-- Add whatsapp_instance_id column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS whatsapp_instance_id VARCHAR NULL;

-- Backfill existing leads based on messages metadata
UPDATE leads l
SET whatsapp_instance_id = (
  SELECT DISTINCT (m.metadata->>'instanceId')::varchar
  FROM messages m
  WHERE m.lead_id = l.id
  AND m.metadata->>'instanceId' IS NOT NULL
  LIMIT 1
)
WHERE l.whatsapp_instance_id IS NULL;
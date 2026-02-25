-- Consolidate duplicate chat_memory entries by lead_id, keeping the oldest one
-- This fixes the issue where multiple chat_memory records exist for the same lead
-- due to WhatsApp alternating between @lid and @s.whatsapp.net formats

WITH duplicates AS (
  SELECT 
    id,
    lead_id,
    workspace_id,
    chat_id,
    ai_paused,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY lead_id, workspace_id 
      ORDER BY created_at ASC
    ) as rn
  FROM chat_memory
  WHERE lead_id IS NOT NULL
)
DELETE FROM chat_memory
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
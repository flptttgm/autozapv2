-- Add columns to track pause reason and context
ALTER TABLE chat_memory 
ADD COLUMN IF NOT EXISTS pause_reason text,
ADD COLUMN IF NOT EXISTS paused_at timestamptz,
ADD COLUMN IF NOT EXISTS paused_by uuid;
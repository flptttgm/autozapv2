-- Add is_group column to message_buffer for redundant group detection
ALTER TABLE message_buffer ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;

-- Add index for faster group filtering
CREATE INDEX IF NOT EXISTS idx_message_buffer_is_group ON message_buffer(is_group) WHERE is_group = true;
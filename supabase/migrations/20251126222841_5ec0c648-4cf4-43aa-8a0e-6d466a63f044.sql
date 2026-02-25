-- Update the messages direction check constraint to allow 'outbound_manual'
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_direction_check;

ALTER TABLE messages ADD CONSTRAINT messages_direction_check 
  CHECK (direction IN ('inbound', 'outbound', 'outbound_manual'));
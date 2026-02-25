-- ============================================
-- 03. Add missing columns to whatsapp_instances
-- Run this in the SQL Editor
-- ============================================

-- Add instance_token (required for Z-API Partner API calls)
ALTER TABLE public.whatsapp_instances 
  ADD COLUMN IF NOT EXISTS instance_token TEXT;

-- Add status column for connection tracking
ALTER TABLE public.whatsapp_instances 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'disconnected';

-- Add connected_at timestamp
ALTER TABLE public.whatsapp_instances 
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

-- Add subscribed flag
ALTER TABLE public.whatsapp_instances 
  ADD COLUMN IF NOT EXISTS subscribed BOOLEAN DEFAULT true;

-- Also add missing columns to messages table (used by send-message and zapi-webhook)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS zapi_message_id TEXT;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Add outbound_manual direction support
ALTER TABLE public.messages 
  DROP CONSTRAINT IF EXISTS messages_direction_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_direction_check 
  CHECK (direction IN ('inbound', 'outbound', 'outbound_manual'));

-- Success!
SELECT 'Schema updated successfully!' as result;

-- Add columns for email tracking and channels to broadcast_notifications
ALTER TABLE broadcast_notifications 
ADD COLUMN IF NOT EXISTS email_sent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_failed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS channels text[] DEFAULT ARRAY['in_app', 'push'];
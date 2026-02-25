-- Add columns to magic_link_tokens for signup flow
ALTER TABLE magic_link_tokens
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'magiclink';
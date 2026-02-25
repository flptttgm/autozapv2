-- Add pause columns to whatsapp_instances table
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS paused_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS pause_reason text;
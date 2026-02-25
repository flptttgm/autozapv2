-- Add columns to track Z-API subscription status
ALTER TABLE whatsapp_instances 
ADD COLUMN IF NOT EXISTS subscribed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN whatsapp_instances.subscribed IS 'Indicates if the instance was subscribed in Z-API after payment';
COMMENT ON COLUMN whatsapp_instances.subscribed_at IS 'Timestamp when the instance was subscribed';
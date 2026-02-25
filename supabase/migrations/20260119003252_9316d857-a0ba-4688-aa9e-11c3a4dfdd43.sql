-- Add new columns to quotes table for manual creation and tracking
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'auto';

-- Add comment for documentation
COMMENT ON COLUMN quotes.source IS 'Origin of quote: auto (AI detected) or manual (user created)';
COMMENT ON COLUMN quotes.sent_at IS 'Timestamp when quote was sent via WhatsApp';
COMMENT ON COLUMN quotes.valid_until IS 'Quote validity expiration date';
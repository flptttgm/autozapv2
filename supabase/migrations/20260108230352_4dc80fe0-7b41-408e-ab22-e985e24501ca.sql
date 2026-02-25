-- Add avatar_url column to custom_templates
ALTER TABLE custom_templates 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;
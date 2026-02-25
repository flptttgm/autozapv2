-- Migration: Make ai_enabled default to TRUE and update existing leads
-- This prevents immediate blocking when the new logic is deployed

-- First, update all existing leads that have NULL or false to true
UPDATE leads 
SET ai_enabled = true 
WHERE ai_enabled IS NULL OR ai_enabled = false;

-- Then, update the default for new leads to be true
ALTER TABLE leads 
ALTER COLUMN ai_enabled SET DEFAULT true;
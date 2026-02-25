-- Remove the unique constraint on workspace_id to allow multiple WhatsApp instances per workspace
-- This is needed for PRO and Business plans that allow multiple connections

ALTER TABLE whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_workspace_id_key;
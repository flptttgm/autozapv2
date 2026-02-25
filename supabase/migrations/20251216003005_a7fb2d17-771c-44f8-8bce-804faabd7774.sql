-- Drop the unique constraint on config_key that prevents multi-tenant configs
ALTER TABLE public.system_config DROP CONSTRAINT IF EXISTS system_config_config_key_key;

-- Create a new unique constraint on config_key + workspace_id combination
ALTER TABLE public.system_config ADD CONSTRAINT system_config_config_key_workspace_unique UNIQUE (config_key, workspace_id);
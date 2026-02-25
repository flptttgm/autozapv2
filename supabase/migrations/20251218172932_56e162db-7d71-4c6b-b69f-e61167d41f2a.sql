-- 1. Remover constraint global de phone único
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_phone_key;

-- 2. Adicionar constraint de phone único POR workspace
ALTER TABLE leads ADD CONSTRAINT leads_phone_workspace_unique UNIQUE (phone, workspace_id);

-- 3. Limpar leads criados incorretamente com @lid no phone (chat_id de grupos/calls)
DELETE FROM leads WHERE phone LIKE '%@lid%';
-- Adicionar foreign key com CASCADE na tabela subscriptions
ALTER TABLE subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_workspace_id_fkey;

ALTER TABLE subscriptions 
ADD CONSTRAINT subscriptions_workspace_id_fkey 
FOREIGN KEY (workspace_id) 
REFERENCES workspaces(id) 
ON DELETE CASCADE;
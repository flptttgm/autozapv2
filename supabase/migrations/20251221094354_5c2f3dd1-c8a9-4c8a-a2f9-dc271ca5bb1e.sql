-- Remover políticas permissivas que permitem qualquer membro acessar dados financeiros
DROP POLICY IF EXISTS "Members can view workspace asaas_customers" ON asaas_customers;
DROP POLICY IF EXISTS "Members can update workspace asaas_customers" ON asaas_customers;
DROP POLICY IF EXISTS "Members can create workspace asaas_customers" ON asaas_customers;

-- Criar políticas restritas apenas para admins/owners do workspace
CREATE POLICY "Workspace admins can view asaas_customers" 
ON asaas_customers FOR SELECT 
USING (is_workspace_admin(workspace_id, auth.uid()) OR is_platform_admin(auth.uid()));

CREATE POLICY "Workspace admins can create asaas_customers" 
ON asaas_customers FOR INSERT 
WITH CHECK (is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins can update asaas_customers" 
ON asaas_customers FOR UPDATE 
USING (is_workspace_admin(workspace_id, auth.uid()));
-- Remover políticas inseguras que permitem acesso anônimo
DROP POLICY IF EXISTS "Allow anon select on landing_leads" ON landing_leads;
DROP POLICY IF EXISTS "Allow anon update on landing_leads" ON landing_leads;

-- Criar política para admins poderem atualizar leads
CREATE POLICY "Platform admins can update landing_leads" 
ON landing_leads FOR UPDATE 
USING (is_platform_admin(auth.uid()));
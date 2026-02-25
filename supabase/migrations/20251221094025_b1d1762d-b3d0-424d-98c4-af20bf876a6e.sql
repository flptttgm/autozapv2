-- Corrigir políticas RLS da tabela magic_link_tokens
-- Remover políticas públicas inseguras
DROP POLICY IF EXISTS "Allow select magic link tokens" ON magic_link_tokens;
DROP POLICY IF EXISTS "Allow update magic link tokens" ON magic_link_tokens;

-- Manter apenas INSERT público (necessário para signup/recovery via edge functions)
-- SELECT e UPDATE serão feitos via service_role nas edge functions

-- Adicionar política para admins gerenciarem tokens (opcional, para limpeza)
CREATE POLICY "Platform admins can manage magic_link_tokens" 
ON magic_link_tokens FOR ALL 
USING (is_platform_admin(auth.uid()));

-- Limpar tokens existentes (expirados, usados ou do tipo magiclink)
DELETE FROM magic_link_tokens 
WHERE action_type = 'magiclink' 
   OR expires_at < NOW() 
   OR used_at IS NOT NULL;
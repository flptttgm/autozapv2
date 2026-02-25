-- =====================================================
-- SECURITY FIX: Restringir acesso público a dados sensíveis
-- =====================================================

-- 1. PAGE_VIEWS: Remover acesso público de leitura (dados de comportamento do usuário)
DROP POLICY IF EXISTS "Anyone can read page views" ON page_views;

-- Criar política restrita apenas para platform admins
CREATE POLICY "Platform admins can view page views" 
ON page_views FOR SELECT 
USING (public.is_platform_admin(auth.uid()));

-- 2. AB_TEST_SESSIONS: Remover políticas públicas
DROP POLICY IF EXISTS "anon_select_sessions" ON ab_test_sessions;
DROP POLICY IF EXISTS "anon_update_sessions" ON ab_test_sessions;

-- Criar política restrita para admins
CREATE POLICY "Platform admins can view ab_test_sessions" 
ON ab_test_sessions FOR SELECT 
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage ab_test_sessions" 
ON ab_test_sessions FOR ALL 
USING (public.is_platform_admin(auth.uid()));

-- Manter insert anônimo para tracking (mas sem update/select público)
CREATE POLICY "Anon can insert ab_test_sessions" 
ON ab_test_sessions FOR INSERT 
WITH CHECK (true);

-- 3. AB_TEST_VARIANTS: Remover acesso público
DROP POLICY IF EXISTS "Anyone can view active variants" ON ab_test_variants;

-- Criar política restrita para admins
CREATE POLICY "Platform admins can view ab_test_variants" 
ON ab_test_variants FOR SELECT 
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can manage ab_test_variants" 
ON ab_test_variants FOR ALL 
USING (public.is_platform_admin(auth.uid()));
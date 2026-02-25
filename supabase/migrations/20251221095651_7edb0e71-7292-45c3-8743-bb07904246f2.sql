-- Limpar políticas RLS duplicadas e obsoletas

-- ab_test_sessions: remover políticas antigas que permitem acesso anônimo
DROP POLICY IF EXISTS "anon_select_sessions" ON public.ab_test_sessions;
DROP POLICY IF EXISTS "anon_insert_sessions" ON public.ab_test_sessions;
DROP POLICY IF EXISTS "anon_update_sessions" ON public.ab_test_sessions;
DROP POLICY IF EXISTS "Anyone can read sessions" ON public.ab_test_sessions;
DROP POLICY IF EXISTS "Anyone can insert sessions" ON public.ab_test_sessions;
DROP POLICY IF EXISTS "Anyone can update own sessions" ON public.ab_test_sessions;

-- page_views: remover políticas antigas que permitem acesso público
DROP POLICY IF EXISTS "Anyone can read page views" ON public.page_views;
DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;

-- Garantir que as políticas corretas existem para ab_test_sessions
-- Apenas admins podem ver, mas anônimos podem inserir para tracking (via edge function)
DO $$ 
BEGIN
  -- Verificar se política de admin já existe
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ab_test_sessions' AND policyname = 'Platform admins can view sessions') THEN
    CREATE POLICY "Platform admins can view sessions"
    ON public.ab_test_sessions
    FOR SELECT
    USING (public.is_platform_admin(auth.uid()));
  END IF;
END $$;

-- Garantir que as políticas corretas existem para page_views
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'page_views' AND policyname = 'Platform admins can view page views') THEN
    CREATE POLICY "Platform admins can view page views"
    ON public.page_views
    FOR SELECT
    USING (public.is_platform_admin(auth.uid()));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'page_views' AND policyname = 'Service role can insert page views') THEN
    CREATE POLICY "Service role can insert page views"
    ON public.page_views
    FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;
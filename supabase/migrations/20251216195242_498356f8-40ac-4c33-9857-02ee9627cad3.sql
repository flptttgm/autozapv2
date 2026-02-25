-- =============================================
-- FIX 1: Remove public policies from system_config
-- =============================================

-- Drop overly permissive public policies
DROP POLICY IF EXISTS "Enable read on system_config" ON public.system_config;
DROP POLICY IF EXISTS "Enable insert on system_config" ON public.system_config;
DROP POLICY IF EXISTS "Enable update on system_config" ON public.system_config;

-- The workspace-scoped policies already exist and will remain:
-- "Members can create workspace system_config"
-- "Members can delete workspace system_config"
-- "Members can update workspace system_config"
-- "Members can view workspace system_config"

-- =============================================
-- FIX 2: Restrict page_views SELECT to platform admins
-- =============================================

-- Drop the public SELECT policy
DROP POLICY IF EXISTS "Anyone can read page views" ON public.page_views;

-- Create new policy: Only platform admins can read page views
CREATE POLICY "Platform admins can read page views"
ON public.page_views
FOR SELECT
USING (is_platform_admin(auth.uid()));

-- Keep the INSERT policy public for anonymous tracking (this is intentional)
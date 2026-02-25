-- ============================================
-- 21. DB DATA CLEANUP
-- Removes hardcoded test IDs used during development
-- ============================================

-- Delete hardcoded test data by ID
DELETE FROM public.leads WHERE id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.whatsapp_instances WHERE id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.ai_agents WHERE id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.workspaces WHERE id = '00000000-0000-0000-0000-000000000001';

-- Truncate logs to start fresh
TRUNCATE TABLE public.app_logs;

SELECT 'Mock data cleaned up!' as result;

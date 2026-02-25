-- ============================================
-- 04. Insert Real Z-API Instance
-- ============================================

-- Update the test whatsapp_instance with real Z-API Partner data
DELETE FROM public.whatsapp_instances WHERE id = '00000000-0000-0000-0000-000000000001';

INSERT INTO public.whatsapp_instances (id, workspace_id, instance_id, instance_token, display_name, status, is_connected, ai_agent_id, ai_mode)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '3EEB11D1421140F31C7242F628B35EC0',
  'D4C2FC74AF2F4F678EE8A93F61B27185',
  'Autozap Trial',
  'disconnected',
  false,
  '00000000-0000-0000-0000-000000000001',
  'all'
);

SELECT 'Instance inserted!' as result;

-- ============================================
-- 05. Create Admin User & Link Everything (Fixed)
-- ============================================

DO $$
DECLARE
  -- You can change this ID if you want, but keeping it fixed helps seeder
  target_user_id UUID := '00000000-0000-0000-0000-000000000000'; 
  target_email TEXT := 'gabrielrkmoura@gmail.com';
BEGIN
  -- 1. Check if user exists to Insert or Update
  -- We do this manually to avoid "ON CONFLICT" errors with missing constraints
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = target_email) THEN
    -- Update existing user password
    UPDATE auth.users
    SET encrypted_password = crypt('fullaccess', gen_salt('bf')),
        updated_at = now()
    WHERE email = target_email;
  ELSE
    -- Insert new user
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      target_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      target_email,
      crypt('fullaccess', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"full_name": "Gabriel Moura"}',
      now(),
      now()
    );
  END IF;

  -- 2. Link Workspace to this User
  UPDATE public.workspaces 
  SET owner_id = (SELECT id FROM auth.users WHERE email = target_email)
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- 3. Ensure Instance is linked to Workspace
  UPDATE public.whatsapp_instances
  SET workspace_id = '00000000-0000-0000-0000-000000000001'
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- 4. Ensure AI Agent is linked
  UPDATE public.ai_agents
  SET workspace_id = '00000000-0000-0000-0000-000000000001'
  WHERE id = '00000000-0000-0000-0000-000000000001';

END $$;

SELECT 'User check/create completed successfully!' as result;

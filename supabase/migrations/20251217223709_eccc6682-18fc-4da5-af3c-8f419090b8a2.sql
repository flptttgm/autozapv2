-- Drop ALL existing policies on ab_test_sessions
DROP POLICY IF EXISTS "Allow anonymous insert sessions" ON ab_test_sessions;
DROP POLICY IF EXISTS "Allow update sessions" ON ab_test_sessions;
DROP POLICY IF EXISTS "Platform admins can view sessions" ON ab_test_sessions;
DROP POLICY IF EXISTS "Anyone can insert sessions" ON ab_test_sessions;
DROP POLICY IF EXISTS "Anyone can update own session" ON ab_test_sessions;
DROP POLICY IF EXISTS "anon_insert_sessions" ON ab_test_sessions;
DROP POLICY IF EXISTS "anon_update_sessions" ON ab_test_sessions;
DROP POLICY IF EXISTS "admin_select_sessions" ON ab_test_sessions;

-- Force schema refresh by disabling and re-enabling RLS
ALTER TABLE ab_test_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_sessions ENABLE ROW LEVEL SECURITY;

-- Create new policies with explicit AS PERMISSIVE syntax
CREATE POLICY "anon_insert_sessions" ON ab_test_sessions
AS PERMISSIVE FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "anon_update_sessions" ON ab_test_sessions
AS PERMISSIVE FOR UPDATE TO anon, authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "admin_select_sessions" ON ab_test_sessions
AS PERMISSIVE FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()));

-- Ensure explicit GRANTs
GRANT SELECT, INSERT, UPDATE ON ab_test_sessions TO anon;
GRANT SELECT, INSERT, UPDATE ON ab_test_sessions TO authenticated;
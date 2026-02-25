-- Add SELECT policy for anon (required for UPSERT to work)
CREATE POLICY "anon_select_sessions" ON ab_test_sessions
AS PERMISSIVE FOR SELECT 
TO anon, authenticated
USING (true);
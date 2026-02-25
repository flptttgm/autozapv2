-- Drop existing policies that aren't working correctly
DROP POLICY IF EXISTS "Anyone can insert sessions" ON ab_test_sessions;
DROP POLICY IF EXISTS "Anyone can update own session" ON ab_test_sessions;

-- Create new policies with explicit role grants for anon and authenticated
CREATE POLICY "Allow anonymous insert sessions"
ON public.ab_test_sessions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow update sessions"
ON public.ab_test_sessions
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
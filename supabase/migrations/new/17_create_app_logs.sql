CREATE TABLE IF NOT EXISTS public.app_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    level TEXT DEFAULT 'info',
    message TEXT,
    details JSONB
);

-- Protect the logs table
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert to app_logs"
ON public.app_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow members to view logs"
ON public.app_logs FOR SELECT
USING (auth.role() = 'authenticated');

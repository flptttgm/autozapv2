-- Create page_views table for tracking visits
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path varchar(255) NOT NULL,
  visitor_id varchar(100),
  referrer text,
  user_agent text,
  ip_hash varchar(64),
  created_at timestamptz DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_page_views_created_at ON page_views(created_at);
CREATE INDEX idx_page_views_visitor_id ON page_views(visitor_id);

-- Enable RLS with public policies
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert page views (for tracking)
CREATE POLICY "Anyone can insert page views" ON page_views FOR INSERT WITH CHECK (true);

-- Anyone can read page views (for public stats)
CREATE POLICY "Anyone can read page views" ON page_views FOR SELECT USING (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE page_views;

-- Create a function to get platform stats
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE (
  total_users bigint,
  total_workspaces bigint,
  total_leads bigint,
  total_messages bigint,
  visits_today bigint,
  unique_visitors_today bigint,
  total_visits bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM auth.users)::bigint as total_users,
    (SELECT COUNT(*) FROM workspaces)::bigint as total_workspaces,
    (SELECT COUNT(*) FROM leads)::bigint as total_leads,
    (SELECT COUNT(*) FROM messages)::bigint as total_messages,
    (SELECT COUNT(*) FROM page_views WHERE created_at > NOW() - INTERVAL '24 hours')::bigint as visits_today,
    (SELECT COUNT(DISTINCT visitor_id) FROM page_views WHERE created_at > NOW() - INTERVAL '24 hours')::bigint as unique_visitors_today,
    (SELECT COUNT(*) FROM page_views)::bigint as total_visits;
$$;
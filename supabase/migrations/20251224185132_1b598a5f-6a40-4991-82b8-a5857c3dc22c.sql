
-- Create a function to get page view activity data grouped by hour or day
CREATE OR REPLACE FUNCTION public.get_page_view_activity(
  period_type text DEFAULT '24h',
  days_ago integer DEFAULT 1
)
RETURNS TABLE(period_key text, visit_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN period_type = '24h' THEN to_char(created_at, 'YYYY-MM-DD"T"HH24')
      ELSE to_char(created_at, 'YYYY-MM-DD')
    END as period_key,
    COUNT(*) as visit_count
  FROM page_views
  WHERE created_at > NOW() - (days_ago || ' days')::interval
  GROUP BY period_key
  ORDER BY period_key ASC;
$$;

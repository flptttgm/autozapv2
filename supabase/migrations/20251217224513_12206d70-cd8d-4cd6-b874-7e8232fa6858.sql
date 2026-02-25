-- Allow anyone to read page_views (data is not sensitive - just paths, anonymous visitor IDs, timestamps)
CREATE POLICY "Anyone can read page views"
ON page_views
AS PERMISSIVE FOR SELECT
TO anon, authenticated
USING (true);
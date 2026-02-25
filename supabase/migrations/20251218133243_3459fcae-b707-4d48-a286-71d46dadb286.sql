-- Create table for broadcast notifications history
CREATE TABLE public.broadcast_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  url text DEFAULT '/',
  sent_by uuid REFERENCES auth.users(id),
  sent_at timestamptz DEFAULT now(),
  total_recipients integer DEFAULT 0,
  successful_sends integer DEFAULT 0,
  failed_sends integer DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broadcast_notifications ENABLE ROW LEVEL SECURITY;

-- Only platform admins can manage broadcast notifications
CREATE POLICY "Platform admins can view broadcast_notifications"
ON public.broadcast_notifications
FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can insert broadcast_notifications"
ON public.broadcast_notifications
FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update broadcast_notifications"
ON public.broadcast_notifications
FOR UPDATE
USING (is_platform_admin(auth.uid()));
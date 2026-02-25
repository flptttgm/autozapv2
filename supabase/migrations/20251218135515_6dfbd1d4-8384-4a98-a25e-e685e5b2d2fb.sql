-- Create user_notifications table for in-app notifications
CREATE TABLE public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  broadcast_id uuid REFERENCES public.broadcast_notifications(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  url text DEFAULT '/',
  type text DEFAULT 'broadcast',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.user_notifications FOR SELECT
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.user_notifications FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.user_notifications FOR DELETE
USING (user_id = auth.uid());

-- Platform admins can view all notifications
CREATE POLICY "Platform admins can view all notifications"
ON public.user_notifications FOR SELECT
USING (is_platform_admin(auth.uid()));

-- Platform admins can insert notifications for any user
CREATE POLICY "Platform admins can insert notifications"
ON public.user_notifications FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()));

-- Enable realtime for user_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- Create index for faster queries
CREATE INDEX idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX idx_user_notifications_is_read ON public.user_notifications(user_id, is_read);
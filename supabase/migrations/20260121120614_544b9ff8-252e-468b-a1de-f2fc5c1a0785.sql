-- Create table for group welcome messages configuration
CREATE TABLE public.group_welcome_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  group_phone VARCHAR(100) NOT NULL,
  group_name VARCHAR(255),
  message TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  send_private BOOLEAN DEFAULT false,
  delay_seconds INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(workspace_id, group_phone)
);

-- Enable RLS
ALTER TABLE public.group_welcome_messages ENABLE ROW LEVEL SECURITY;

-- Policy for workspace members to view their welcome messages
CREATE POLICY "Workspace members can view welcome messages"
ON public.group_welcome_messages
FOR SELECT
TO authenticated
USING (workspace_id IN (
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
));

-- Policy for workspace members to insert welcome messages
CREATE POLICY "Workspace members can insert welcome messages"
ON public.group_welcome_messages
FOR INSERT
TO authenticated
WITH CHECK (workspace_id IN (
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
));

-- Policy for workspace members to update welcome messages
CREATE POLICY "Workspace members can update welcome messages"
ON public.group_welcome_messages
FOR UPDATE
TO authenticated
USING (workspace_id IN (
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
));

-- Policy for workspace members to delete welcome messages
CREATE POLICY "Workspace members can delete welcome messages"
ON public.group_welcome_messages
FOR DELETE
TO authenticated
USING (workspace_id IN (
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
));

-- Create index for faster lookups
CREATE INDEX idx_group_welcome_workspace ON public.group_welcome_messages(workspace_id);
CREATE INDEX idx_group_welcome_group_phone ON public.group_welcome_messages(group_phone);
CREATE INDEX idx_group_welcome_enabled ON public.group_welcome_messages(enabled) WHERE enabled = true;

-- Trigger for updated_at
CREATE TRIGGER update_group_welcome_messages_updated_at
BEFORE UPDATE ON public.group_welcome_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
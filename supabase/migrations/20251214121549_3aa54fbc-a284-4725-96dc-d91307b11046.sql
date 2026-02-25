-- Create whatsapp_instances table for Z-API Partners
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
  instance_id VARCHAR NOT NULL,
  instance_token VARCHAR NOT NULL,
  phone VARCHAR,
  status VARCHAR DEFAULT 'disconnected',
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view workspace whatsapp_instances"
ON public.whatsapp_instances
FOR SELECT
USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can create workspace whatsapp_instances"
ON public.whatsapp_instances
FOR INSERT
WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can update workspace whatsapp_instances"
ON public.whatsapp_instances
FOR UPDATE
USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can delete workspace whatsapp_instances"
ON public.whatsapp_instances
FOR DELETE
USING (workspace_id = get_user_workspace_id());

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
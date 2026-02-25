-- Create custom_templates table for user-defined AI templates
CREATE TABLE public.custom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'user-cog',
  config JSONB NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for workspace lookup
CREATE INDEX idx_custom_templates_workspace ON public.custom_templates(workspace_id);

-- Enable RLS
ALTER TABLE public.custom_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view workspace custom_templates" 
  ON public.custom_templates FOR SELECT 
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can create workspace custom_templates" 
  ON public.custom_templates FOR INSERT 
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can update workspace custom_templates" 
  ON public.custom_templates FOR UPDATE 
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can delete workspace custom_templates" 
  ON public.custom_templates FOR DELETE 
  USING (workspace_id = get_user_workspace_id());

-- Trigger for updated_at
CREATE TRIGGER update_custom_templates_updated_at
  BEFORE UPDATE ON public.custom_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
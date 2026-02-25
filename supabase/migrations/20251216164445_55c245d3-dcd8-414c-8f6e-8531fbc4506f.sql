-- Create knowledge_base table for AI context
CREATE TABLE public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_knowledge_base_workspace ON public.knowledge_base(workspace_id);
CREATE INDEX idx_knowledge_base_category ON public.knowledge_base(category);
CREATE INDEX idx_knowledge_base_active ON public.knowledge_base(is_active);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view workspace knowledge_base"
  ON public.knowledge_base FOR SELECT
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can create workspace knowledge_base"
  ON public.knowledge_base FOR INSERT
  WITH CHECK (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can update workspace knowledge_base"
  ON public.knowledge_base FOR UPDATE
  USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can delete workspace knowledge_base"
  ON public.knowledge_base FOR DELETE
  USING (workspace_id = get_user_workspace_id());

-- Trigger for updated_at
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON public.knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
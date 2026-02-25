-- Create audit_logs table for tracking configuration changes
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  changes_summary TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view workspace audit_logs"
ON public.audit_logs
FOR SELECT
USING (workspace_id = get_user_workspace_id());

CREATE POLICY "Members can create workspace audit_logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (workspace_id = get_user_workspace_id());

-- Index for faster queries
CREATE INDEX idx_audit_logs_workspace_created ON public.audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs(entity_type);
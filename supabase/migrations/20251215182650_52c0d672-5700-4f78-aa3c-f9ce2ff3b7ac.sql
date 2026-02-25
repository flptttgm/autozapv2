-- Allow members to delete their workspace audit_logs
CREATE POLICY "Members can delete workspace audit_logs"
ON public.audit_logs
FOR DELETE
USING (workspace_id = get_user_workspace_id());
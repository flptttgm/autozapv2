-- Create sentiment_alerts table to track sent alerts and prevent spam
CREATE TABLE public.sentiment_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  alert_type TEXT DEFAULT 'critical',
  sentiment_score INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_sentiment_alerts_lead ON public.sentiment_alerts(lead_id, created_at DESC);
CREATE INDEX idx_sentiment_alerts_workspace ON public.sentiment_alerts(workspace_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.sentiment_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workspace members can view alerts"
ON public.sentiment_alerts FOR SELECT
USING (workspace_id IN (
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
));

CREATE POLICY "Workspace members can insert alerts"
ON public.sentiment_alerts FOR INSERT
WITH CHECK (workspace_id IN (
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
));
-- Add sentiment column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'critical'));

-- Add sentiment_score column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS sentiment_score INTEGER DEFAULT 50;

-- Create sentiment_history table for analytics
CREATE TABLE IF NOT EXISTS sentiment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative', 'critical')),
  sentiment_score INTEGER,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on sentiment_history
ALTER TABLE sentiment_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for sentiment_history
CREATE POLICY "Users can view sentiment history for their workspace"
ON sentiment_history FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert sentiment history for their workspace"
ON sentiment_history FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  )
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_sentiment_history_workspace_date 
ON sentiment_history(workspace_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sentiment_history_lead 
ON sentiment_history(lead_id, created_at);

-- Index for leads sentiment queries
CREATE INDEX IF NOT EXISTS idx_leads_sentiment_score 
ON leads(workspace_id, sentiment_score);

-- Enable realtime for sentiment_history
ALTER PUBLICATION supabase_realtime ADD TABLE sentiment_history;
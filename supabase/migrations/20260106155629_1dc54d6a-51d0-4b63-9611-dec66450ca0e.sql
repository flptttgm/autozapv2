-- Add score column to leads table for lead scoring
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;

-- Create index for score-based queries
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(score DESC);

-- Create AI feedback table for continuous improvement
CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  ai_response TEXT NOT NULL,
  human_correction TEXT,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('wrong_answer', 'inappropriate', 'incomplete', 'good')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Enable RLS on ai_feedback
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_feedback
CREATE POLICY "Users can view ai_feedback in their workspace" 
ON public.ai_feedback 
FOR SELECT 
USING (
  workspace_id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can create ai_feedback in their workspace" 
ON public.ai_feedback 
FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update ai_feedback in their workspace" 
ON public.ai_feedback 
FOR UPDATE 
USING (
  workspace_id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  )
);

-- Create index for workspace queries
CREATE INDEX IF NOT EXISTS idx_ai_feedback_workspace ON public.ai_feedback(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_lead ON public.ai_feedback(lead_id);
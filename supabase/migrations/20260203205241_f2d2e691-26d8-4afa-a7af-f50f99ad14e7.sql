-- Create lead_folders table
CREATE TABLE lead_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  lead_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, name)
);

-- Enable RLS
ALTER TABLE lead_folders ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage folders in their workspace"
  ON lead_folders FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

-- Add folder_id column to leads table
ALTER TABLE leads ADD COLUMN folder_id UUID REFERENCES lead_folders(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_leads_folder_id ON leads(folder_id);

-- Create trigger function to update folder lead count
CREATE OR REPLACE FUNCTION update_folder_lead_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle DELETE case
  IF TG_OP = 'DELETE' THEN
    IF OLD.folder_id IS NOT NULL THEN
      UPDATE lead_folders 
      SET lead_count = (SELECT COUNT(*) FROM leads WHERE folder_id = OLD.folder_id),
          updated_at = now()
      WHERE id = OLD.folder_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT case
  IF TG_OP = 'INSERT' THEN
    IF NEW.folder_id IS NOT NULL THEN
      UPDATE lead_folders 
      SET lead_count = (SELECT COUNT(*) FROM leads WHERE folder_id = NEW.folder_id),
          updated_at = now()
      WHERE id = NEW.folder_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE case
  IF TG_OP = 'UPDATE' THEN
    -- Update old folder count if changed
    IF OLD.folder_id IS DISTINCT FROM NEW.folder_id THEN
      IF OLD.folder_id IS NOT NULL THEN
        UPDATE lead_folders 
        SET lead_count = (SELECT COUNT(*) FROM leads WHERE folder_id = OLD.folder_id),
            updated_at = now()
        WHERE id = OLD.folder_id;
      END IF;
      
      IF NEW.folder_id IS NOT NULL THEN
        UPDATE lead_folders 
        SET lead_count = (SELECT COUNT(*) FROM leads WHERE folder_id = NEW.folder_id),
            updated_at = now()
        WHERE id = NEW.folder_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
CREATE TRIGGER trigger_update_folder_count
AFTER INSERT OR UPDATE OR DELETE ON leads
FOR EACH ROW EXECUTE FUNCTION update_folder_lead_count();
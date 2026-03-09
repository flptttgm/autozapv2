-- Create table for daily notes and checklist
CREATE TABLE IF NOT EXISTS public.daily_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    notes TEXT DEFAULT '',
    checklist JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(workspace_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their workspace daily notes"
    ON public.daily_notes FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their workspace daily notes"
    ON public.daily_notes FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their workspace daily notes"
    ON public.daily_notes FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their workspace daily notes"
    ON public.daily_notes FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Add columns to track appointment creation source
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS source varchar(20) DEFAULT 'manual';

-- Add comment for documentation
COMMENT ON COLUMN public.appointments.created_by IS 'User ID who created the appointment (null if created by AI)';
COMMENT ON COLUMN public.appointments.source IS 'Source of creation: manual, ai, or import';
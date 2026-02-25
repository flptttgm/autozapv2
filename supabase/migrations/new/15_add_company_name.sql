
-- Add company_name column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS company_name text;

-- Verify it was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
AND column_name = 'company_name';

-- Add has_password column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN has_password boolean DEFAULT false;
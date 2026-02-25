-- Add pwa_dismissed column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pwa_dismissed boolean DEFAULT false;
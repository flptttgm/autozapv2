-- Add is_active column to user_coupons for explicit activation/deactivation control
ALTER TABLE public.user_coupons ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Create index for better query performance on active coupons
CREATE INDEX IF NOT EXISTS idx_user_coupons_is_active ON public.user_coupons(is_active);
-- Add new appointment status values for dual confirmation flow
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pending_owner';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pending_lead';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'rejected';

-- Add tracking columns for the confirmation workflow
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS owner_approved_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS owner_approved_by UUID REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS lead_confirmed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;
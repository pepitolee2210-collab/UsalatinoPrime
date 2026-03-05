-- Add client_phone and client_id columns to contracts table
-- Both optional to not break existing contracts

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES profiles(id);

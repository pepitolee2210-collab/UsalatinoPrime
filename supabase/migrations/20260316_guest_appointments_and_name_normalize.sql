-- Allow non-client (guest) appointments for prospects/walk-ins
ALTER TABLE appointments ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE appointments ALTER COLUMN case_id DROP NOT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- Normalize existing profile names to Title Case
UPDATE profiles
SET
  first_name = INITCAP(LOWER(first_name)),
  last_name = INITCAP(LOWER(last_name))
WHERE first_name IS NOT NULL;

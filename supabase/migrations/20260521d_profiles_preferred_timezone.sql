-- Per-client preferred timezone for appointment display.
--
-- The office books and stores appointments in UTC (anchored to Mountain
-- Time slot logic in src/lib/appointments/slots.ts). The display side
-- now wants to show each client their own local time. This column is
-- the source of truth for that preference, set either by:
--   (a) the client manually via combobox in /cita/[token]
--   (b) a one-time backfill from contracts.client_state / address_state
--       (script in supabase/scripts/backfill_preferred_timezone.sql)
--   (c) profile sync triggers in the future
--
-- NULL is valid and means "use cascade fallback" (see
-- src/lib/appointments/resolve-tz.ts).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_timezone TEXT NULL;

COMMENT ON COLUMN profiles.preferred_timezone IS
  'IANA timezone string (e.g. America/New_York). NULL falls back to contracts.client_state, address_state, or office TZ.';

-- Helper function used by the backfill script and any future code that
-- needs a state→TZ mapping at the DB layer (vs the TS helper). Mirrors
-- the STATE_TIMEZONE map in src/lib/timezones/us-states.ts. Returns
-- NULL for unrecognized input so the caller can decide the fallback.
CREATE OR REPLACE FUNCTION us_state_to_timezone(state TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE upper(trim(coalesce(state, '')))
    -- Eastern
    WHEN 'CT' THEN 'America/New_York'
    WHEN 'CONNECTICUT' THEN 'America/New_York'
    WHEN 'DE' THEN 'America/New_York'
    WHEN 'DELAWARE' THEN 'America/New_York'
    WHEN 'DC' THEN 'America/New_York'
    WHEN 'DISTRICT OF COLUMBIA' THEN 'America/New_York'
    WHEN 'FL' THEN 'America/New_York'
    WHEN 'FLORIDA' THEN 'America/New_York'
    WHEN 'GA' THEN 'America/New_York'
    WHEN 'GEORGIA' THEN 'America/New_York'
    WHEN 'IN' THEN 'America/New_York'
    WHEN 'INDIANA' THEN 'America/New_York'
    WHEN 'ME' THEN 'America/New_York'
    WHEN 'MAINE' THEN 'America/New_York'
    WHEN 'MD' THEN 'America/New_York'
    WHEN 'MARYLAND' THEN 'America/New_York'
    WHEN 'MA' THEN 'America/New_York'
    WHEN 'MASSACHUSETTS' THEN 'America/New_York'
    WHEN 'MI' THEN 'America/New_York'
    WHEN 'MICHIGAN' THEN 'America/New_York'
    WHEN 'NH' THEN 'America/New_York'
    WHEN 'NEW HAMPSHIRE' THEN 'America/New_York'
    WHEN 'NJ' THEN 'America/New_York'
    WHEN 'NEW JERSEY' THEN 'America/New_York'
    WHEN 'NY' THEN 'America/New_York'
    WHEN 'NEW YORK' THEN 'America/New_York'
    WHEN 'NC' THEN 'America/New_York'
    WHEN 'NORTH CAROLINA' THEN 'America/New_York'
    WHEN 'OH' THEN 'America/New_York'
    WHEN 'OHIO' THEN 'America/New_York'
    WHEN 'PA' THEN 'America/New_York'
    WHEN 'PENNSYLVANIA' THEN 'America/New_York'
    WHEN 'RI' THEN 'America/New_York'
    WHEN 'RHODE ISLAND' THEN 'America/New_York'
    WHEN 'SC' THEN 'America/New_York'
    WHEN 'SOUTH CAROLINA' THEN 'America/New_York'
    WHEN 'VT' THEN 'America/New_York'
    WHEN 'VERMONT' THEN 'America/New_York'
    WHEN 'VA' THEN 'America/New_York'
    WHEN 'VIRGINIA' THEN 'America/New_York'
    WHEN 'WV' THEN 'America/New_York'
    WHEN 'WEST VIRGINIA' THEN 'America/New_York'
    -- Central
    WHEN 'AL' THEN 'America/Chicago'
    WHEN 'ALABAMA' THEN 'America/Chicago'
    WHEN 'AR' THEN 'America/Chicago'
    WHEN 'ARKANSAS' THEN 'America/Chicago'
    WHEN 'IL' THEN 'America/Chicago'
    WHEN 'ILLINOIS' THEN 'America/Chicago'
    WHEN 'IA' THEN 'America/Chicago'
    WHEN 'IOWA' THEN 'America/Chicago'
    WHEN 'KS' THEN 'America/Chicago'
    WHEN 'KANSAS' THEN 'America/Chicago'
    WHEN 'KY' THEN 'America/Chicago'
    WHEN 'KENTUCKY' THEN 'America/Chicago'
    WHEN 'LA' THEN 'America/Chicago'
    WHEN 'LOUISIANA' THEN 'America/Chicago'
    WHEN 'MN' THEN 'America/Chicago'
    WHEN 'MINNESOTA' THEN 'America/Chicago'
    WHEN 'MS' THEN 'America/Chicago'
    WHEN 'MISSISSIPPI' THEN 'America/Chicago'
    WHEN 'MO' THEN 'America/Chicago'
    WHEN 'MISSOURI' THEN 'America/Chicago'
    WHEN 'NE' THEN 'America/Chicago'
    WHEN 'NEBRASKA' THEN 'America/Chicago'
    WHEN 'ND' THEN 'America/Chicago'
    WHEN 'NORTH DAKOTA' THEN 'America/Chicago'
    WHEN 'OK' THEN 'America/Chicago'
    WHEN 'OKLAHOMA' THEN 'America/Chicago'
    WHEN 'SD' THEN 'America/Chicago'
    WHEN 'SOUTH DAKOTA' THEN 'America/Chicago'
    WHEN 'TN' THEN 'America/Chicago'
    WHEN 'TENNESSEE' THEN 'America/Chicago'
    WHEN 'TX' THEN 'America/Chicago'
    WHEN 'TEXAS' THEN 'America/Chicago'
    WHEN 'WI' THEN 'America/Chicago'
    WHEN 'WISCONSIN' THEN 'America/Chicago'
    -- Mountain (with DST)
    WHEN 'CO' THEN 'America/Denver'
    WHEN 'COLORADO' THEN 'America/Denver'
    WHEN 'MT' THEN 'America/Denver'
    WHEN 'MONTANA' THEN 'America/Denver'
    WHEN 'NM' THEN 'America/Denver'
    WHEN 'NEW MEXICO' THEN 'America/Denver'
    WHEN 'UT' THEN 'America/Denver'
    WHEN 'UTAH' THEN 'America/Denver'
    WHEN 'WY' THEN 'America/Denver'
    WHEN 'WYOMING' THEN 'America/Denver'
    WHEN 'ID' THEN 'America/Denver'
    WHEN 'IDAHO' THEN 'America/Denver'
    -- Mountain Standard year-round
    WHEN 'AZ' THEN 'America/Phoenix'
    WHEN 'ARIZONA' THEN 'America/Phoenix'
    -- Pacific
    WHEN 'CA' THEN 'America/Los_Angeles'
    WHEN 'CALIFORNIA' THEN 'America/Los_Angeles'
    WHEN 'NV' THEN 'America/Los_Angeles'
    WHEN 'NEVADA' THEN 'America/Los_Angeles'
    WHEN 'OR' THEN 'America/Los_Angeles'
    WHEN 'OREGON' THEN 'America/Los_Angeles'
    WHEN 'WA' THEN 'America/Los_Angeles'
    WHEN 'WASHINGTON' THEN 'America/Los_Angeles'
    -- Non-contiguous
    WHEN 'AK' THEN 'America/Anchorage'
    WHEN 'ALASKA' THEN 'America/Anchorage'
    WHEN 'HI' THEN 'Pacific/Honolulu'
    WHEN 'HAWAII' THEN 'Pacific/Honolulu'
    ELSE NULL
  END;
$$;

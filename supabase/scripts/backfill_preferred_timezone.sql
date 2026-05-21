-- Idempotent backfill of profiles.preferred_timezone.
--
-- Runs in two passes (each is a no-op for rows already set):
--   1. From contracts.client_state — most recent contract wins (more
--      reliable: admin filled it during contract creation).
--   2. From profiles.address_state — fallback.
--
-- Re-runnable: only updates rows where preferred_timezone IS NULL.
-- Depends on the us_state_to_timezone() function created by
-- 20260521d_profiles_preferred_timezone.sql.

BEGIN;

-- Pass 1: most recent contract per client
UPDATE profiles p
SET preferred_timezone = sub.tz
FROM (
  SELECT DISTINCT ON (c.client_id)
    c.client_id,
    us_state_to_timezone(c.client_state) AS tz
  FROM contracts c
  WHERE c.client_id IS NOT NULL
    AND c.client_state IS NOT NULL
    AND c.client_state <> ''
  ORDER BY c.client_id, c.created_at DESC
) sub
WHERE p.id = sub.client_id
  AND p.preferred_timezone IS NULL
  AND sub.tz IS NOT NULL;

-- Pass 2: profile address_state for clients without a contract that
-- had a recognizable state.
UPDATE profiles p
SET preferred_timezone = us_state_to_timezone(p.address_state)
WHERE p.preferred_timezone IS NULL
  AND p.address_state IS NOT NULL
  AND p.address_state <> ''
  AND us_state_to_timezone(p.address_state) IS NOT NULL;

COMMIT;

-- Quick sanity check (run separately):
--   SELECT preferred_timezone, count(*)
--   FROM profiles
--   WHERE role = 'client'
--   GROUP BY 1
--   ORDER BY 2 DESC;

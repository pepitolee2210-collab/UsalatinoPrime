ALTER TABLE scheduling_config
  ADD COLUMN IF NOT EXISTS time_blocks JSONB DEFAULT '[]';

-- Migrate existing single-block data to time_blocks
UPDATE scheduling_config
SET time_blocks = jsonb_build_array(
  jsonb_build_object('start_hour', start_hour, 'end_hour', end_hour)
)
WHERE is_available = true
  AND (time_blocks IS NULL OR time_blocks = '[]'::jsonb);

-- Support multiple minors per case in form submissions
-- Each minor gets their own set of story/parent/witnesses forms

-- Add minor_index column (0-based, default 0 for backwards compat)
ALTER TABLE case_form_submissions
  ADD COLUMN IF NOT EXISTS minor_index INTEGER NOT NULL DEFAULT 0;

-- Drop old unique constraint and create new one including minor_index
ALTER TABLE case_form_submissions
  DROP CONSTRAINT IF EXISTS case_form_submissions_case_id_form_type_key;

ALTER TABLE case_form_submissions
  ADD CONSTRAINT case_form_submissions_case_minor_form_key
  UNIQUE(case_id, form_type, minor_index);

-- Index for looking up all submissions for a specific minor
CREATE INDEX IF NOT EXISTS idx_case_form_submissions_minor
  ON case_form_submissions(case_id, minor_index);

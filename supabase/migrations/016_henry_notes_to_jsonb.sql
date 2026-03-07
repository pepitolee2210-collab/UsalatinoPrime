-- Convert henry_notes from TEXT to JSONB array for log/history
UPDATE callback_requests
SET henry_notes = json_build_array(json_build_object('text', henry_notes, 'date', now()))::text
WHERE henry_notes IS NOT NULL AND henry_notes != '';

ALTER TABLE callback_requests ALTER COLUMN henry_notes TYPE JSONB USING henry_notes::jsonb;
ALTER TABLE callback_requests ALTER COLUMN henry_notes SET DEFAULT '[]'::jsonb;

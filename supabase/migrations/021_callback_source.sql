-- Add source column to track where leads come from (chatbot vs manual)
ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_callback_requests_source ON callback_requests(source);

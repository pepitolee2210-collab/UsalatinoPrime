-- Henry's separate notes field
ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS henry_notes TEXT;

-- Manual date for when the WhatsApp message was received
ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS message_date DATE;

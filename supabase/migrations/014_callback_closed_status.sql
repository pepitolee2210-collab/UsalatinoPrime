-- Add 'closed' status to callback_requests
ALTER TABLE callback_requests DROP CONSTRAINT IF EXISTS callback_requests_status_check;
ALTER TABLE callback_requests ADD CONSTRAINT callback_requests_status_check
  CHECK (status IN ('pending', 'called', 'follow_up', 'converted', 'no_answer', 'not_interested', 'closed'));

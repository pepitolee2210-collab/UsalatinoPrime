CREATE TABLE IF NOT EXISTS callback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service_interest TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'called', 'follow_up', 'converted', 'no_answer', 'not_interested')),
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  called_at TIMESTAMPTZ
);

ALTER TABLE callback_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage callback_requests"
  ON callback_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Case form submissions: stores AI-generated documents and form drafts
CREATE TABLE IF NOT EXISTS case_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  form_type TEXT NOT NULL,
  form_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'reviewed', 'needs_correction', 'approved')),
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(case_id, form_type)
);

-- Direction column for documents: who uploaded for whom
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'client_to_admin'
  CHECK (direction IN ('client_to_admin', 'admin_to_client'));

-- RLS for case_form_submissions
ALTER TABLE case_form_submissions ENABLE ROW LEVEL SECURITY;

-- Clients can view and update their own submissions
CREATE POLICY "clients_own_submissions" ON case_form_submissions
  FOR ALL USING (client_id = auth.uid());

-- Admin (service role) has full access via service client
-- No additional policy needed since we use service role client

-- Index for fast lookups
CREATE INDEX idx_case_form_submissions_case ON case_form_submissions(case_id);
CREATE INDEX idx_case_form_submissions_status ON case_form_submissions(status);
CREATE INDEX idx_documents_direction ON documents(direction);

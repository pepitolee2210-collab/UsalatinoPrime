-- Case Chat Messages: Stores conversation history between Henry and AI per case
CREATE TABLE IF NOT EXISTS case_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast retrieval of chat history by case
CREATE INDEX idx_case_chat_messages_case_created
  ON case_chat_messages (case_id, created_at);

-- RLS: Only admin/employee can access chat messages
ALTER TABLE case_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and employees can read chat messages"
  ON case_chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employee')
    )
  );

CREATE POLICY "Admin and employees can insert chat messages"
  ON case_chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employee')
    )
  );

COMMENT ON TABLE case_chat_messages IS 'Chat history between admin/employee and AI assistant per case';
COMMENT ON COLUMN case_chat_messages.role IS 'system = context prompt, user = Henry message, assistant = AI response';
COMMENT ON COLUMN case_chat_messages.metadata IS 'Optional: model used, tokens, saved_documents references';

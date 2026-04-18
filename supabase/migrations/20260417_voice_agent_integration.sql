-- ============================================================
-- Voice Agent integration:
--   * Guest bookings with phone + source tracking on appointments
--   * Real rate-limiting in DB (replaces in-memory Map)
--   * Observability: record every voice call
-- ============================================================

-- 1. Extend appointments for prospects booking via voice agent
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'admin';

COMMENT ON COLUMN appointments.guest_phone IS 'Phone of prospect who booked without account (voice agent, public form).';
COMMENT ON COLUMN appointments.source IS 'Origin of the booking: admin, client-portal, voice-agent, employee, etc.';

CREATE INDEX IF NOT EXISTS idx_appointments_guest_phone ON appointments (guest_phone) WHERE guest_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_source ON appointments (source);

-- 2. Rate limit table (persistent across serverless instances)
CREATE TABLE IF NOT EXISTS voice_call_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_resets_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_rate_limits_ip_window
  ON voice_call_rate_limits (ip_address, window_started_at);

CREATE INDEX IF NOT EXISTS idx_voice_rate_limits_resets
  ON voice_call_rate_limits (window_resets_at);

ALTER TABLE voice_call_rate_limits ENABLE ROW LEVEL SECURITY;
-- Only service role can read/write (used exclusively from server endpoints)

-- 3. Observability: every voice call is recorded
CREATE TABLE IF NOT EXISTS voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT,
  user_agent TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  lead_id UUID REFERENCES callback_requests(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  end_reason TEXT, -- 'user-hangup', 'timeout', 'error', 'server-close'
  error_message TEXT,
  tools_invoked JSONB DEFAULT '[]'::jsonb, -- array of {name, at, ok}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_calls_started ON voice_calls (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_calls_lead ON voice_calls (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_voice_calls_appointment ON voice_calls (appointment_id) WHERE appointment_id IS NOT NULL;

ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;

-- Admins/employees can read all voice calls for observability
CREATE POLICY voice_calls_admin_read ON voice_calls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'employee')
    )
  );

-- Service role bypasses RLS entirely (used by public endpoints)

COMMENT ON TABLE voice_calls IS 'Record of every voice agent conversation. Used for observability and to correlate leads/appointments with calls.';
COMMENT ON TABLE voice_call_rate_limits IS 'Per-IP rate limiting for voice agent token issuance. Replaces in-memory Map that does not work in serverless.';

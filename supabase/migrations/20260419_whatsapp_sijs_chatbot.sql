-- ============================================================
-- WhatsApp SIJS chatbot integration
--   * WhatsApp contacts, conversations, messages (Twilio)
--   * SIJS intake answers with eligibility verdict
--   * Web Push subscriptions (VAPID) for admin PWA
--   * Twilio webhook idempotency ledger
--
-- Reuses existing infra:
--   - prospect_scheduling_config / settings / blocked_dates (shared
--     calendar for all prospect channels: web chatbot, voice agent,
--     and now WhatsApp).
--   - appointments.guest_phone / guest_name / source (source set to
--     'whatsapp-chatbot' for bookings originating here).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enums
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE whatsapp_conversation_status AS ENUM (
    'active','filtered_in','filtered_out','scheduled','closed','abandoned'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_message_role AS ENUM ('user','bot','system','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_direction AS ENUM ('inbound','outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sijs_verdict AS ENUM ('eligible','not_eligible','requires_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 2. WhatsApp contacts (phone is the key)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 TEXT NOT NULL UNIQUE,
  display_name TEXT,
  wa_profile_name TEXT,
  opted_out BOOLEAN NOT NULL DEFAULT false,
  opted_out_at TIMESTAMPTZ,
  state_us TEXT,
  inferred_timezone TEXT,
  language TEXT DEFAULT 'es',
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_contacts_active
  ON whatsapp_contacts(opted_out) WHERE opted_out = false;

-- ------------------------------------------------------------
-- 3. WhatsApp conversations (state lives here)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  status whatsapp_conversation_status NOT NULL DEFAULT 'active',
  current_step TEXT NOT NULL DEFAULT 'GREETING',
  collected_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_count INT NOT NULL DEFAULT 0,
  video_sent BOOLEAN DEFAULT false,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closed_reason TEXT,
  total_messages INT NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_contact ON whatsapp_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_active  ON whatsapp_conversations(last_message_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wa_conv_status  ON whatsapp_conversations(status);

-- ------------------------------------------------------------
-- 4. Messages (full transcript with token + cost accounting)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  role whatsapp_message_role NOT NULL,
  direction whatsapp_direction NOT NULL,
  body TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  twilio_sid TEXT,
  gemini_input_tokens INT,
  gemini_output_tokens INT,
  cost_usd NUMERIC(10,6),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_conv
  ON whatsapp_messages(conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_msg_sid
  ON whatsapp_messages(twilio_sid) WHERE twilio_sid IS NOT NULL;

-- ------------------------------------------------------------
-- 5. SIJS intakes (the filter answers + verdict)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sijs_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  lives_in_usa BOOLEAN,
  age INT,
  state_us TEXT,
  suffered_abuse BOOLEAN,
  abuse_details TEXT,
  eligibility_verdict sijs_verdict,
  verdict_reasoning TEXT,
  state_age_limit INT,
  raw_answers JSONB DEFAULT '{}'::jsonb,
  ai_model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sijs_verdict  ON sijs_intakes(eligibility_verdict);
CREATE INDEX IF NOT EXISTS idx_sijs_contact  ON sijs_intakes(contact_id);

-- ------------------------------------------------------------
-- 6. Web Push subscriptions (VAPID) — admin receives notifications
--    even with the PWA closed or phone locked.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  device_label TEXT,
  failed_count INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

-- ------------------------------------------------------------
-- 7. Twilio webhook idempotency ledger
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS twilio_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_twilio_unprocessed
  ON twilio_webhook_events(received_at) WHERE processed = false;

-- ------------------------------------------------------------
-- 8. updated_at triggers (reuse existing update_updated_at function)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_wa_contacts_upd ON whatsapp_contacts;
CREATE TRIGGER trg_wa_contacts_upd BEFORE UPDATE ON whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_wa_conv_upd ON whatsapp_conversations;
CREATE TRIGGER trg_wa_conv_upd BEFORE UPDATE ON whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_sijs_upd ON sijs_intakes;
CREATE TRIGGER trg_sijs_upd BEFORE UPDATE ON sijs_intakes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 9. RLS
--    - WhatsApp tables: admin-only (contain PII of people who may not
--      have an account). Service role bypass handles worker writes.
--    - push_subscriptions: each user manages their own.
-- ------------------------------------------------------------
ALTER TABLE whatsapp_contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sijs_intakes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE twilio_webhook_events   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_wa_contacts ON whatsapp_contacts;
CREATE POLICY admin_all_wa_contacts ON whatsapp_contacts FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS admin_all_wa_conv ON whatsapp_conversations;
CREATE POLICY admin_all_wa_conv ON whatsapp_conversations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS admin_all_wa_msg ON whatsapp_messages;
CREATE POLICY admin_all_wa_msg ON whatsapp_messages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS admin_all_sijs ON sijs_intakes;
CREATE POLICY admin_all_sijs ON sijs_intakes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS user_own_push ON push_subscriptions;
CREATE POLICY user_own_push ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS admin_all_twilio ON twilio_webhook_events;
CREATE POLICY admin_all_twilio ON twilio_webhook_events FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ------------------------------------------------------------
-- 10. Comments (schema documentation)
-- ------------------------------------------------------------
COMMENT ON TABLE whatsapp_contacts IS 'People who messaged the WhatsApp SIJS chatbot. Phone is the identity.';
COMMENT ON TABLE whatsapp_conversations IS 'Persistent chat state machine — WhatsApp is async so sessions cannot live in memory.';
COMMENT ON COLUMN whatsapp_conversations.current_step IS 'SIJS state machine step: GREETING, Q1_LIVES_USA, Q2_AGE, Q3_STATE, Q4_ABUSE, ANALYSIS, ELIGIBLE, INELIGIBLE, PICK_SLOT, CONFIRM_SLOT, BOOKED, OPTED_OUT.';
COMMENT ON TABLE sijs_intakes IS 'Answers to the SIJS prequalifier + computed eligibility verdict.';
COMMENT ON TABLE push_subscriptions IS 'Web Push (VAPID) subscriptions used to notify admins of new WhatsApp appointments.';
COMMENT ON TABLE twilio_webhook_events IS 'Idempotency ledger — each Twilio MessageSid is processed exactly once.';

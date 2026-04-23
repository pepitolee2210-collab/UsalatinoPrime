-- ============================================================
-- UsaLatino Prime — Acceso de Asesora Senior (Vanessa) al
-- chatbot WhatsApp SIJS
--
-- Contexto: la migración 20260419 creó las tablas del chatbot
-- con policies admin-only. Ahora la Asesora Senior
-- (profiles.role='employee' AND employee_type='senior_consultant')
-- necesita ver las conversaciones para darles seguimiento —
-- es quien toma las llamadas de evaluación gratuita.
--
-- Alcance: SELECT únicamente. El worker escribe con service role
-- (bypass RLS), por lo que no hace falta INSERT/UPDATE.
-- ============================================================

-- whatsapp_contacts
DROP POLICY IF EXISTS senior_consultant_read_wa_contacts ON whatsapp_contacts;
CREATE POLICY senior_consultant_read_wa_contacts ON whatsapp_contacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'employee'
      AND employee_type = 'senior_consultant'
  ));

-- whatsapp_conversations
DROP POLICY IF EXISTS senior_consultant_read_wa_conv ON whatsapp_conversations;
CREATE POLICY senior_consultant_read_wa_conv ON whatsapp_conversations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'employee'
      AND employee_type = 'senior_consultant'
  ));

-- whatsapp_messages
DROP POLICY IF EXISTS senior_consultant_read_wa_msg ON whatsapp_messages;
CREATE POLICY senior_consultant_read_wa_msg ON whatsapp_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'employee'
      AND employee_type = 'senior_consultant'
  ));

-- sijs_intakes
DROP POLICY IF EXISTS senior_consultant_read_sijs ON sijs_intakes;
CREATE POLICY senior_consultant_read_sijs ON sijs_intakes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'employee'
      AND employee_type = 'senior_consultant'
  ));

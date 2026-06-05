-- Aceptaciones de Términos y Condiciones por caso. Cada cliente, al firmar el
-- disclaimer en su portal (/cita/[token] → Más → Términos y Condiciones), genera
-- una fila aquí (pista de auditoría legal: firma dibujada, IP, user-agent, versión)
-- y un PDF inmutable que queda enlazado en `documents` (document_id).
--
-- Idempotencia: UNIQUE(case_id, terms_version) — una aceptación por caso por versión
-- del documento. Un bump de TERMS_VERSION habilita una nueva aceptación y conserva
-- el historial.
--
-- Escritura: solo vía el route con service-role que resuelve el appointment_token
-- del cliente (no hay policy INSERT/UPDATE/DELETE). Lectura: solo staff (admin o
-- employee) — los clientes nunca consultan esta tabla con su propia sesión.
--
-- Aplicada en producción 2026-06-04 via Supabase MCP. Esta copia vive en el repo
-- solo como reflejo del estado real.

CREATE TABLE IF NOT EXISTS public.case_terms_acceptances (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  client_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contract_id        UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  terms_version      TEXT NOT NULL,
  signature_image    TEXT NOT NULL,            -- base64 PNG data URL (PII)
  accepted_full_name TEXT NOT NULL,
  document_id        UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  pdf_path           TEXT,
  ip_address         TEXT,
  user_agent         TEXT,
  accepted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS case_terms_acceptance_unique_version
  ON public.case_terms_acceptances (case_id, terms_version);
CREATE INDEX IF NOT EXISTS case_terms_acceptance_case_idx
  ON public.case_terms_acceptances (case_id);
CREATE INDEX IF NOT EXISTS case_terms_acceptance_client_idx
  ON public.case_terms_acceptances (client_id);

ALTER TABLE public.case_terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read terms acceptances" ON public.case_terms_acceptances;
CREATE POLICY "Staff can read terms acceptances"
  ON public.case_terms_acceptances FOR SELECT
  USING (is_admin() OR is_employee());

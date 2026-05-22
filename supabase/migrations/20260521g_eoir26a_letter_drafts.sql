-- Carta de Exoneración (EOIR-26A): tabla de drafts versionados + nuevo
-- document_type para evidencia financiera + visibilidad en fase apelación.
--
-- Aplicada en producción 2026-05-21 via Supabase MCP (proyecto
-- hkmeaqehutootharvsbd). Esta copia vive en el repo solo como reflejo del
-- estado real.

-- A. Tabla de drafts versionados de la Carta de Exoneración (EOIR-26A).
--    Estructura idéntica en patrón al case_appeal_letter_drafts: async via
--    QStash con status pending|generating|ready|failed.
CREATE TABLE IF NOT EXISTS public.case_eoir26a_letter_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  sources JSONB,
  model_used TEXT,
  prompt_version TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES public.profiles(id),
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  edited_by_diana BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_read_tokens INTEGER,
  cache_creation_tokens INTEGER,
  generation_seconds NUMERIC(6,2),
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT case_eoir26a_letter_drafts_status_check
      CHECK (status IN ('pending', 'generating', 'ready', 'failed')),
  error_message TEXT,
  job_started_at TIMESTAMPTZ,
  job_finished_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS case_eoir26a_letter_one_current_per_case
  ON public.case_eoir26a_letter_drafts (case_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS case_eoir26a_letter_case_version_idx
  ON public.case_eoir26a_letter_drafts (case_id, version DESC);

ALTER TABLE public.case_eoir26a_letter_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read eoir26a letter drafts" ON public.case_eoir26a_letter_drafts;
CREATE POLICY "Authenticated can read eoir26a letter drafts"
  ON public.case_eoir26a_letter_drafts FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

-- B. Nuevo document_type para evidencia financiera EOIR-26A.
--    slot_kind='multiple_named' → Diana sube N docs y los nombra
--    (Pay stub Marzo, Carta desempleo, Estado de cuenta, etc.).
INSERT INTO public.document_types (
  code, name_es, name_en, description_es,
  category_code, category_name_es, category_icon,
  requires_translation, requires_certified_copy,
  slot_kind, sort_order, is_active, is_required
) VALUES (
  'apelacion_eoir26a_evidencia_financiera',
  'Evidencia financiera (EOIR-26A)',
  'EOIR-26A Financial Evidence',
  'Talones de pago, prueba de desempleo, beneficios públicos (SNAP/Medicaid/SSI), estados de cuenta bancarios, recibos de renta/servicios/médicos. Diana puede subir varios.',
  'evidencia_eoir26a', 'Evidencia EOIR-26A', 'attach_money',
  false, false, 'multiple_named', 4, true, false
)
ON CONFLICT (code) DO NOTHING;

-- C. Visibilidad del nuevo type en la fase 'apelacion' del servicio 'apelacion'.
INSERT INTO public.document_type_phases (
  document_type_id, service_slug, phase_code, sort_order
)
SELECT id, 'apelacion', 'apelacion'::public.case_phase, sort_order
FROM public.document_types
WHERE code = 'apelacion_eoir26a_evidencia_financiera'
ON CONFLICT (document_type_id, service_slug, phase_code) DO NOTHING;

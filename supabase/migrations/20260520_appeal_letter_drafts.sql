-- Tabla para versiones del "Brief / Carta de Apelación" generadas con Claude.
-- Estructura calcada de case_credible_fear_drafts (mismo patrón: versionado +
-- is_current único por caso + audit de cost). Diferencia: agregamos tokens y
-- generation_seconds para auditar costos de Claude con PDFs nativos.
--
-- Aplicada en producción 2026-05-19 via Supabase MCP. Esta copia vive en el
-- repo solo como reflejo del estado real.

CREATE TABLE IF NOT EXISTS public.case_appeal_letter_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body_md TEXT NOT NULL,
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
  generation_seconds NUMERIC(6,2)
);

CREATE UNIQUE INDEX IF NOT EXISTS case_appeal_letter_one_current_per_case
  ON public.case_appeal_letter_drafts (case_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS case_appeal_letter_case_version_idx
  ON public.case_appeal_letter_drafts (case_id, version DESC);

ALTER TABLE public.case_appeal_letter_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read appeal letter drafts" ON public.case_appeal_letter_drafts;
CREATE POLICY "Authenticated can read appeal letter drafts"
  ON public.case_appeal_letter_drafts FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

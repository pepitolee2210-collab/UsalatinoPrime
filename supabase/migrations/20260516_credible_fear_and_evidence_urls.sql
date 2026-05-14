-- Migración M3 — tablas para el flujo de Miedo Creíble del servicio
-- Asilo Político. Aplicada en producción 2026-05-14 via Supabase MCP.
--
-- - case_evidence_urls: URLs externas que el cliente añade en Fase 2.
-- - case_credible_fear_drafts: versiones del relato generado por IA.

CREATE TABLE IF NOT EXISTS public.case_evidence_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  source_domain TEXT,
  description TEXT,
  reachable BOOLEAN,
  reachable_checked_at TIMESTAMPTZ,
  added_by UUID REFERENCES public.profiles(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS case_evidence_urls_case_idx
  ON public.case_evidence_urls (case_id);

ALTER TABLE public.case_evidence_urls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read evidence URLs" ON public.case_evidence_urls;
CREATE POLICY "Authenticated can read evidence URLs"
  ON public.case_evidence_urls FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

CREATE TABLE IF NOT EXISTS public.case_credible_fear_drafts (
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
  edited_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS case_credible_fear_one_current_per_case
  ON public.case_credible_fear_drafts (case_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS case_credible_fear_case_version_idx
  ON public.case_credible_fear_drafts (case_id, version DESC);

ALTER TABLE public.case_credible_fear_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read credible fear drafts" ON public.case_credible_fear_drafts;
CREATE POLICY "Authenticated can read credible fear drafts"
  ON public.case_credible_fear_drafts FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

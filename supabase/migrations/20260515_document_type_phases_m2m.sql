-- Migración M2 — M2M `document_type_phases` + backfill SIJS + seed Asilo Político.
-- Hace data-driven la relación (document_type, service_slug, phase_code).
-- Reemplaza las columnas legacy `shown_in_custodia/i360/i485` (que quedan
-- DEPRECATED) y el helper TS `phase-category-overrides.ts` (idem).
--
-- Aplicada en producción 2026-05-14 via Supabase MCP. Este archivo existe
-- solamente para que el folder migrations refleje el estado real.

CREATE TABLE IF NOT EXISTS public.document_type_phases (
  id BIGSERIAL PRIMARY KEY,
  document_type_id INTEGER NOT NULL REFERENCES public.document_types(id) ON DELETE CASCADE,
  service_slug TEXT NOT NULL,
  phase_code public.case_phase NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  category_code_override TEXT,
  category_name_es_override TEXT,
  category_icon_override TEXT,
  is_required_override BOOLEAN,
  conditional_logic_override JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_type_id, service_slug, phase_code)
);

CREATE INDEX IF NOT EXISTS document_type_phases_service_phase_idx
  ON public.document_type_phases (service_slug, phase_code);
CREATE INDEX IF NOT EXISTS document_type_phases_doc_type_idx
  ON public.document_type_phases (document_type_id);

ALTER TABLE public.document_type_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read document_type_phases" ON public.document_type_phases;
CREATE POLICY "Anyone can read document_type_phases"
  ON public.document_type_phases FOR SELECT
  USING (TRUE);

-- (Backfill SIJS + seed Asilo: ver MCP migration 20260515_document_type_phases_m2m
--  para el SQL completo aplicado.)

-- 20260522b — Estructurar el output del Miedo Creíble como JSON canónico.
--
-- Por qué: el prompt v4 escondía un JSON en HTML comment dentro del Markdown
-- y solo cubría I-589 Parte B Q1 + algunas de Parte C. El prompt v5 produce
-- un JSON estructurado completo (status, declaration_en/es, i589_field_values
-- para páginas 5-9, supplement_b, evidence_index, factual_claims_audit,
-- self_check) que se persiste directamente en columnas JSONB tipadas.
--
-- Mantiene body_md, sources, version, is_current, edited_by_diana, edited_at
-- para compatibilidad con drafts v4 ya generados (5 filas en prod).
--
-- Idempotente: usa IF NOT EXISTS para cada columna.

ALTER TABLE public.case_credible_fear_drafts
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS case_analysis_json jsonb,
  ADD COLUMN IF NOT EXISTS gaps_found_json jsonb,
  ADD COLUMN IF NOT EXISTS review_required_flags_json jsonb,
  ADD COLUMN IF NOT EXISTS declaration_en_json jsonb,
  ADD COLUMN IF NOT EXISTS declaration_es_json jsonb,
  ADD COLUMN IF NOT EXISTS i589_field_values_json jsonb,
  ADD COLUMN IF NOT EXISTS supplement_b_entries_json jsonb,
  ADD COLUMN IF NOT EXISTS evidence_index_json jsonb,
  ADD COLUMN IF NOT EXISTS factual_claims_audit_json jsonb,
  ADD COLUMN IF NOT EXISTS self_check_json jsonb,
  ADD COLUMN IF NOT EXISTS input_tokens int,
  ADD COLUMN IF NOT EXISTS output_tokens int,
  ADD COLUMN IF NOT EXISTS cached_tokens int;

-- Constraint para status: solo los 3 valores válidos del schema v5.
ALTER TABLE public.case_credible_fear_drafts
  DROP CONSTRAINT IF EXISTS case_credible_fear_drafts_status_check;
ALTER TABLE public.case_credible_fear_drafts
  ADD CONSTRAINT case_credible_fear_drafts_status_check
  CHECK (status IS NULL OR status IN ('DRAFT_COMPLETE', 'GAPS_FOUND', 'REQUIRES_REVIEW'));

COMMENT ON COLUMN public.case_credible_fear_drafts.status IS
  'Resultado del prompt v5: DRAFT_COMPLETE = listo, GAPS_FOUND = el cuestionario tiene huecos, REQUIRES_REVIEW = bandera legal que requiere abogado.';
COMMENT ON COLUMN public.case_credible_fear_drafts.i589_field_values_json IS
  'Valores canónicos para llenar I-589 páginas 5-9 (Part B/C). Schema definido en src/lib/ai/credible-fear-schema.ts.';

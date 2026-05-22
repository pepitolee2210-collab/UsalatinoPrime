-- 20260523b — Columnas para tokens separados de las 2 llamadas IA del prompt v6.
--
-- El refactor v6 divide la generación en dos llamadas a Claude Opus 4.7:
--   1. analysis (case_analysis, i589_field_values, supplement_b, evidence_index, self_check, audit_seed)
--   2. declaration (declaration_es de 3000-5000 palabras con URLs citadas)
--
-- Para observabilidad de costos por sub-llamada y debugging persistimos los
-- tokens de cada paso por separado. `input_tokens` / `output_tokens` se
-- mantienen como suma agregada para compatibilidad con queries existentes.

ALTER TABLE public.case_credible_fear_drafts
  ADD COLUMN IF NOT EXISTS analysis_input_tokens int,
  ADD COLUMN IF NOT EXISTS analysis_output_tokens int,
  ADD COLUMN IF NOT EXISTS analysis_cached_tokens int,
  ADD COLUMN IF NOT EXISTS declaration_input_tokens int,
  ADD COLUMN IF NOT EXISTS declaration_output_tokens int,
  ADD COLUMN IF NOT EXISTS declaration_cached_tokens int,
  ADD COLUMN IF NOT EXISTS declaration_total_words int,
  ADD COLUMN IF NOT EXISTS cited_urls_in_body_json jsonb;

COMMENT ON COLUMN public.case_credible_fear_drafts.declaration_total_words IS
  'Conteo de palabras de declaration_es. Indicador de densidad/calidad. Target v6: 3000-5000 palabras.';
COMMENT ON COLUMN public.case_credible_fear_drafts.cited_urls_in_body_json IS
  'URLs citadas en el body de la declaración (sección VI: Pruebas y Evidencias). Array de {roman_numeral, medio, titulo, fecha_pub, url}.';

-- Permitir 'custom' como schema_source en case_form_instances.
-- Usado por forms no-AcroForm (ej. Carta de Cambio de Corte generada con
-- jsPDF custom): la fila aún rastrea filled_values/status/filled_pdf_*,
-- pero el "schema" no proviene de un PDF AcroForm ni de OCR.
--
-- Aplicada via Supabase MCP el 2026-05-20.

ALTER TABLE public.case_form_instances
  DROP CONSTRAINT IF EXISTS case_form_instances_schema_source_check;

ALTER TABLE public.case_form_instances
  ADD CONSTRAINT case_form_instances_schema_source_check
  CHECK (schema_source = ANY (ARRAY['pending'::text, 'acroform'::text, 'ocr_gemini'::text, 'failed'::text, 'custom'::text]));

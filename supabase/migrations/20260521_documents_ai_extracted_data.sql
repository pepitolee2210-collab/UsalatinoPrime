-- AI structured extraction cache para documents.
--
-- Hoy `documents.extracted_text` cachea el resultado de Gemini Vision como
-- texto plano (migración 020). Para el flujo del EOIR-26 necesitamos data
-- estructurada (ej. fecha del fallo del IJ en formato YYYY-MM-DD) que el
-- prefill pueda consumir directamente sin re-parsear texto libre.
--
-- Diseño:
-- - `ai_extracted_data` JSONB namespaceado por slug del form: cada extractor
--   nuevo (eoir-26, eoir-26a, otros) escribe en su propia clave para evitar
--   colisiones entre extracciones de distintos workers.
-- - `ai_extraction_status` rastrea el ciclo de vida del job en background.
-- - `ai_extraction_error` guarda mensaje de error para que admin pueda
--   diagnosticar fallas sin tocar logs.
-- - Índice parcial sobre filas pending/processing para acelerar polling
--   de workers o UIs que esperan a la extracción.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ai_extracted_data jsonb,
  ADD COLUMN IF NOT EXISTS ai_extraction_status text
    CHECK (ai_extraction_status IS NULL OR ai_extraction_status IN ('pending','processing','completed','failed')),
  ADD COLUMN IF NOT EXISTS ai_extraction_error text,
  ADD COLUMN IF NOT EXISTS ai_extracted_at timestamptz;

COMMENT ON COLUMN public.documents.ai_extracted_data IS
  'JSON estructurado extraído por IA (Gemini), namespaceado por slug de form. Ej: { "eoir_26": { "decision_date": "2026-03-15" } }';

COMMENT ON COLUMN public.documents.ai_extraction_status IS
  'Estado del worker async de extracción: pending → processing → completed | failed.';

CREATE INDEX IF NOT EXISTS idx_documents_ai_extraction_pending
  ON public.documents (case_id, document_key)
  WHERE ai_extraction_status IN ('pending','processing');

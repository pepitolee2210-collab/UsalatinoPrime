-- Separar radicación de la presentación (intake) vs radicación del
-- procedimiento del caso (merits) según terminología de Henry.
--
-- Las 5 columnas existentes (required_forms, filing_steps, filing_channel,
-- filing_procedure, filing_procedure_es) quedan como "merits" — lo que el
-- juez evalúa. Agregamos 5 nuevas para "intake" — los formularios
-- administrativos que el clerk pide para abrir el caso.
ALTER TABLE public.case_jurisdictions
  ADD COLUMN IF NOT EXISTS intake_required_forms jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS intake_filing_steps jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS intake_filing_channel text
    CHECK (intake_filing_channel IS NULL OR intake_filing_channel IN ('in_person', 'email', 'portal', 'mail', 'hybrid')),
  ADD COLUMN IF NOT EXISTS intake_procedure_es text,
  ADD COLUMN IF NOT EXISTS intake_notes text;

COMMENT ON COLUMN public.case_jurisdictions.intake_required_forms IS
  'Formularios administrativos de intake (radicación de presentación). Array {name, url_official, description_es, is_mandatory}. Ej: Family Court Coversheet, Civil Cover Sheet.';
COMMENT ON COLUMN public.case_jurisdictions.intake_filing_steps IS
  'Pasos para radicar la presentación — abrir el caso, obtener número de expediente. Array {step_number, title_es, detail_es, estimated_time, requires_client_action}.';
COMMENT ON COLUMN public.case_jurisdictions.intake_filing_channel IS
  'Canal para presentar los formularios de intake. Mismo enum que filing_channel pero para etapa 1.';
COMMENT ON COLUMN public.case_jurisdictions.intake_procedure_es IS
  'Resumen en prosa del procedimiento de intake — lo que tiene que hacer el cliente ANTES de subir el expediente sustantivo.';
COMMENT ON COLUMN public.case_jurisdictions.intake_notes IS
  'Notas adicionales específicas del intake (ej. horario del clerk, formularios particulares del distrito).';

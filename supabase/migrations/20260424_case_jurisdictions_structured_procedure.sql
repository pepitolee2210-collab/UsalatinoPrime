-- Ampliación de case_jurisdictions para procedimiento estructurado.
-- Columnas nullable/defaults seguros → las filas existentes quedan válidas sin
-- migración de datos. Aplicada vía MCP el 2026-04-24.
ALTER TABLE public.case_jurisdictions
  ADD COLUMN IF NOT EXISTS filing_channel text
    CHECK (filing_channel IS NULL OR filing_channel IN ('in_person', 'email', 'portal', 'mail', 'hybrid')),
  ADD COLUMN IF NOT EXISTS required_forms jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS filing_steps jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments_required jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fees jsonb;

COMMENT ON COLUMN public.case_jurisdictions.filing_channel
  IS 'Canal primario de radicación. enum: in_person | email | portal | mail | hybrid.';
COMMENT ON COLUMN public.case_jurisdictions.required_forms
  IS 'Array de objetos {name, url_official, description_es, is_mandatory}.';
COMMENT ON COLUMN public.case_jurisdictions.filing_steps
  IS 'Array ordenado {step_number, title_es, detail_es, estimated_time, requires_client_action}.';
COMMENT ON COLUMN public.case_jurisdictions.attachments_required
  IS 'Array {type, description_es}. type: birth_certificate | school_records | medical_records | psych_evaluation | parental_consent | abandonment_proof | other';
COMMENT ON COLUMN public.case_jurisdictions.fees
  IS 'Objeto {amount_usd, currency, waivable, waiver_form_name, waiver_form_url} o null.';

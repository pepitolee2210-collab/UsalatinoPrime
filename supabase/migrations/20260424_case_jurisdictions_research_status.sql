-- Agrega estado del research en background para que el panel sepa si
-- está pendiente, completado o falló, en vez de pollear a ciegas.
ALTER TABLE public.case_jurisdictions
  ADD COLUMN IF NOT EXISTS research_status text DEFAULT 'completed'
    CHECK (research_status IN ('pending', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS research_error text;

COMMENT ON COLUMN public.case_jurisdictions.research_status
  IS 'Estado del research en background. pending = en curso tras crear contrato, completed = terminó OK, failed = abortado con error';
COMMENT ON COLUMN public.case_jurisdictions.research_error
  IS 'Mensaje de error si research_status=failed, para mostrar en UI y disparar retry manual.';

CREATE INDEX IF NOT EXISTS idx_case_jurisdictions_research_status
  ON public.case_jurisdictions (research_status) WHERE research_status != 'completed';

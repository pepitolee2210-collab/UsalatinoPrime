-- ══════════════════════════════════════════════════════════════════
-- Snapshot de fase en case_form_instances
--
-- Para que el panel del paralegal pueda agrupar formularios por la
-- fase en que el cliente los envió, agregamos `phase_when_submitted`.
-- Backfill: snapshot la fase actual del caso para los formularios
-- ya enviados.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.case_form_instances
  ADD COLUMN IF NOT EXISTS phase_when_submitted public.case_phase;

CREATE INDEX IF NOT EXISTS case_form_instances_phase_idx
  ON public.case_form_instances(phase_when_submitted)
  WHERE phase_when_submitted IS NOT NULL;

-- Backfill solo para forms ya enviados.
UPDATE public.case_form_instances cfi
SET phase_when_submitted = c.current_phase
FROM public.cases c
WHERE c.id = cfi.case_id
  AND cfi.phase_when_submitted IS NULL
  AND cfi.client_submitted_at IS NOT NULL;

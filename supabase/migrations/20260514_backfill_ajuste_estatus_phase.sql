-- ──────────────────────────────────────────────────────────────────
-- Backfill: cases huérfanos de "ajuste-de-estatus" con current_phase=NULL
-- ──────────────────────────────────────────────────────────────────
--
-- Contexto:
--   Antes del 2026-05-14, resolveStartingPhase() en register-client/route.ts
--   solo mapeaba la fase para service_slug='visa-juvenil'. Cualquier otro
--   servicio quedaba con current_phase=NULL.
--
--   El servicio "ajuste-de-estatus" se vende a clientes SIJS que ya tienen
--   I-360 aprobado y deben presentar solo el I-485 (continuación fase 3).
--   Estos clientes necesitan que su case nazca en fase 'i485' para que el
--   portal en /cita/[token] cargue los documentos y formularios de I-485.
--
--   El fix del código (lib/contracts/starting-phase.ts + startingPhase:'i485'
--   en el template de ajuste-de-estatus) resuelve contratos futuros. Esta
--   migración backfilea los 6 clientes ya firmados (Daysi, Roberto Carlos,
--   Oscar Gabriel ×2, Isai, Alexandra) para que puedan usar su portal
--   inmediatamente sin intervención manual.
--
-- Idempotente: re-ejecutable sin riesgo gracias a current_phase IS NULL
-- y NOT EXISTS en case_phase_history.

BEGIN;

-- 1. Asignar fase i485 + process_start a los cases huérfanos.
UPDATE public.cases AS c
SET
  current_phase = 'i485'::case_phase,
  process_start = COALESCE(c.process_start, 'i485'::case_phase)
FROM public.contracts AS k
WHERE c.contract_id = k.id
  AND k.service_slug = 'ajuste-de-estatus'
  AND k.status = 'firmado'
  AND c.current_phase IS NULL;

-- 2. Registrar la asignación inicial en case_phase_history (auditoría).
--    changed_by=NULL marca esto como acción del sistema (no humana).
INSERT INTO public.case_phase_history (case_id, from_phase, to_phase, changed_by, reason)
SELECT c.id, NULL, 'i485'::case_phase, NULL,
       'Backfill 2026-05-14: ajuste-de-estatus arranca en fase i485'
FROM public.cases c
JOIN public.contracts k ON k.id = c.contract_id
WHERE k.service_slug = 'ajuste-de-estatus'
  AND k.status = 'firmado'
  AND c.current_phase = 'i485'::case_phase
  AND NOT EXISTS (
    SELECT 1
    FROM public.case_phase_history h
    WHERE h.case_id = c.id
      AND h.to_phase = 'i485'::case_phase
  );

COMMIT;

-- Reconciliación quirúrgica de Fredy Adelmo Roque Hernandez.
--
-- Estado pre-script:
--   profile  : e8e4489c-37bc-46a0-8f34-4afc65a8ee48
--   contract : 896464c9-3356-4cbe-b8e2-599e5f47decb (firmado)
--   case A   : 5b619d9b-8680-44a1-a14b-d7ce26c8aa23  HF-2026-0104
--              ↳ vinculado al contrato pero VACÍO: 0 docs, 0 appointments,
--                0 payments, 1 submission residual (sij_affidavit_mother
--                generada por IA el 10-mar 05:20, en estado draft sin uso).
--   case B   : 652de9bf-e277-432a-a54a-3e15def05615  HF-2026-0109
--              ↳ HUÉRFANO (contract_id=NULL) pero contiene los datos REALES:
--                10 docs, 7 submissions activas, 5 appointments, 1 token,
--                1 jurisdicción investigada.
--
-- Origen: el cliente entró al portal viejo (/portal/services/[slug]) y
-- clickeó un botón que creó HF-0109 sin contract_id (caso documentado en
-- /portal/services/[slug]/service-detail.tsx:handleStartCase). El backfill
-- del 6-may eligió HF-0104 por proximidad temporal con el contrato (4s)
-- aunque el case real activo era HF-0109. Este script invierte la decisión.
--
-- Idempotente: se puede correr múltiples veces. Si ya está reconciliado,
-- ningún UPDATE/DELETE afecta filas.

BEGIN;

-- 1. Repuntar el contrato al case con datos reales.
UPDATE contracts
SET case_id = '652de9bf-e277-432a-a54a-3e15def05615'
WHERE id = '896464c9-3356-4cbe-b8e2-599e5f47decb'
  AND case_id <> '652de9bf-e277-432a-a54a-3e15def05615';

-- 2. Vincular bidireccional: case real ↔ contrato.
UPDATE cases
SET contract_id = '896464c9-3356-4cbe-b8e2-599e5f47decb'
WHERE id = '652de9bf-e277-432a-a54a-3e15def05615'
  AND (contract_id IS NULL OR contract_id <> '896464c9-3356-4cbe-b8e2-599e5f47decb');

-- 3. Limpiar el case fantasma (HF-0104): quitar contract_id (ya no apunta
--    aquí) y borrar dependencias antes del DELETE final.
UPDATE cases SET contract_id = NULL
WHERE id = '5b619d9b-8680-44a1-a14b-d7ce26c8aa23';

DELETE FROM appointment_tokens
WHERE case_id = '5b619d9b-8680-44a1-a14b-d7ce26c8aa23';

DELETE FROM case_form_submissions
WHERE case_id = '5b619d9b-8680-44a1-a14b-d7ce26c8aa23';

DELETE FROM cases
WHERE id = '5b619d9b-8680-44a1-a14b-d7ce26c8aa23';

COMMIT;

-- Verificación
SELECT 'contract case_id (debe ser HF-0109)' AS check, case_id::text AS value
FROM contracts WHERE id = '896464c9-3356-4cbe-b8e2-599e5f47decb'
UNION ALL
SELECT 'case HF-0109 contract_id (debe estar enlazado)', contract_id::text
FROM cases WHERE id = '652de9bf-e277-432a-a54a-3e15def05615'
UNION ALL
SELECT 'case HF-0104 (debe ser 0)', count(*)::text
FROM cases WHERE id = '5b619d9b-8680-44a1-a14b-d7ce26c8aa23'
UNION ALL
SELECT 'docs en case real HF-0109', count(*)::text
FROM documents WHERE case_id = '652de9bf-e277-432a-a54a-3e15def05615';

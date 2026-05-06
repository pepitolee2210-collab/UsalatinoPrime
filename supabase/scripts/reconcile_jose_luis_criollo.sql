-- Reconciliación quirúrgica del cliente Jose Luis Criollo Bejarano.
--
-- Contexto: el 4-may el cliente se autoregistró en /register con su email
-- real (vanejoseaudrey@gmail.com) creando un profile B paralelo con el
-- mismo teléfono. El 5-may alguien cambió el phone del profile A a
-- (845) 538-0418 para "separar" los duplicados, dejándolo inalcanzable.
-- El 6-may register-client reasignó el contrato 2 al profile B y le creó
-- un case nuevo vacío.
--
-- Este script revierte ese desastre:
--   • Restaura profile A.phone al original +1 (845) 494-6947.
--   • Mueve contrato 2 al profile A.
--   • Crea un case NUEVO para el contrato 2 (regla nueva: 1 contrato = 1 case).
--   • Vincula bidireccionalmente cada contrato con su case (contracts.case_id,
--     cases.contract_id — columnas creadas en migración 20260507).
--   • Borra el profile B fantasma, su case vacío, sus tokens y su auth.user.
--
-- Idempotente: se puede correr múltiples veces. Si ya está reconciliado,
-- los UPDATEs no encuentran filas y los DELETEs no afectan nada.
--
-- Identidades:
--   Profile A (legítimo)  : 92910109-8907-4ec7-9901-c8a10c3c0832
--   Profile B (fantasma)  : d3e792ca-1973-48b4-bfed-e4fa9eae4209
--   Contrato 1 (3 hijos)  : ff0b1a2e-9be4-4ba6-b56b-2a7c2e1b81b1
--   Contrato 2 (1 hijo)   : 6cb52f88-29bd-413f-a40d-9f7a3467d1d8
--   Case A (HF-2026-0162) : a1bd0971-9f56-4bb5-b428-7374e0445e8c
--   Case B (HF-2026-0183) : 516aab30-0b6d-4bd4-9822-6de3a7a328ef

BEGIN;

-- 1) Restaurar el teléfono original del profile A (idempotente).
UPDATE profiles
SET phone = '+1 (845) 494-6947'
WHERE id = '92910109-8907-4ec7-9901-c8a10c3c0832'
  AND phone <> '+1 (845) 494-6947';

-- 2) Crear case nuevo para el contrato 2 dentro del profile A,
--    copiando atributos del case fantasma B. Solo si el contrato 2 aún no
--    tiene case_id apuntando al profile A (idempotencia).
WITH new_case AS (
  INSERT INTO cases (
    client_id, service_id, total_cost, intake_status, form_data,
    current_step, process_start, current_phase, contract_id
  )
  SELECT
    '92910109-8907-4ec7-9901-c8a10c3c0832',
    cb.service_id,
    cb.total_cost,
    cb.intake_status,
    cb.form_data,
    cb.current_step,
    cb.process_start,
    cb.current_phase,
    '6cb52f88-29bd-413f-a40d-9f7a3467d1d8'
  FROM cases cb
  WHERE cb.id = '516aab30-0b6d-4bd4-9822-6de3a7a328ef'
    AND NOT EXISTS (
      SELECT 1 FROM contracts
      WHERE id = '6cb52f88-29bd-413f-a40d-9f7a3467d1d8'
        AND case_id IS NOT NULL
        AND client_id = '92910109-8907-4ec7-9901-c8a10c3c0832'
    )
  RETURNING id
)
UPDATE contracts
SET client_id = '92910109-8907-4ec7-9901-c8a10c3c0832',
    case_id = (SELECT id FROM new_case)
WHERE id = '6cb52f88-29bd-413f-a40d-9f7a3467d1d8'
  AND EXISTS (SELECT 1 FROM new_case);

-- 3) Vincular contrato 1 con case A (idempotente).
UPDATE contracts
SET case_id = 'a1bd0971-9f56-4bb5-b428-7374e0445e8c'
WHERE id = 'ff0b1a2e-9be4-4ba6-b56b-2a7c2e1b81b1'
  AND (case_id IS NULL OR case_id <> 'a1bd0971-9f56-4bb5-b428-7374e0445e8c');

UPDATE cases
SET contract_id = 'ff0b1a2e-9be4-4ba6-b56b-2a7c2e1b81b1'
WHERE id = 'a1bd0971-9f56-4bb5-b428-7374e0445e8c'
  AND (contract_id IS NULL OR contract_id <> 'ff0b1a2e-9be4-4ba6-b56b-2a7c2e1b81b1');

-- 4) Limpiar tokens del profile fantasma B.
DELETE FROM appointment_tokens
WHERE client_id = 'd3e792ca-1973-48b4-bfed-e4fa9eae4209';

-- 5) Borrar el case fantasma vacío (HF-2026-0183).
DELETE FROM cases
WHERE id = '516aab30-0b6d-4bd4-9822-6de3a7a328ef';

-- 6) Borrar profile fantasma B y su auth.user.
DELETE FROM profiles WHERE id = 'd3e792ca-1973-48b4-bfed-e4fa9eae4209';
DELETE FROM auth.users WHERE id = 'd3e792ca-1973-48b4-bfed-e4fa9eae4209';

COMMIT;

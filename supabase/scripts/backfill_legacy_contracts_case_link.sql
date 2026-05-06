-- Backfill de contracts.case_id ↔ cases.contract_id para datos legacy
-- creados antes de la migración 20260507. Idempotente: re-ejecutarlo no
-- duplica nada.
--
-- Estrategia por contrato sin case_id:
--   1. Resolver service_id desde service_catalog. Si no existe, omitir.
--   2. Buscar el case del cliente para ese servicio MÁS CERCANO en tiempo
--      al created_at del contrato, que aún no tenga contract_id. Eso
--      reproduce la deduplicación implícita del schema viejo (1 case por
--      (client, service)) y respeta la regla 1:1 del schema nuevo.
--   3. Si encuentra → vincular bidireccionalmente.
--   4. Si NO encuentra (todos los cases del servicio ya están tomados) →
--      crear un case nuevo copiando atributos del case más cercano del
--      mismo cliente para ese servicio (replica del patrón de Jose Luis).
--
-- Verificar antes y después con:
--   SELECT COUNT(*) FROM contracts WHERE case_id IS NULL AND client_id IS NOT NULL;

DO $$
DECLARE
  rec RECORD;
  v_service_id UUID;
  v_case_id UUID;
  v_template_case RECORD;
BEGIN
  FOR rec IN
    SELECT id, client_id, service_slug, created_at
    FROM contracts
    WHERE case_id IS NULL AND client_id IS NOT NULL
    ORDER BY created_at ASC
  LOOP
    -- Resolver service_id.
    SELECT id INTO v_service_id
    FROM service_catalog
    WHERE slug = rec.service_slug;

    IF v_service_id IS NULL THEN
      -- Service slug obsoleto / fuera del catálogo. Saltar el contrato.
      CONTINUE;
    END IF;

    -- Buscar case más cercano en tiempo SIN contract_id asignado.
    SELECT id INTO v_case_id
    FROM cases
    WHERE client_id = rec.client_id
      AND service_id = v_service_id
      AND contract_id IS NULL
    ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - rec.created_at))) ASC
    LIMIT 1;

    IF v_case_id IS NOT NULL THEN
      -- Vincular bidireccional.
      UPDATE contracts SET case_id = v_case_id WHERE id = rec.id;
      UPDATE cases SET contract_id = rec.id WHERE id = v_case_id AND contract_id IS NULL;
    ELSE
      -- No hay case libre. Crear uno nuevo copiando del case más cercano
      -- del mismo cliente para ese servicio (preserva fase, intake_status,
      -- form_data si los hay).
      SELECT * INTO v_template_case
      FROM cases
      WHERE client_id = rec.client_id AND service_id = v_service_id
      ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - rec.created_at))) ASC
      LIMIT 1;

      IF v_template_case IS NULL THEN
        -- Cliente nunca tuvo case para este servicio. Crear case mínimo.
        INSERT INTO cases (client_id, service_id, total_cost, intake_status,
                           form_data, current_step, contract_id)
        VALUES (rec.client_id, v_service_id, 0, 'in_progress', '{}'::jsonb, 0, rec.id)
        RETURNING id INTO v_case_id;
      ELSE
        INSERT INTO cases (client_id, service_id, total_cost, intake_status,
                           form_data, current_step, process_start, current_phase,
                           contract_id)
        VALUES (rec.client_id, v_service_id,
                v_template_case.total_cost,
                v_template_case.intake_status,
                v_template_case.form_data,
                v_template_case.current_step,
                v_template_case.process_start,
                v_template_case.current_phase,
                rec.id)
        RETURNING id INTO v_case_id;
      END IF;

      UPDATE contracts SET case_id = v_case_id WHERE id = rec.id;
    END IF;
  END LOOP;
END
$$;

-- Verificación
SELECT 'contratos sin case_id (post)' AS metric, COUNT(*)::text AS value
FROM contracts WHERE case_id IS NULL AND client_id IS NOT NULL
UNION ALL SELECT 'cases sin contract_id (post)', COUNT(*)::text
FROM cases WHERE contract_id IS NULL;

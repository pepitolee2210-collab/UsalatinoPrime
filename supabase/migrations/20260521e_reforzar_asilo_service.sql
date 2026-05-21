-- Reforzar Asilo — servicio standalone para clientes que ya presentaron I-589.
--
-- Hoy "Asilo Politico" se vendia con dos subservicios internos: 'completo'
-- (arranca en Fase 1) y 'solo-reforzar' (arranca en Fase 2). Esta migracion
-- promueve 'solo-reforzar' a servicio top-level con slug 'reforzar-asilo':
-- nueva fila en service_catalog, comparte el enum case_phase con
-- 'asilo-politico' (reusa asilo_reforzar / asilo_completado) y arranca
-- directamente en la fase de reforzamiento.
--
-- Tambien agrega un documento NUEVO 'asylum_filed_i589_pages_1_4'
-- (paginas 1-4 del I-589 ya presentado) que solo aplica al nuevo servicio
-- — la Fase 2 del 'asilo-politico' completo NO lo pide.
--
-- Migra el unico contrato existente con subservice_slug='solo-reforzar' al
-- nuevo service_slug y actualiza el service_id de su case enlazado.

DO $$
DECLARE
  v_service_id UUID;
  v_doc_type_id BIGINT;
  v_contract_id UUID;
  v_case_id UUID;
BEGIN
  -- 1. service_catalog: nuevo servicio top-level "Reforzar Asilo"
  INSERT INTO service_catalog (
    name, slug, short_description, base_price, allow_installments,
    max_installments, min_down_payment_percent, estimated_duration,
    uscis_forms, is_active, icon, display_order
  ) VALUES (
    'Reforzar Asilo',
    'reforzar-asilo',
    'Reforzamiento del caso de Asilo Politico para clientes que ya presentaron su I-589 ante USCIS. Incluye declaracion jurada y generacion asistida del relato de Miedo Creible.',
    900.00,
    true,
    9,
    20,
    '6 meses a 3+ anos (depende del backlog de USCIS)',
    ARRAY['I-589'],
    true,
    'Shield',
    2
  )
  RETURNING id INTO v_service_id;

  -- 2. document_types: nuevo doc "Asilo Politico (Pag. 1-4)"
  INSERT INTO document_types (
    code, name_es, name_en, description_es,
    category_code, category_name_es, category_icon,
    slot_kind, max_slots, is_per_member, applies_to_roles,
    is_active, sort_order, requires_translation, requires_certified_copy,
    is_required
  ) VALUES (
    'asylum_filed_i589_pages_1_4',
    'Asilo Politico (Pag. 1-4)',
    'Filed Asylum I-589 (Pages 1-4)',
    'Las 4 primeras paginas del Formulario I-589 que ya presentaste a USCIS. Sube un PDF con esas paginas para que tu equipo legal sepa que se presento y pueda reforzar tu caso.',
    'documentos_legales',
    'I-589 presentado',
    'description',
    'single',
    1,
    false,
    NULL,
    true,
    50,
    false,
    false,
    true
  )
  RETURNING id INTO v_doc_type_id;

  -- 3. document_type_phases: 2 filas para reforzar-asilo en fase asilo_reforzar
  INSERT INTO document_type_phases (document_type_id, service_slug, phase_code, sort_order)
  VALUES
    (v_doc_type_id, 'reforzar-asilo', 'asilo_reforzar', 50),
    (85, 'reforzar-asilo', 'asilo_reforzar', 100);

  -- 4. Migrar el contrato legacy con subservice_slug='solo-reforzar' al nuevo servicio
  SELECT id, case_id INTO v_contract_id, v_case_id
  FROM contracts
  WHERE service_slug = 'asilo-politico' AND subservice_slug = 'solo-reforzar'
  LIMIT 1;

  IF v_contract_id IS NOT NULL THEN
    UPDATE contracts
    SET service_slug = 'reforzar-asilo',
        service_name = 'Reforzar Asilo',
        subservice_slug = NULL
    WHERE id = v_contract_id;

    IF v_case_id IS NOT NULL THEN
      UPDATE cases
      SET service_id = v_service_id
      WHERE id = v_case_id;
    END IF;
  END IF;
END;
$$;

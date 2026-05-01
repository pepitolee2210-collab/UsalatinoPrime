-- ══════════════════════════════════════════════════════════════════
-- Simplificación del catálogo I-360 e I-485 (Fases 2 y 3)
--
-- Reorganiza la pantalla "Documentos" del portal cliente para Fases
-- I-360 e I-485, replicando el patrón de la migración
-- 20260430_simplify_custodia_documents.sql.
--
-- I-360 (3 acordeones):
--   📄 Identificación del menor
--      acta, pasaporte, fotos USCIS, comodín
--   ⚖️ Orden judicial
--      Predicate Order, comodín
--   🛂 Historial migratorio
--      I-94, sello CBP, ORR consent (cond.), comodín
--
-- I-485 (4 acordeones):
--   📁 I-360 aprobada e identidad
--      I-797, acta, pasaporte completo, ID actual, fotos USCIS
--   🛂 Entrada a EE.UU.
--      I-94, sello CBP, ORR consent (cond.), comodín
--   🏥 Examen médico y antecedentes
--      I-693, criminal records (cond.), I-601 + soporte (cond.),
--      corte juvenil (comodín)
--   💵 Pago / I-912
--      filing fee / I-912, comprobante ingresos (comodín),
--      otros docs (comodín)
--
-- Solo afecta Fases I-360 e I-485. Custodia queda 100% intacta:
--   - shown_in_custodia no se modifica para ningún doc
--   - category_code no se modifica para ningún doc existente
--     (las categorías nuevas para i360/i485 se aplican vía override
--      en lib/document-types/phase-category-overrides.ts)
--
-- 0 casos están actualmente en i360/i485 — no hay uploads vivos
-- que migrar.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- A. Crear los 7 nuevos document_types (comodines y especiales)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.document_types
  (code, name_es, name_en, description_es, category_code, category_name_es, category_icon,
   requires_translation, requires_certified_copy, shown_in_custodia, shown_in_i360, shown_in_i485,
   conditional_logic, slot_kind, max_slots, sort_order, is_required, is_active)
VALUES
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- Comodines I-360
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ('other_minor_i360_documents',
   'Otros documentos del menor',
   'Other Minor Documents (I-360)',
   'Cualquier otro documento del menor que tu equipo legal te haya pedido para tu I-360.',
   'identificacion_menor_i360', 'Identificación del menor', 'badge',
   false, false, false, true, false,
   NULL, 'multiple_named', 10, 80, false, true),

  ('other_court_i360_documents',
   'Documentos auxiliares de la corte',
   'Other Court Documents (I-360)',
   'Documentos adicionales de la corte juvenil/familiar que tu equipo legal te haya pedido.',
   'orden_judicial_i360', 'Orden judicial', 'gavel',
   false, false, false, true, false,
   NULL, 'multiple_named', 10, 180, false, true),

  ('other_migration_i360_documents',
   'Otros documentos migratorios',
   'Other Immigration Documents (I-360)',
   'Cualquier otro documento de tu historial migratorio que tu equipo legal te haya pedido (A-Number, NTA, número de caso EOIR, etc.).',
   'historial_migratorio_i360', 'Historial migratorio', 'flight_land',
   false, false, false, true, false,
   NULL, 'multiple_named', 10, 280, false, true),

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- Comodines I-485
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ('other_entry_i485_documents',
   'Otros documentos de ingreso',
   'Other Entry Documents (I-485)',
   'Documentos adicionales de tu ingreso a EE.UU. (frontera, parole, documentos ORR adicionales, etc.).',
   'entrada_eeuu_i485', 'Entrada a EE.UU.', 'flight_land',
   false, false, false, false, true,
   NULL, 'multiple_named', 10, 130, false, true),

  ('juvenile_court_records',
   'Documentos de corte juvenil',
   'Juvenile Court Records',
   'Documentos del tribunal juvenil si el menor tuvo algún caso de delincuencia juvenil.',
   'medico_antecedentes_i485', 'Examen médico y antecedentes', 'medical_services',
   false, false, false, false, true,
   NULL, 'multiple_named', 10, 240, false, true),

  ('i912_income_proof',
   'Prueba de ingresos / beneficios públicos',
   'Income or Public Benefits Proof (I-912)',
   'Comprobantes de ingresos del menor o del custodio, o evidencia de beneficios públicos, para soportar el fee waiver I-912 si aplica.',
   'pago_i912_i485', 'Pago / I-912', 'payments',
   false, false, false, false, true,
   NULL, 'multiple_named', 10, 310, false, true),

  ('other_i485_documents',
   'Otros documentos',
   'Other Documents (I-485)',
   'Cualquier otro documento que tu equipo legal te haya pedido para tu I-485.',
   'pago_i912_i485', 'Pago / I-912', 'payments',
   false, false, false, false, true,
   NULL, 'multiple_named', 10, 320, false, true)

ON CONFLICT (code) DO UPDATE SET
  name_es = EXCLUDED.name_es,
  name_en = EXCLUDED.name_en,
  description_es = EXCLUDED.description_es,
  category_code = EXCLUDED.category_code,
  category_name_es = EXCLUDED.category_name_es,
  category_icon = EXCLUDED.category_icon,
  shown_in_custodia = EXCLUDED.shown_in_custodia,
  shown_in_i360 = EXCLUDED.shown_in_i360,
  shown_in_i485 = EXCLUDED.shown_in_i485,
  slot_kind = EXCLUDED.slot_kind,
  max_slots = EXCLUDED.max_slots,
  sort_order = EXCLUDED.sort_order,
  is_required = EXCLUDED.is_required,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ─────────────────────────────────────────────────────────────────
-- B. Apagar shown_in_i360 para docs no listados por el cliente
--    (evidencias granulares, formularios internos de firma, etc.)
-- ─────────────────────────────────────────────────────────────────

UPDATE public.document_types
SET shown_in_i360 = false, updated_at = now()
WHERE code IN (
  -- Cubiertos por pasaporte/acta o duplicados
  'minor_national_id',
  'minor_passport_photo',
  -- Sobre la familia (no se piden al cliente en consulta)
  'parents_marriage_certificate',
  'parents_divorce_certificate',
  'parent_death_certificate',
  -- Evidencia granular (queda como soporte interno; cliente no la sube directamente)
  'minor_affidavit',
  'custodian_affidavit',
  'witness_affidavits',
  'police_reports',
  'protection_orders',
  'medical_records',
  'mental_health_records',
  'school_records',
  'teacher_letters',
  'religious_letters',
  'doctor_letters',
  'evidence_photos',
  'communications',
  'cps_reports',
  'country_social_services',
  'country_conditions_reports',
  'country_violence_reports',
  'threats_evidence',
  'us_school_progress',
  'us_community_letters',
  -- Internos de la firma (Diana los sube como firm_internal)
  'attorney_g28',
  'i360_form',
  'i360_cover_letter',
  'court_auxiliary_docs',
  -- Pertenece exclusivamente a Custodia
  'other_custodian_documents'
);

-- ─────────────────────────────────────────────────────────────────
-- C. Apagar shown_in_i485 para docs no listados por el cliente
-- ─────────────────────────────────────────────────────────────────

UPDATE public.document_types
SET shown_in_i485 = false, updated_at = now()
WHERE code IN (
  -- En I-485 se usa passport_full_pages (id 52), no minor_passport (id 2)
  'minor_passport',
  -- Duplicado con uscis_passport_photos (id 48)
  'minor_passport_photo',
  -- No esenciales en lista del usuario
  'school_records',
  'us_school_progress',
  'us_community_letters',
  -- Internos de la firma
  'attorney_g28',
  'i485_form',
  -- Aplicaciones concurrentes opcionales (no en lista del usuario)
  'tax_returns',
  'i765_ead',
  'i131_advance_parole',
  -- Pertenece exclusivamente a Custodia
  'other_custodian_documents'
);

-- ─────────────────────────────────────────────────────────────────
-- D. Activar shown_in_i485 para orr_consent
--    El usuario lo pide explícitamente para I-485 (entrada a EE.UU.)
-- ─────────────────────────────────────────────────────────────────

UPDATE public.document_types
SET shown_in_i485 = true, updated_at = now()
WHERE code = 'orr_consent';

COMMIT;

-- ─────────────────────────────────────────────────────────────────
-- E. Verificación (correr a mano después de aplicar)
-- ─────────────────────────────────────────────────────────────────

-- Custodia debe seguir igual: 14 cards en 3 categorías (4+7+3).
--
-- SELECT category_code, category_name_es,
--        COUNT(*) FILTER (WHERE is_required) AS obligatorios,
--        COUNT(*) AS total
-- FROM public.document_types
-- WHERE shown_in_custodia AND is_active
-- GROUP BY category_code, category_name_es
-- ORDER BY MIN(sort_order);
--
-- I-360: docs visibles agrupados por category_code del catálogo.
-- (El override de fase agrupará visualmente al cliente bajo
--  identificacion_menor_i360 / orden_judicial_i360 / historial_migratorio_i360.)
--
-- SELECT id, code, name_es, category_code, slot_kind, is_required,
--        sort_order, shown_in_i360
-- FROM public.document_types
-- WHERE shown_in_i360 AND is_active
-- ORDER BY sort_order;
--
-- I-485: docs visibles
--
-- SELECT id, code, name_es, category_code, slot_kind, is_required,
--        sort_order, shown_in_i485
-- FROM public.document_types
-- WHERE shown_in_i485 AND is_active
-- ORDER BY sort_order;

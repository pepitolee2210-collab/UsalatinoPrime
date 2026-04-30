-- ══════════════════════════════════════════════════════════════════
-- Simplificación del catálogo Custodia (Fase 1)
--
-- Reorganiza la pantalla "Documentos" del portal cliente para Fase
-- Custodia en 3 acordeones: Documentos del Menor, Documentos del
-- Tutor, Evidencias Sustentatorias. Cada sección tiene un comodín
-- "Otros documentos…" donde el cliente sube lo que no encaja.
--
-- Antes: 37 cards en 7 categorías heredadas. Después: 14 cards
-- (10 obligatorias + 4 opcionales) en 3 categorías.
--
-- Solo afecta Fase Custodia. Casos en I-360/I-485 quedan intactos.
-- Los uploads históricos (~270 archivos en 10+ casos activos) se
-- preservan reasignando document_type_id a las nuevas cards.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- A. Crear los 5 nuevos document_types
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.document_types
  (code, name_es, name_en, description_es, category_code, category_name_es, category_icon,
   requires_translation, requires_certified_copy, shown_in_custodia, shown_in_i360, shown_in_i485,
   conditional_logic, slot_kind, max_slots, sort_order, is_required, is_active)
VALUES
  ('other_minor_documents',
   'Otros documentos del menor',
   'Other Minor Documents',
   'Cualquier otro documento del menor que tu equipo legal te haya pedido (foto pasaporte, I-94, sello CBP, etc.).',
   'documentos_menor', 'Documentos del Menor', 'child_care',
   false, false, true, false, false,
   NULL, 'multiple_named', 10, 80, false, true),

  ('school_residence_proof',
   'Prueba de residencia escolar',
   'School Residence Proof',
   'Comprobante de inscripción o asistencia escolar del menor en su escuela actual. Sirve como prueba de domicilio.',
   'documentos_tutor', 'Documentos del Tutor', 'home',
   false, false, true, false, false,
   NULL, 'single', NULL, 160, true, true),

  ('witness_ids',
   'ID de testigos',
   'Witness IDs',
   'Identificaciones (cédula, pasaporte o licencia) de cada testigo que firmará declaración jurada en tu caso.',
   'evidencias_sustentatorias', 'Evidencias Sustentatorias', 'gavel',
   false, false, true, false, false,
   NULL, 'multiple_named', 10, 210, true, true),

  ('evidence_general',
   'Evidencias',
   'Supporting Evidence',
   'Cualquier evidencia que sustente tu situación: fotos de lesiones, reportes policiales, diagnósticos médicos, récords escolares, expedientes de salud mental, cartas de maestros/médicos/líderes religiosos, comunicaciones, reportes CPS, etc.',
   'evidencias_sustentatorias', 'Evidencias Sustentatorias', 'gavel',
   false, false, true, false, false,
   NULL, 'multiple_named', 30, 220, true, true),

  ('other_evidence_documents',
   'Otros documentos de soporte',
   'Other Supporting Documents',
   'Cualquier otro documento de soporte que tu equipo legal te haya pedido y no encaje en las cards anteriores.',
   'evidencias_sustentatorias', 'Evidencias Sustentatorias', 'gavel',
   false, false, true, false, false,
   NULL, 'multiple_named', 10, 230, false, true)

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
-- B. Reasignar categorías Custodia (sin cambiar el code)
-- ─────────────────────────────────────────────────────────────────

-- 1) Documentos del Menor
UPDATE public.document_types SET
  category_code = 'documentos_menor',
  category_name_es = 'Documentos del Menor',
  category_icon = 'child_care',
  sort_order = 10,
  updated_at = now()
WHERE code = 'minor_birth_certificate';

UPDATE public.document_types SET
  category_code = 'documentos_menor',
  category_name_es = 'Documentos del Menor',
  category_icon = 'child_care',
  sort_order = 20,
  updated_at = now()
WHERE code = 'minor_passport';

UPDATE public.document_types SET
  category_code = 'documentos_menor',
  category_name_es = 'Documentos del Menor',
  category_icon = 'child_care',
  name_es = 'ID del menor',
  description_es = 'DNI, cédula o documento nacional de identidad del menor del país de origen.',
  sort_order = 30,
  updated_at = now()
WHERE code = 'minor_national_id';

-- 2) Documentos del Tutor
UPDATE public.document_types SET
  category_code = 'documentos_tutor',
  category_name_es = 'Documentos del Tutor',
  category_icon = 'home',
  name_es = 'ID del tutor',
  sort_order = 90,
  updated_at = now()
WHERE code = 'custodian_photo_id';

UPDATE public.document_types SET
  category_code = 'documentos_tutor',
  category_name_es = 'Documentos del Tutor',
  category_icon = 'home',
  sort_order = 100,
  updated_at = now()
WHERE code = 'home_lease';

UPDATE public.document_types SET
  category_code = 'documentos_tutor',
  category_name_es = 'Documentos del Tutor',
  category_icon = 'home',
  sort_order = 110,
  updated_at = now()
WHERE code = 'home_utility_bills';

UPDATE public.document_types SET
  category_code = 'documentos_tutor',
  category_name_es = 'Documentos del Tutor',
  category_icon = 'home',
  sort_order = 120,
  updated_at = now()
WHERE code = 'custodian_income_proof';

-- ─────────────────────────────────────────────────────────────────
-- C. Renombrar other_supporting → other_custodian_documents
-- ─────────────────────────────────────────────────────────────────

UPDATE public.document_types SET
  code = 'other_custodian_documents',
  name_es = 'Otros documentos del tutor',
  name_en = 'Other Custodian Documents',
  description_es = 'Cualquier otro documento del tutor o del hogar que tu equipo legal te haya pedido y no encaje en las cards anteriores (estatus migratorio, antecedentes penales, actas familiares, etc.).',
  category_code = 'documentos_tutor',
  category_name_es = 'Documentos del Tutor',
  category_icon = 'home',
  slot_kind = 'multiple_named',
  max_slots = 10,
  is_required = false,
  shown_in_custodia = true,
  sort_order = 170,
  updated_at = now()
WHERE code = 'other_supporting';

-- ─────────────────────────────────────────────────────────────────
-- D. Acta de nacimiento del custodio → opcional + reasignar
-- ─────────────────────────────────────────────────────────────────

UPDATE public.document_types SET
  category_code = 'documentos_tutor',
  category_name_es = 'Documentos del Tutor',
  category_icon = 'home',
  is_required = false,
  sort_order = 140,
  updated_at = now()
WHERE code = 'custodian_birth_certificate';

-- ─────────────────────────────────────────────────────────────────
-- E. Quitar de Custodia los docs no listados
-- ─────────────────────────────────────────────────────────────────

UPDATE public.document_types
SET shown_in_custodia = false, updated_at = now()
WHERE code IN (
  -- Del menor
  'minor_passport_photo', 'minor_i94', 'minor_cbp_stamp',
  -- Del custodio / hogar / familia
  'custodian_immigration_status', 'custodian_background_check',
  'custodian_marriage_certificate', 'care_plan',
  'parents_marriage_certificate', 'parents_divorce_certificate',
  'parent_death_certificate', 'relation_documents',
  -- Evidencia (todas las granulares)
  'minor_affidavit', 'custodian_affidavit', 'witness_affidavits',
  'police_reports', 'protection_orders', 'medical_records',
  'mental_health_records', 'school_records', 'teacher_letters',
  'religious_letters', 'doctor_letters', 'evidence_photos',
  'communications', 'cps_reports', 'country_social_services',
  'country_conditions_reports', 'country_violence_reports',
  'threats_evidence', 'us_school_progress', 'us_community_letters',
  -- Condicionales / legales
  'parent_consent', 'foreign_parent_notice', 'orr_consent',
  'attorney_g28'
);

-- ─────────────────────────────────────────────────────────────────
-- F. Migrar uploads históricos (solo casos en Custodia)
-- ─────────────────────────────────────────────────────────────────

-- Set para preservar referencia clara: solo afectamos uploads cuyo
-- caso está actualmente en Custodia. Casos ya en I-360/I-485 quedan
-- con su document_type_id original (sus cards granulares siguen
-- siendo visibles allá).

-- F.1 → evidence_general
UPDATE public.documents SET
  document_type_id = (SELECT id FROM public.document_types WHERE code = 'evidence_general')
WHERE case_id IN (SELECT id FROM public.cases WHERE current_phase = 'custodia')
  AND document_type_id IN (
    SELECT id FROM public.document_types WHERE code IN (
      'evidence_photos', 'school_records', 'witness_affidavits',
      'medical_records', 'mental_health_records', 'teacher_letters',
      'religious_letters', 'doctor_letters', 'cps_reports',
      'country_social_services', 'country_conditions_reports',
      'country_violence_reports', 'threats_evidence',
      'us_school_progress', 'us_community_letters',
      'communications', 'protection_orders', 'police_reports',
      'minor_affidavit', 'custodian_affidavit'
    )
  );

-- F.2 → other_minor_documents
UPDATE public.documents SET
  document_type_id = (SELECT id FROM public.document_types WHERE code = 'other_minor_documents')
WHERE case_id IN (SELECT id FROM public.cases WHERE current_phase = 'custodia')
  AND document_type_id IN (
    SELECT id FROM public.document_types WHERE code IN (
      'minor_passport_photo', 'minor_i94', 'minor_cbp_stamp'
    )
  );

-- F.3 → other_custodian_documents
UPDATE public.documents SET
  document_type_id = (SELECT id FROM public.document_types WHERE code = 'other_custodian_documents')
WHERE case_id IN (SELECT id FROM public.cases WHERE current_phase = 'custodia')
  AND document_type_id IN (
    SELECT id FROM public.document_types WHERE code IN (
      'custodian_immigration_status', 'custodian_background_check',
      'custodian_marriage_certificate', 'care_plan',
      'parents_marriage_certificate', 'parents_divorce_certificate',
      'parent_death_certificate', 'relation_documents',
      'attorney_g28', 'parent_consent', 'foreign_parent_notice',
      'orr_consent'
    )
  );

COMMIT;

-- ─────────────────────────────────────────────────────────────────
-- G. Verificación (correr a mano después de aplicar)
-- ─────────────────────────────────────────────────────────────────

-- Conteo por categoría visible en Custodia.
-- Esperado: documentos_menor=4, documentos_tutor=7, evidencias_sustentatorias=3
--
-- SELECT category_code, category_name_es,
--        COUNT(*) FILTER (WHERE shown_in_custodia AND is_active) AS total,
--        COUNT(*) FILTER (WHERE shown_in_custodia AND is_active AND is_required) AS obligatorios
-- FROM public.document_types
-- WHERE shown_in_custodia AND is_active
-- GROUP BY category_code, category_name_es
-- ORDER BY MIN(sort_order);
--
-- Listado completo ordenado:
--
-- SELECT id, code, name_es, category_code, slot_kind, is_required,
--        sort_order, shown_in_custodia
-- FROM public.document_types
-- WHERE shown_in_custodia AND is_active
-- ORDER BY sort_order;

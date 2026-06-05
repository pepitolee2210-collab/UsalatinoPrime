-- ════════════════════════════════════════════════════════════════════
-- Servicio "Ajuste de Estatus por Matrimonio" — alta + documentos por fase.
-- Independiente del servicio `ajuste-de-estatus` existente y de Visa Juvenil.
-- Requiere que 20260605b (enum) ya esté aplicada.
-- ════════════════════════════════════════════════════════════════════

-- 1) Alta del servicio en el catálogo
INSERT INTO public.service_catalog
  (name, slug, short_description, base_price, allow_installments, estimated_duration, uscis_forms, is_active, icon, display_order)
VALUES (
  'Ajuste de Estatus por Matrimonio',
  'ajuste-de-estatus-matrimonio',
  'Residencia permanente por matrimonio con ciudadano estadounidense: Petición I-130 (Fase 1) y Ajuste de Estatus I-485 (Fase 2).',
  2500,
  true,
  '12-24 meses',
  ARRAY['I-130','I-485','I-864','I-765','I-131','I-693']::text[],
  true,
  'family_restroom',
  12
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  uscis_forms = EXCLUDED.uscis_forms,
  icon = EXCLUDED.icon,
  is_active = true;

-- 2) Document types nuevos (prefijo aem_ = Ajuste Estatus Matrimonio).
--    Textos correctos para adultos/cónyuge (los minor_* dicen "del menor").
--    shown_in_* = false: este servicio resuelve docs por document_type_phases (M2M).
INSERT INTO public.document_types
  (code, name_es, name_en, description_es, category_code, category_name_es, category_icon,
   requires_translation, requires_certified_copy, shown_in_custodia, shown_in_i360, shown_in_i485,
   slot_kind, max_slots, sort_order, is_active, is_required, is_per_member)
VALUES
  ('aem_marriage_certificate', 'Acta de matrimonio', 'Marriage Certificate',
   'Certificado oficial de tu matrimonio. Si está en español, adjunta también la traducción certificada al inglés.',
   'matrimonio_docs', 'Documentos del matrimonio', 'family_restroom',
   true, true, false, false, false, 'dual_es_en', NULL, 110, true, true, false),

  ('aem_petitioner_citizenship', 'Prueba de ciudadanía del esposo', 'Petitioner U.S. Citizenship Proof',
   'Pasaporte estadounidense, certificado de naturalización o acta de nacimiento de EE. UU. del cónyuge ciudadano.',
   'matrimonio_docs', 'Documentos del matrimonio', 'family_restroom',
   false, false, false, false, false, 'single', NULL, 120, true, true, false),

  ('aem_beneficiary_passport', 'Pasaporte de la cónyuge', 'Beneficiary Passport',
   'Páginas biográficas del pasaporte de la cónyuge que solicita la residencia.',
   'beneficiaria_identidad', 'Identidad de la cónyuge', 'badge',
   false, false, false, false, false, 'single', NULL, 130, true, true, false),

  ('aem_beneficiary_entry', 'I-94, visa o prueba de entrada / parole', 'I-94, Visa or Proof of Entry/Parole',
   'Tu registro I-94, visa, sello de entrada o parole que prueba tu entrada legal a EE. UU.',
   'beneficiaria_identidad', 'Identidad de la cónyuge', 'badge',
   false, false, false, false, false, 'single', NULL, 140, true, true, false),

  ('aem_beneficiary_birth_certificate', 'Acta de nacimiento de la cónyuge', 'Beneficiary Birth Certificate',
   'Acta de nacimiento de la cónyuge solicitante. Si está en español, adjunta la traducción certificada al inglés.',
   'beneficiaria_identidad', 'Identidad de la cónyuge', 'badge',
   true, true, false, false, false, 'dual_es_en', NULL, 150, true, true, false),

  ('aem_divorce_decrees', 'Actas de divorcio (si aplica)', 'Divorce Decrees (if applicable)',
   'Si alguno de los dos estuvo casado antes, adjunta las actas de divorcio, anulación o defunción que terminaron el matrimonio previo.',
   'matrimonio_docs', 'Documentos del matrimonio', 'family_restroom',
   true, false, false, false, false, 'multiple_named', 6, 160, true, false, false),

  ('aem_marriage_evidence', 'Evidencia de matrimonio real (buena fe)', 'Bona Fide Marriage Evidence',
   'Fotos juntos, cuentas bancarias conjuntas, contrato de renta (lease), seguros, taxes conjuntos, mensajes, viajes, recibos y cartas de familiares. Cuanto más variada y consistente, mejor.',
   'evidencia_matrimonio', 'Evidencia de matrimonio real', 'photo_library',
   false, false, false, false, false, 'multiple_named', 20, 170, true, true, false),

  ('aem_petitioner_income', 'Taxes, W-2, paystubs y carta de empleo del ciudadano', 'Petitioner Tax Returns, W-2, Paystubs and Employment Letter',
   'Declaraciones de impuestos, W-2, talones de pago (paystubs) y carta de empleo del cónyuge ciudadano.',
   'financiero', 'Documentos financieros del patrocinador', 'payments',
   false, false, false, false, false, 'multiple_named', 10, 180, true, true, false),

  ('aem_certified_translations', 'Traducciones certificadas', 'Certified Translations',
   'Traducción al inglés con certificación del traductor para todo documento en español (acta de matrimonio, divorcios, acta de nacimiento, etc.).',
   'traducciones', 'Traducciones certificadas', 'translate',
   false, false, false, false, false, 'multiple_named', 10, 190, true, false, false),

  ('aem_i797_i130', 'Recibo o aprobación del I-130 (Form I-797)', 'I-130 Receipt or Approval Notice (Form I-797)',
   'El aviso I-797 que comprueba que la petición I-130 fue recibida o aprobada (base del ajuste de estatus).',
   'formularios_uscis', 'Formularios USCIS', 'description',
   false, false, false, false, false, 'single', NULL, 200, true, false, false),

  ('aem_i864_income', 'I-864 con taxes, W-2 y paystubs del esposo', 'I-864 with Petitioner Tax Returns, W-2 and Paystubs',
   'Declaración Jurada de Patrocinio Económico (I-864) del cónyuge ciudadano con sus impuestos, W-2 y talones de pago (ingreso ≥ 125% de la línea de pobreza).',
   'financiero', 'Documentos financieros del patrocinador', 'payments',
   false, false, false, false, false, 'multiple_named', 10, 210, true, true, false)
ON CONFLICT (code) DO NOTHING;

-- 3) Documentos por fase (M2M). Reusa códigos genéricos existentes
--    (i693_medical, uscis_passport_photos, i765_ead, i131_advance_parole).
INSERT INTO public.document_type_phases
  (document_type_id, service_slug, phase_code, sort_order, is_required_override)
SELECT dt.id, 'ajuste-de-estatus-matrimonio', v.phase_code::public.case_phase, v.sort_order, v.is_required
FROM (
  VALUES
    -- Fase 1 — I-130
    ('aem_marriage_certificate',          'matrimonio_i130', 10,  true),
    ('aem_petitioner_citizenship',        'matrimonio_i130', 20,  true),
    ('aem_beneficiary_passport',          'matrimonio_i130', 30,  true),
    ('aem_beneficiary_entry',             'matrimonio_i130', 40,  true),
    ('aem_marriage_evidence',             'matrimonio_i130', 50,  true),
    ('aem_petitioner_income',             'matrimonio_i130', 60,  true),
    ('aem_divorce_decrees',               'matrimonio_i130', 70,  false),
    ('aem_certified_translations',        'matrimonio_i130', 80,  false),
    -- Fase 2 — I-485
    ('aem_i797_i130',                     'matrimonio_i485', 10,  false),
    ('aem_beneficiary_passport',          'matrimonio_i485', 20,  true),
    ('aem_beneficiary_birth_certificate', 'matrimonio_i485', 30,  true),
    ('aem_beneficiary_entry',             'matrimonio_i485', 40,  true),
    ('i693_medical',                      'matrimonio_i485', 50,  true),
    ('aem_i864_income',                   'matrimonio_i485', 60,  true),
    ('uscis_passport_photos',             'matrimonio_i485', 70,  true),
    ('aem_marriage_certificate',          'matrimonio_i485', 80,  true),
    ('aem_petitioner_citizenship',        'matrimonio_i485', 90,  true),
    ('aem_marriage_evidence',             'matrimonio_i485', 100, true),
    ('aem_divorce_decrees',               'matrimonio_i485', 110, false),
    ('i765_ead',                          'matrimonio_i485', 120, false),
    ('i131_advance_parole',               'matrimonio_i485', 130, false)
) AS v(code, phase_code, sort_order, is_required)
JOIN public.document_types dt ON dt.code = v.code
ON CONFLICT (document_type_id, service_slug, phase_code) DO NOTHING;

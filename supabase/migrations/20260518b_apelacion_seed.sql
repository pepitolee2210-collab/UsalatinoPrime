-- Apelación: parte B — seed del servicio, document_types y M2M phase mapping.
--
-- Requiere que 20260518a_apelacion_enum.sql se haya aplicado antes (el valor
-- 'apelacion' del enum case_phase debe existir).
--
-- Aplicada via Supabase MCP el 2026-05-18. Esta copia vive en el repo solo
-- como reflejo del estado real.

-- A. Service en service_catalog (display_order al final).
INSERT INTO public.service_catalog (
  slug, name, short_description, base_price,
  allow_installments, max_installments, uscis_forms,
  is_active, display_order
) VALUES (
  'apelacion',
  'Apelación',
  'Apelación ante la Junta de Apelaciones de Inmigración (BIA) mediante Formularios EOIR-26 / EOIR-26A',
  500.00,
  true,
  5,
  ARRAY['EOIR-26', 'EOIR-26A']::text[],
  true,
  11
)
ON CONFLICT (slug) DO NOTHING;

-- B. 3 document_types con códigos namespaced para evitar colisiones futuras.
INSERT INTO public.document_types (
  code, name_es, name_en, description_es,
  category_code, category_name_es, category_icon,
  requires_translation, requires_certified_copy,
  slot_kind, sort_order, is_active, is_required
) VALUES
  ('apelacion_pasaporte', 'Pasaporte del Apelante', 'Appellant Passport',
   'Pasaporte vigente del adulto que presenta la apelación.',
   'identidad_apelacion', 'Identidad', 'badge',
   false, false, 'single', 1, true, true),
  ('apelacion_asilo_completo', 'Asilo Completo Presentado', 'Filed Asylum Application',
   'Copia completa del paquete de Asilo (I-589 + evidencias) que se presentó originalmente.',
   'expediente_apelacion', 'Expediente', 'folder',
   false, true, 'single', 2, true, true),
  ('apelacion_denegacion_juez', 'Auto de Denegación del Juez', 'Judge Denial Order',
   'Decisión escrita del Juez de Inmigración denegando el asilo (objeto de la apelación).',
   'expediente_apelacion', 'Expediente', 'gavel',
   false, true, 'single', 3, true, true)
ON CONFLICT (code) DO NOTHING;

-- C. M2M document_type_phases — los 3 docs visibles en fase 'apelacion'
--    del servicio 'apelacion'.
INSERT INTO public.document_type_phases (
  document_type_id, service_slug, phase_code, sort_order
)
SELECT dt.id, 'apelacion', 'apelacion'::public.case_phase, dt.sort_order
FROM public.document_types dt
WHERE dt.code IN ('apelacion_pasaporte', 'apelacion_asilo_completo', 'apelacion_denegacion_juez')
ON CONFLICT (document_type_id, service_slug, phase_code) DO NOTHING;

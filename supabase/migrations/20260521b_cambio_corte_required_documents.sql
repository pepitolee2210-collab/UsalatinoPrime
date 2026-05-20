-- Cambio de Corte: 3 documentos requeridos al cliente en su portal /cita
--
-- 1. Pasaporte o ID
-- 2. Documento de ingreso (Parole o Notice to Appear / NTA)
-- 3. Documento sustentatorio de nueva dirección (contrato de arrendamiento,
--    bill de servicio, etc.) — slot múltiple para que el cliente suba varios
--
-- Aplicada via Supabase MCP el 2026-05-20. Esta copia vive en el repo solo
-- como reflejo del estado real. La columna `is_per_minor` es generada por la
-- BD (no se pasa en el INSERT).
--
-- Dependencia: `case_phase` enum debe contener 'cambio_de_corte' (migración
-- 20260521_cambio_corte_enum.sql aplicada antes).

INSERT INTO public.document_types
  (code, name_es, name_en, description_es, category_code, category_name_es,
   slot_kind, sort_order, is_required, is_active)
VALUES
  ('cambio_corte_pasaporte_id',
   'Pasaporte o ID',
   'Passport or ID',
   'Documento de identidad oficial: pasaporte vigente, cédula nacional, ID consular o licencia de conducir.',
   'identidad_cambio_corte', 'Identidad y entrada',
   'single', 10, true, true),
  ('cambio_corte_parole_nta',
   'Documento de ingreso (Parole o NTA)',
   'Entry Document (Parole or Notice to Appear)',
   'Parole emitido al ingresar a EE.UU. o el Notice to Appear (NTA) del Departamento de Seguridad Nacional (DHS).',
   'identidad_cambio_corte', 'Identidad y entrada',
   'single', 20, true, true),
  ('cambio_corte_nueva_direccion',
   'Documento sustentatorio de nueva dirección',
   'Proof of New Address',
   'Documento que acredite la nueva dirección: contrato de arrendamiento, bill de servicios (luz/agua/gas/internet) o estado de cuenta bancario reciente. Puede subir varios.',
   'direccion_cambio_corte', 'Comprobante de domicilio',
   'multiple_named', 30, true, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.document_type_phases
  (document_type_id, service_slug, phase_code, sort_order)
SELECT id, 'cambio-de-corte', 'cambio_de_corte'::case_phase,
  CASE code
    WHEN 'cambio_corte_pasaporte_id' THEN 10
    WHEN 'cambio_corte_parole_nta' THEN 20
    WHEN 'cambio_corte_nueva_direccion' THEN 30
  END
FROM public.document_types
WHERE code IN (
  'cambio_corte_pasaporte_id',
  'cambio_corte_parole_nta',
  'cambio_corte_nueva_direccion'
)
ON CONFLICT DO NOTHING;

-- 20260602b — Reintroduce "Carta de declaración jurada" (id=85) como upload OPCIONAL del cliente en Fase 2 de Asilo.
--
-- Contexto: 20260522a quitó este upload porque "el cliente no sabe llenar una
-- declaración jurada formal" y la baja calidad del input degradaba el relato de
-- Miedo Creíble. Ahora se reintroduce de forma SEGURA y mejorada:
--   * Es OPCIONAL (is_required_override=false) y destacado en la UI; NO reemplaza
--     el cuestionario M1-M11 — lo complementa.
--   * Pensado para clientes que YA tienen una declaración jurada redactada
--     (típicamente con abogado) y quieren que su relato en primera persona sea
--     la base de la carta del Miedo Creíble.
--   * La extracción ahora transcribe el RELATO COMPLETO (no solo datos sueltos) y
--     el generador v6 la trata como narrativa primaria autorizada
--     (bloque <client_sworn_declaration>), no como evidencia documental suelta.
--
-- Reutiliza el document_type 85 existente (su description_es ya apuntaba a esto),
-- renombrándolo a "Carta de declaración jurada". No se toca el `code`
-- (asylum_personal_affidavit) porque lo usan el generador y los uploads previos.
-- Idempotente: el UPDATE es estable y el INSERT usa ON CONFLICT DO NOTHING.

UPDATE public.document_types
SET name_es          = 'Carta de declaración jurada',
    name_en          = 'Sworn Declaration Letter',
    description_es    = 'Si ya tienes una carta de declaración jurada con tu historia (tu relato de persecución, escrito en primera persona), súbela aquí en PDF. Tu equipo legal la usará como base para redactar tu carta del Miedo Creíble. Es opcional: si no la tienes, basta con que completes el cuestionario.',
    category_name_es  = 'Tu declaración jurada',
    category_icon     = 'history_edu',
    is_active         = true,
    updated_at        = NOW()
WHERE id = 85 AND code = 'asylum_personal_affidavit';

-- M2M: visible y OPCIONAL en Fase 2 (asilo_reforzar) para AMBOS servicios,
-- primero en la lista del solicitante (sort_order=10; las evidencias están en 200+).
INSERT INTO public.document_type_phases
  (document_type_id, service_slug, phase_code, is_required_override, sort_order)
SELECT dt.id, s.slug, 'asilo_reforzar', false, 10
FROM public.document_types dt
CROSS JOIN (VALUES ('asilo-politico'), ('reforzar-asilo')) AS s(slug)
WHERE dt.code = 'asylum_personal_affidavit'
ON CONFLICT (document_type_id, service_slug, phase_code) DO NOTHING;

-- Cleanup de documentos Asilo Político + nueva columna applies_to_roles.
-- Aplicada en producción 2026-05-15 via Supabase MCP.
--
-- 1) Quitar texto entre paréntesis del name_es de docs Asilo: el contexto va
--    en description_es. Henry pidió ver "Acta de matrimonio" / "Partida de
--    nacimiento del hijo" sin la aclaración entre paréntesis.
--
-- 2) Nueva columna document_types.applies_to_roles TEXT[] que restringe a qué
--    miembros se expande un doc per-member. NULL = todos los roles
--    (comportamiento previo). Para asylum_birth_cert_child, solo 'minor'
--    (no aparece para applicant ni spouse).
--
-- 3) Limpiar M2M Fase 1 (asilo_sustentos) quitando i589_filled_partial — eso
--    se llena en la pestaña Formularios via wizard, no es un upload.
--
-- 4) Limpiar M2M Fase 2 (asilo_reforzar) dejando SOLO asylum_personal_affidavit.
--    Los otros 4 (supporting_evidence, country_conditions, i589_filled_complete,
--    credible_fear_final) son artefactos generados por la firma o subidos por
--    Diana en otra superficie — no documentos del cliente.

UPDATE document_types
SET name_es = 'Acta de matrimonio'
WHERE code = 'asylum_marriage_cert';

UPDATE document_types
SET name_es = 'Partida de nacimiento del hijo'
WHERE code = 'asylum_birth_cert_child';

ALTER TABLE document_types
  ADD COLUMN IF NOT EXISTS applies_to_roles TEXT[];

COMMENT ON COLUMN document_types.applies_to_roles IS
  'Cuando is_per_member=true, restringe la expansión a estos roles. NULL = todos.';

UPDATE document_types
SET applies_to_roles = ARRAY['minor']::text[]
WHERE code = 'asylum_birth_cert_child';

DELETE FROM document_type_phases
WHERE service_slug = 'asilo-politico'
  AND phase_code = 'asilo_sustentos'
  AND document_type_id = (SELECT id FROM document_types WHERE code = 'i589_filled_partial');

DELETE FROM document_type_phases
WHERE service_slug = 'asilo-politico'
  AND phase_code = 'asilo_reforzar'
  AND document_type_id IN (
    SELECT id FROM document_types
    WHERE code IN (
      'asylum_supporting_evidence',
      'asylum_country_conditions',
      'i589_filled_complete',
      'credible_fear_final'
    )
  );

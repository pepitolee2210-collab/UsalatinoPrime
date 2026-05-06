-- 20260507 — Phone-first identity, per-contract cases, per-minor documents.
--
-- Cambios estructurales para que:
--   1) El teléfono normalizado sea el identificador estable del cliente.
--   2) Cada contrato firmado tenga su propio case (1:1, sin deduplicación).
--   3) Los documentos puedan asociarse a un hijo específico del contrato.
--
-- El UNIQUE INDEX sobre normalize_phone(profiles.phone) se aplica en la
-- migración 20260508, después de la reconciliación de datos legacy
-- (script reconcile_jose_luis_criollo.sql), para evitar que choque con
-- duplicados existentes durante el cambio de phones.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Función reusable para normalizar teléfonos (PG ≥ 12, IMMUTABLE).
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION normalize_phone(raw text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(raw, ''), '\D', '', 'g')) = 11
         AND substr(regexp_replace(coalesce(raw, ''), '\D', '', 'g'), 1, 1) = '1'
      THEN substr(regexp_replace(raw, '\D', '', 'g'), 2)
    ELSE regexp_replace(coalesce(raw, ''), '\D', '', 'g')
  END
$$;

COMMENT ON FUNCTION normalize_phone(text) IS
  'Normaliza un teléfono a dígitos US: si tiene 11 dígitos y empieza con 1, quita el 1. Si no, devuelve solo dígitos.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. Vínculo bidireccional contrato ↔ case (1:1).
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES cases(id) ON DELETE SET NULL;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_case_id ON contracts(case_id);
CREATE INDEX IF NOT EXISTS idx_cases_contract_id ON cases(contract_id);

COMMENT ON COLUMN contracts.case_id IS
  'Case asociado al contrato (1:1). Se setea cuando register-client crea el case.';
COMMENT ON COLUMN cases.contract_id IS
  'Contrato que originó el case (1:1). Cada contrato firmado genera un case nuevo.';

-- ─────────────────────────────────────────────────────────────────────
-- 3. Documentos asociados a un hijo (minor) específico del contrato.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS minor_index INTEGER,
  ADD COLUMN IF NOT EXISTS minor_label TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_minor
  ON documents(case_id, minor_index)
  WHERE minor_index IS NOT NULL;

COMMENT ON COLUMN documents.minor_index IS
  'Índice 0-based del hijo dentro de contracts.minors al que pertenece este doc. NULL = doc general (tutor, residencia, etc.) o legacy sin asignar.';
COMMENT ON COLUMN documents.minor_label IS
  'Snapshot del nombre del hijo al momento del upload. Denormalizado para no rebuscar el contrato al renderizar la card.';

-- ─────────────────────────────────────────────────────────────────────
-- 4. Catálogo: marcar tipos de documento que se renderizan por hijo.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE document_types
  ADD COLUMN IF NOT EXISTS is_per_minor BOOLEAN NOT NULL DEFAULT false;

UPDATE document_types
SET is_per_minor = true
WHERE code IN (
  'minor_id',
  'birth_certificates',
  'minor_birth_certificate',
  'minor_passport',
  'minor_national_id',
  'school_residence_proof',
  'i485_passport',
  'i485_birth_certificate',
  'i485_additional_id'
);

COMMENT ON COLUMN document_types.is_per_minor IS
  'true = la UI renderiza una card por cada minor del contrato (ej. acta de Emily, acta de Mateo).';

-- Migración M1 — Documentos por miembro de familia (Asilo Político).
-- Aplicada en producción 2026-05-14 via Supabase MCP.
--
-- A. contracts.spouse JSONB + contracts.asylum_family_type TEXT (con CHECK).
-- B. document_types.is_per_minor → renombrado a is_per_member; columna alias
--    is_per_minor (GENERATED) preserva compat con código no migrado.
-- C. documents.member_role TEXT con CHECK ('applicant','spouse','minor').
--    Backfill SIJS: docs con minor_index NOT NULL → member_role='minor'.
-- D. Marca docs Asilo Político como per-member (ID/pasaporte, I-94, NTA).

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS spouse JSONB,
  ADD COLUMN IF NOT EXISTS asylum_family_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_asylum_family_type_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_asylum_family_type_check
      CHECK (asylum_family_type IS NULL OR asylum_family_type IN
        ('individual','married','cohabiting_with_kids','novios'));
  END IF;
END$$;

COMMENT ON COLUMN public.contracts.spouse IS
  '{fullName,dob,birthplace,passport} del cónyuge/conviviente. NULL si individual/novios.';
COMMENT ON COLUMN public.contracts.asylum_family_type IS
  'Tipo de familia para Asilo Político. NULL = no aplica.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='document_types' AND column_name='is_per_minor'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='document_types' AND column_name='is_per_member'
  ) THEN
    ALTER TABLE public.document_types RENAME COLUMN is_per_minor TO is_per_member;
    ALTER TABLE public.document_types
      ADD COLUMN is_per_minor BOOLEAN GENERATED ALWAYS AS (is_per_member) STORED;
  END IF;
END$$;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS member_role TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_member_role_check'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_member_role_check
      CHECK (member_role IS NULL OR member_role IN ('applicant','spouse','minor'));
  END IF;
END$$;

UPDATE public.documents
SET member_role = 'minor'
WHERE minor_index IS NOT NULL AND member_role IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_member_role
  ON public.documents(case_id, member_role) WHERE member_role IS NOT NULL;

UPDATE public.document_types
SET is_per_member = true
WHERE code IN ('asylum_passport','asylum_id_card','asylum_i94','asylum_parole_nta');

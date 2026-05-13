-- ──────────────────────────────────────────────────────────────────
-- case_notes + appointments.session_number/objective_completed
--
-- Resuelve 4 bugs:
--   (1) Notas se sobrescriben (UPDATE appointments SET employee_notes=...)
--   (2) Diana no ve las notas de Vanessa (tab Notas solo lee henry_notes)
--   (3) Counter "Cita 1/2/3" siempre muestra "1ra cita" (Vanessa no podía
--       cambiar status; ahora la fuente de verdad es session_number explícito)
--   (4) Sin distinción entre "cita completada" y "objetivo logrado"
-- ──────────────────────────────────────────────────────────────────

-- Helper: trigger genérico para updated_at (no existía en el codebase)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- Tabla case_notes: una nota por row, append-only (soft-delete)
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.case_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  appointment_id    UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  author_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_role       TEXT NOT NULL CHECK (author_role IN ('admin','employee','system')),
  author_label      TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'general'
                      CHECK (category IN ('general','session','followup','internal','legacy')),
  body              TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 8000),
  visible_to_client BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS case_notes_case_created_idx
  ON public.case_notes(case_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS case_notes_appointment_idx
  ON public.case_notes(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS case_notes_author_idx
  ON public.case_notes(author_id) WHERE author_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_case_notes_updated_at ON public.case_notes;
CREATE TRIGGER trg_case_notes_updated_at
  BEFORE UPDATE ON public.case_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS para case_notes (staff lee/escribe propio; admin update/delete)
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view case notes" ON public.case_notes;
CREATE POLICY "Staff can view case notes" ON public.case_notes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin','employee'))
  );

DROP POLICY IF EXISTS "Staff can insert own notes" ON public.case_notes;
CREATE POLICY "Staff can insert own notes" ON public.case_notes
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role IN ('admin','employee'))
  );

DROP POLICY IF EXISTS "Author or admin can update" ON public.case_notes;
CREATE POLICY "Author or admin can update" ON public.case_notes
  FOR UPDATE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles
               WHERE id = auth.uid() AND role = 'admin')
  );

-- ──────────────────────────────────────────────────────────────────
-- appointments: columnas session_number + objective_completed
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS session_number INT NOT NULL DEFAULT 1 CHECK (session_number >= 1),
  ADD COLUMN IF NOT EXISTS objective_completed BOOLEAN;

CREATE INDEX IF NOT EXISTS appointments_case_session_idx
  ON public.appointments(case_id, session_number) WHERE case_id IS NOT NULL;

COMMENT ON COLUMN public.appointments.session_number IS
  'Sesión de Fase 1 Custodia (1, 2, 3...). Asignado por trigger al INSERT según historial del caso.';
COMMENT ON COLUMN public.appointments.objective_completed IS
  'NULL mientras la cita está scheduled. true = objetivo logrado (avanza sesión). false = quedó pendiente (siguiente cita mantiene número).';

-- Trigger: asigna session_number al INSERT según historial del case
CREATE OR REPLACE FUNCTION public.set_appointment_session_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.case_id IS NULL THEN
    NEW.session_number := 1;
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX(
    CASE
      WHEN status='completed' AND objective_completed = true THEN session_number + 1
      ELSE session_number
    END
  ), 1)
  INTO NEW.session_number
  FROM public.appointments WHERE case_id = NEW.case_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_session_number ON public.appointments;
CREATE TRIGGER trg_set_session_number
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_appointment_session_number();

-- ──────────────────────────────────────────────────────────────────
-- Backfill: notas legacy + session_number retroactivo
-- ──────────────────────────────────────────────────────────────────

-- (a) appointments.employee_notes legacy → case_notes
INSERT INTO public.case_notes (case_id, appointment_id, author_role, author_label,
                                category, body, created_at, updated_at)
SELECT a.case_id, a.id, 'system', 'Sistema (migrado de employee_notes)',
       'legacy', a.employee_notes, COALESCE(a.updated_at, a.created_at, now()),
       COALESCE(a.updated_at, a.created_at, now())
FROM public.appointments a
WHERE a.case_id IS NOT NULL
  AND a.employee_notes IS NOT NULL AND length(trim(a.employee_notes)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.case_notes cn
    WHERE cn.appointment_id = a.id AND cn.category = 'legacy'
  );

-- (b) appointments.notes (Henry/voice-agent) legacy
INSERT INTO public.case_notes (case_id, appointment_id, author_role, author_label,
                                category, body, created_at, updated_at)
SELECT a.case_id, a.id, 'system', 'Sistema (migrado de notes)',
       'legacy', a.notes, COALESCE(a.updated_at, a.created_at, now()),
       COALESCE(a.updated_at, a.created_at, now())
FROM public.appointments a
WHERE a.case_id IS NOT NULL
  AND a.notes IS NOT NULL AND length(trim(a.notes)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.case_notes cn
    WHERE cn.appointment_id = a.id AND cn.category = 'legacy' AND cn.body = a.notes
  );

-- (c) cases.henry_notes legacy (hoy 0 filas)
INSERT INTO public.case_notes (case_id, author_role, author_label, category, body,
                                created_at, updated_at)
SELECT c.id, 'admin', 'Henry (legacy)', 'legacy', c.henry_notes,
       COALESCE(c.updated_at, now()), COALESCE(c.updated_at, now())
FROM public.cases c
WHERE c.henry_notes IS NOT NULL AND length(trim(c.henry_notes)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.case_notes cn
    WHERE cn.case_id = c.id AND cn.category = 'legacy' AND cn.appointment_id IS NULL
  );

-- (d) session_number retroactivo solo para Visa Juvenil
WITH ranked AS (
  SELECT a.id, ROW_NUMBER() OVER (
    PARTITION BY a.case_id ORDER BY a.scheduled_at ASC
  )::INT AS rn
  FROM public.appointments a
  JOIN public.cases c ON c.id = a.case_id
  JOIN public.service_catalog s ON s.id = c.service_id
  WHERE s.slug = 'visa-juvenil' AND a.status IN ('scheduled','completed')
)
UPDATE public.appointments a
SET session_number = r.rn
FROM ranked r WHERE a.id = r.id AND a.session_number <> r.rn;

-- Deprecation comments (NO drop hasta migración separada en 2 semanas)
COMMENT ON COLUMN public.appointments.employee_notes IS
  'DEPRECATED 2026-05-13 — usar case_notes. Drop en migración 20260527.';
COMMENT ON COLUMN public.appointments.consultant_notes IS
  'DEPRECATED 2026-05-13 — usar case_notes. Drop en migración 20260527.';
COMMENT ON COLUMN public.appointments.notes IS
  'DEPRECATED 2026-05-13 — usar case_notes. Drop en migración 20260527.';
COMMENT ON COLUMN public.cases.henry_notes IS
  'DEPRECATED 2026-05-13 — usar case_notes. Drop en migración 20260527.';

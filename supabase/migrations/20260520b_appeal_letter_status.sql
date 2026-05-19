-- Migrar case_appeal_letter_drafts a modelo async con status tracking.
-- El flujo nuevo es: insert fila pending → encolar QStash → worker actualiza.
-- Necesario porque la generación con Claude + 4 PDFs nativos toma 60-150s,
-- excediendo el límite de 120s de Vercel Hobby/Pro estándar.

ALTER TABLE public.case_appeal_letter_drafts
  ALTER COLUMN body_md SET DEFAULT '';

ALTER TABLE public.case_appeal_letter_drafts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready';

ALTER TABLE public.case_appeal_letter_drafts
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.case_appeal_letter_drafts
  ADD COLUMN IF NOT EXISTS job_started_at TIMESTAMPTZ;

ALTER TABLE public.case_appeal_letter_drafts
  ADD COLUMN IF NOT EXISTS job_finished_at TIMESTAMPTZ;

ALTER TABLE public.case_appeal_letter_drafts
  DROP CONSTRAINT IF EXISTS case_appeal_letter_drafts_status_check;
ALTER TABLE public.case_appeal_letter_drafts
  ADD CONSTRAINT case_appeal_letter_drafts_status_check
  CHECK (status IN ('pending', 'generating', 'ready', 'failed'));

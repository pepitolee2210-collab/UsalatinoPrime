-- ──────────────────────────────────────────────────────────────────
-- Bitácora: extender case_activity para timeline rico por caso
--
-- Reutiliza la tabla case_activity existente añadiendo:
--   * event_category    — categoría de alto nivel para filtros
--   * event_subcategory — subcategoría granular tipo `{category}.{verb}`
--   * actor_role        — denormalizado (actor_id puede ser NULL en
--                         flujos token-based o eventos del sistema)
--   * actor_label       — snapshot legible del nombre del actor
--
-- También arregla el bug pre-existente: NO había policies de RLS para
-- empleados (Diana, Vanessa, Andrium) — solo admin y client.
-- Esa omisión explica por qué la tabla está casi vacía hoy.
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.case_activity
  ADD COLUMN IF NOT EXISTS event_category    text,
  ADD COLUMN IF NOT EXISTS event_subcategory text,
  ADD COLUMN IF NOT EXISTS actor_role        text,
  ADD COLUMN IF NOT EXISTS actor_label       text;

-- CHECK constraints (sin NOT NULL: preservar las 65 filas legacy con NULL).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'case_activity_event_category_check') THEN
    ALTER TABLE public.case_activity
      ADD CONSTRAINT case_activity_event_category_check
      CHECK (event_category IS NULL OR event_category IN (
        'case','contract','appointment','document','form','payment','system','communication'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'case_activity_actor_role_check') THEN
    ALTER TABLE public.case_activity
      ADD CONSTRAINT case_activity_actor_role_check
      CHECK (actor_role IS NULL OR actor_role IN ('admin','employee','client','system'));
  END IF;
END $$;

-- Índices: el viejo (case_id solo) queda cubierto por el compuesto.
DROP INDEX IF EXISTS public.idx_case_activity_case_id;
CREATE INDEX IF NOT EXISTS case_activity_case_created_idx
  ON public.case_activity(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS case_activity_category_idx
  ON public.case_activity(event_category) WHERE event_category IS NOT NULL;

-- RLS: agregar policies para employees (admin y client ya existen).
DROP POLICY IF EXISTS "Employees can view all case activity" ON public.case_activity;
CREATE POLICY "Employees can view all case activity" ON public.case_activity
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'employee')
  );

DROP POLICY IF EXISTS "Employees can insert activity" ON public.case_activity;
CREATE POLICY "Employees can insert activity" ON public.case_activity
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'employee')
    AND actor_id = auth.uid()
  );

COMMENT ON COLUMN public.case_activity.event_category    IS 'Categoría de alto nivel para filtros de bitácora.';
COMMENT ON COLUMN public.case_activity.event_subcategory IS 'Subcategoría: `{category}.{verb}` (ej: contract.signed).';
COMMENT ON COLUMN public.case_activity.actor_role        IS 'Rol del actor en el momento del evento (denormalizado: actor_id puede ser NULL para flujos token-based).';
COMMENT ON COLUMN public.case_activity.actor_label       IS 'Snapshot del nombre legible del actor — sobrevive si el profile se borra.';

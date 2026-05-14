-- ──────────────────────────────────────────────────────────────────
-- Notas: simplificar a 2 categorías user-facing + agregar is_pinned
--
-- Antes: 5 categorías (general/session/followup/internal/legacy) donde
-- followup e internal eran labels sin comportamiento real, confundiendo
-- al usuario.
--
-- Ahora: 3 categorías (general/session/legacy) donde:
--   - general = default
--   - session = nota auto-vinculada a un appointment (categoría derivada)
--   - legacy = backfill, no editable
-- Más una columna is_pinned para destacar notas importantes (ortogonal a
-- la categoría).
-- ──────────────────────────────────────────────────────────────────

-- 1. Reabsorber categorías huérfanas a 'general' antes de cambiar el CHECK
UPDATE public.case_notes
SET category = 'general'
WHERE category IN ('followup', 'internal');

-- 2. Reemplazar CHECK constraint
ALTER TABLE public.case_notes
  DROP CONSTRAINT IF EXISTS case_notes_category_check;
ALTER TABLE public.case_notes
  ADD CONSTRAINT case_notes_category_check
  CHECK (category IN ('general','session','legacy'));

-- 3. Nueva columna is_pinned
ALTER TABLE public.case_notes
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- 4. Índice parcial: solo notas fijadas (búsqueda super eficiente)
CREATE INDEX IF NOT EXISTS case_notes_pinned_idx
  ON public.case_notes(case_id, created_at DESC)
  WHERE is_pinned = true AND deleted_at IS NULL;

COMMENT ON COLUMN public.case_notes.is_pinned IS
  'Nota fijada: aparece en sección destacada arriba del feed, ignorando filtros.';

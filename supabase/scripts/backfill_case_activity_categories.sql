-- Backfill case_activity event_category / event_subcategory
--
-- Script one-off (no migración) idempotente: mapea filas legacy con
-- event_category IS NULL a categorías derivadas del campo `action`.
-- Solo afecta filas que aún no tienen categoría asignada.
--
-- Aplicar después de la migración 20260512_case_activity_bitacora.
-- Verificar al final con el SELECT incluido.

UPDATE public.case_activity
SET event_category = 'form',
    event_subcategory = 'form.pdf_generated',
    actor_role = COALESCE(actor_role, 'admin')
WHERE event_category IS NULL AND action LIKE '%_pdf_generated';

UPDATE public.case_activity
SET event_category = 'case',
    event_subcategory = 'case.created',
    actor_role = COALESCE(actor_role, 'system')
WHERE event_category IS NULL AND action = 'case_created';

UPDATE public.case_activity
SET event_category = 'case',
    event_subcategory = 'case.status_changed',
    actor_role = COALESCE(actor_role, 'admin')
WHERE event_category IS NULL AND action = 'status_change';

UPDATE public.case_activity
SET event_category = 'system',
    event_subcategory = 'system.access_toggled',
    actor_role = COALESCE(actor_role, 'admin')
WHERE event_category IS NULL AND action = 'access_change';

-- Verificación: distribución final por categoría.
SELECT event_category, event_subcategory, COUNT(*) AS n
FROM public.case_activity
GROUP BY event_category, event_subcategory
ORDER BY n DESC;

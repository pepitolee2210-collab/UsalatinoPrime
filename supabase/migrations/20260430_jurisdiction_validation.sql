-- Endurece la validación de la investigación de jurisdicción SIJS:
-- 1. Permite un nuevo estado 'incomplete' para casos que pasaron por la IA
--    pero quedaron con familias core SIJS faltantes (GF-42, Motion, etc.).
--    Esto es distinto de 'failed' (la IA crasheó) y de 'completed' (todo OK).
-- 2. Agrega columna research_warnings (JSONB) con la lista de familias
--    SIJCoreFamily que faltaron, para que la UI las muestre.
-- 3. Marca como 'failed' los casos SIJS legacy que se cachearon con cobertura
--    incompleta — fuerza al admin a hacer "Re-verificar" para regenerarlos
--    bajo la nueva lógica con retry validado.

-- Paso 1: ampliar el CHECK constraint para aceptar 'incomplete'.
ALTER TABLE public.case_jurisdictions
  DROP CONSTRAINT IF EXISTS case_jurisdictions_research_status_check;

ALTER TABLE public.case_jurisdictions
  ADD CONSTRAINT case_jurisdictions_research_status_check
  CHECK (research_status IN ('pending', 'completed', 'incomplete', 'failed'));

COMMENT ON COLUMN public.case_jurisdictions.research_status
  IS 'Estado del research. pending=en curso, completed=todas las familias SIJS core encontradas, incomplete=faltan familias tras retry validado (ver research_warnings), failed=error en la IA o sin ubicación.';

-- Paso 2: nueva columna research_warnings (lista de SIJCoreFamily faltantes).
ALTER TABLE public.case_jurisdictions
  ADD COLUMN IF NOT EXISTS research_warnings JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.case_jurisdictions.research_warnings
  IS 'Array de SIJCoreFamily ausentes en la investigación (ej. ["sij_proposed_order_with_findings","sij_motion_or_request"]). Vacío cuando research_status=completed. Usado por la UI admin para badges informativos.';

CREATE INDEX IF NOT EXISTS idx_case_jurisdictions_research_warnings
  ON public.case_jurisdictions ((jsonb_array_length(research_warnings)))
  WHERE jsonb_array_length(research_warnings) > 0;

-- Paso 3: marcar como 'failed' los casos SIJS legacy con investigación
-- evidentemente incompleta. Filtra por servicio (slug='visa-juvenil') para no
-- afectar otros servicios. La regex detecta ausencia de cualquier "Special
-- Findings", "SIJS Order", "GF-42" o "Motion for SIJ"/"SIJ findings" en el
-- jsonb required_forms.
--
-- Política: al ejecutar "Re-verificar" en el panel admin, el endpoint
-- POST /api/admin/case-jurisdiction { force: true } limpiará y volverá a
-- correr la investigación con la nueva lógica (prompt endurecido + retry
-- validado + reglas estrictas por estado).
--
-- IMPORTANTE: solo cambia el status — los datos cacheados quedan en su
-- lugar para que el admin pueda compararlos contra lo que la IA retorne en
-- el próximo intento.

UPDATE public.case_jurisdictions cj
SET research_status = 'failed',
    research_error = 'Investigación legacy incompleta — re-verificar para incluir Special Findings Order, Motion for SIJ Findings y Affidavit en apoyo. Sin estos formularios USCIS rechaza el I-360.',
    research_warnings = '["sij_proposed_order_with_findings","sij_motion_or_request","sij_affirmation_or_affidavit"]'::jsonb,
    updated_at = now()
FROM public.cases c
JOIN public.service_catalog sc ON sc.id = c.service_id
WHERE cj.case_id = c.id
  AND sc.slug = 'visa-juvenil'
  AND cj.research_status = 'completed'
  AND NOT (
    cj.required_forms::text ~* '(special findings|sijs?\s+order|gf-?\s*42|motion.*(findings|sij)|2019_order_sij|order regarding sij)'
  );

-- No agregamos NOTIFY ni triggers — el frontend ya pollea/refresca cuando el
-- admin entra al panel del caso, así que ve el nuevo status automáticamente.

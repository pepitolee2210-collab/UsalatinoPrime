-- Soporte para múltiples bloques horarios por día en la agenda de consultoras.
-- Vanessa pidió poder configurar agenda partida (ej. 9-12, 15-18, 20-21).
-- Hasta ahora cada (consultant_id, day_of_week) era un solo rango start_hour-end_hour.
-- Ahora time_blocks JSONB array permite N bloques.
--
-- Compatibilidad: si time_blocks está vacío/null se usa el rango legacy.
-- /api/voice-agent/slots ya soporta este patrón porque getAvailableSlots()
-- acepta time_blocks (lo usa scheduling_config de Henry).

ALTER TABLE public.consultant_availability
  ADD COLUMN IF NOT EXISTS time_blocks JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.consultant_availability.time_blocks IS
  'Array de bloques horarios: [{"start_hour":9,"end_hour":12},{"start_hour":15,"end_hour":18}]. Si está vacío, se usa el rango legacy start_hour/end_hour como bloque único.';

-- Backfill: convertir el rango legacy de filas existentes en time_blocks de 1 elemento
UPDATE public.consultant_availability
SET time_blocks = jsonb_build_array(jsonb_build_object('start_hour', start_hour, 'end_hour', end_hour))
WHERE time_blocks = '[]'::jsonb OR time_blocks IS NULL;

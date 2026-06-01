-- ════════════════════════════════════════════════════════════════════
-- contracts.created_by — rastro de quién creó cada contrato
-- ════════════════════════════════════════════════════════════════════
--
-- CONTEXTO
-- Andrium (contracts_manager) y Henry (admin) ya ven TODOS los contratos
-- en su lista — comparten la tabla `contracts` y el componente ContratosView,
-- y sus políticas RLS leen la tabla completa. Pero la tabla solo guardaba
-- `created_at`, no QUIÉN creó cada contrato. Andrium pidió poder distinguir
-- visualmente los contratos creados por Vanessa.
--
-- FIX
-- - created_by      → FK al profile del autor (integridad / queries futuras).
-- - created_by_name → snapshot del nombre del autor al momento de crear.
--   Se denormaliza (como minor_label, member_label) para que la lista no
--   dependa de un JOIN a profiles con su RLS — el chip "Por Vanessa" se
--   pinta directo desde la fila del contrato.
--
-- Filas históricas quedan con NULL (no sabemos quién las creó) — la UI
-- simplemente no muestra chip cuando created_by_name es NULL.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_name TEXT;

COMMENT ON COLUMN public.contracts.created_by IS
  'Profile del usuario (admin/employee) que creó el contrato. NULL en filas históricas.';
COMMENT ON COLUMN public.contracts.created_by_name IS
  'Snapshot del nombre del autor al crear. Denormalizado para evitar JOIN a profiles en la lista.';

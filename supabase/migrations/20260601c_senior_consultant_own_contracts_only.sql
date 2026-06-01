-- ════════════════════════════════════════════════════════════════════
-- Senior Consultant (Vanessa) — SOLO sus propios contratos
-- ════════════════════════════════════════════════════════════════════
--
-- CONTEXTO / CORRECCIÓN
-- La migración 20260601_senior_consultant_contracts_rls le dio a Vanessa
-- acceso COMPLETO a la tabla contracts (igual que contracts_manager), lo que
-- la dejaba ver TODOS los contratos — incluidos los de Henry y Andrium.
--
-- Henry aclaró la regla real: Vanessa NO debe ver lo que hacen Henry ni
-- Andrium. Solo sus propios contratos. (Henry y Andrium sí siguen viendo
-- todo, incluidos los de Vanessa con el chip "POR VANESSA".)
--
-- FIX
-- Reemplazamos la política full-access por una acotada a sus propias filas:
-- created_by = auth.uid(). Esto aplica a SELECT/UPDATE/DELETE (USING) y al
-- INSERT/UPDATE (WITH CHECK) — es decir:
--   - Solo VE contratos que ella creó.
--   - Solo puede EDITAR/BORRAR los suyos.
--   - Al CREAR, la fila queda obligatoriamente atribuida a ella
--     (created_by = su id, que es justo lo que setea el formulario).
--
-- Las políticas de admin (Henry) y contracts_manager (Andrium) NO se tocan:
-- ellos siguen con acceso full-table.
-- ════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Senior consultant full access on contracts" ON public.contracts;
DROP POLICY IF EXISTS "Senior consultant own contracts" ON public.contracts;

CREATE POLICY "Senior consultant own contracts"
ON public.contracts
FOR ALL
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'employee'
      AND profiles.employee_type = 'senior_consultant'
  )
)
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'employee'
      AND profiles.employee_type = 'senior_consultant'
  )
);

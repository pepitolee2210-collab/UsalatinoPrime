-- ════════════════════════════════════════════════════════════════════
-- Vanessa (senior_consultant) — ve los contratos creados DE AHORA EN ADELANTE
-- ════════════════════════════════════════════════════════════════════
--
-- CONTEXTO / NUEVA REGLA
-- Antes: Vanessa solo veía SUS propios contratos.
-- Ahora Henry pidió: Vanessa debe ver también los contratos que Henry o
-- Andrium creen DE AHORA EN ADELANTE — pero NO los históricos.
--
-- MARCADOR "de ahora en adelante" = created_by IS NOT NULL.
--   - Contratos históricos (antes del feature de hoy) → created_by NULL.
--   - Contratos nuevos (código ya desplegado lo setea) → created_by con valor.
-- Por eso created_by IS NOT NULL distingue exactamente "creados desde que
-- existe el rastro de autor" sin depender de un timestamp fijo.
--
-- PERMISOS RESULTANTES PARA VANESSA
--   - VE (SELECT): cualquier contrato con created_by (suyos + de Henry/Andrium
--     creados desde ahora). Los históricos (NULL) quedan ocultos.
--   - CREA / EDITA / BORRA: SOLO los suyos (created_by = auth.uid()).
--     Los de otros los ve en modo lectura.
--
-- Henry (admin) y Andrium (contracts_manager) NO se tocan — ven todo.
-- ════════════════════════════════════════════════════════════════════

-- Quitar la política anterior (acceso solo-a-lo-propio) y las previas.
DROP POLICY IF EXISTS "Senior consultant own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Senior consultant full access on contracts" ON public.contracts;
DROP POLICY IF EXISTS "Senior consultant select recent contracts" ON public.contracts;
DROP POLICY IF EXISTS "Senior consultant insert own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Senior consultant update own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Senior consultant delete own contracts" ON public.contracts;

-- Helper inline reusado en cada política.
-- (EXISTS sobre profiles, mismo patrón que admin/contracts_manager.)

-- 1) LEER: suyos + cualquiera creado de ahora en adelante (created_by no nulo).
CREATE POLICY "Senior consultant select recent contracts"
ON public.contracts
FOR SELECT
USING (
  created_by IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'employee'
      AND profiles.employee_type = 'senior_consultant'
  )
);

-- 2) CREAR: solo atribuyéndose a sí misma.
CREATE POLICY "Senior consultant insert own contracts"
ON public.contracts
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'employee'
      AND profiles.employee_type = 'senior_consultant'
  )
);

-- 3) EDITAR: solo los suyos.
CREATE POLICY "Senior consultant update own contracts"
ON public.contracts
FOR UPDATE
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

-- 4) BORRAR: solo los suyos.
CREATE POLICY "Senior consultant delete own contracts"
ON public.contracts
FOR DELETE
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'employee'
      AND profiles.employee_type = 'senior_consultant'
  )
);

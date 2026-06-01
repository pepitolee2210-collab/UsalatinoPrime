-- ════════════════════════════════════════════════════════════════════
-- Senior Consultant (Vanessa) — acceso RLS a contracts
-- ════════════════════════════════════════════════════════════════════
--
-- CONTEXTO
-- La tabla `contracts` tiene RLS activo con SOLO dos políticas:
--   1. "Admin full access on contracts"             → role = 'admin' (Henry)
--   2. "Contracts manager full access on contracts" → employee_type =
--      'contracts_manager' (Andrium)
--
-- El formulario QuickContractGenerator inserta el contrato con el CLIENTE
-- DE NAVEGADOR (anon key + sesión del usuario), por lo que el INSERT pasa
-- por RLS. Cuando Vanessa (employee_type='senior_consultant') intentaba
-- crear un contrato — directamente o vía el agente de voz Lex — la base de
-- datos lo bloqueaba ("new row violates row-level security policy for table
-- contracts"). Lo mismo aplicaba a SELECT/UPDATE/DELETE desde la UI.
--
-- Esto completa la decisión "Opción C" (senior_consultant == contracts_manager
-- para la sección de contratos) que ya se aplicó en la capa de app
-- (employee/contratos/page.tsx, endpoints /api/contracts/*). Faltaba la capa
-- de base de datos.
--
-- FIX
-- Política ALL que da a senior_consultant el mismo acceso completo a
-- `contracts` que ya tiene contracts_manager — insert, select, update y
-- delete. Misma forma (EXISTS sobre profiles) que las dos políticas
-- existentes, por consistencia.
-- ════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Senior consultant full access on contracts" ON public.contracts;

CREATE POLICY "Senior consultant full access on contracts"
ON public.contracts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'employee'
      AND profiles.employee_type = 'senior_consultant'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'employee'
      AND profiles.employee_type = 'senior_consultant'
  )
);

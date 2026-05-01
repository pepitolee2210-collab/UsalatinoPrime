-- ══════════════════════════════════════════════════════════════════
-- Permitir a empleados (paralegals) UPDATE en case_form_submissions
--
-- Diana (employee/paralegal) ya puede SELECT (policy creada en
-- 20260312_submissions_admin_rls.sql). Esta policy le permite
-- también UPDATE para que pueda editar el I-360 del cliente
-- directamente desde su portal admin sin esperar asignación de
-- Henry.
--
-- El endpoint /api/admin/cases/[id]/i360-form usa createServiceClient
-- (bypass RLS) por lo que esta policy es defensa-en-profundidad.
-- ══════════════════════════════════════════════════════════════════

CREATE POLICY "Employees can update submissions"
  ON public.case_form_submissions
  FOR UPDATE
  USING (public.is_employee())
  WITH CHECK (public.is_employee());

-- ============================================================
-- 018_appointment_penalty_waived.sql
-- Permite a Henry levantar la penalizacion de un cliente
-- para que pueda reagendar su cita.
-- ============================================================

ALTER TABLE appointments
  ADD COLUMN penalty_waived BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN appointments.penalty_waived IS
  'Cuando true, esta cita cancelada/no_show NO genera penalizacion al cliente';

-- Renombra los títulos públicos del equipo para alinear con los Términos y
-- Condiciones: la firma NO es un bufete y NO da asesoría legal, así que Diana y
-- Vanessa ya NO se muestran como "Asesora Legal". Términos precisos:
--   Diana   → Tramitadora      Vanessa → Asesora      Andrium → Coordinador
--
-- Esto cubre los contactos client-facing (quick_contacts). El título por
-- employee_type (incluido Andrium → Coordinador) vive en código en
-- src/lib/team/roles.ts (fuente única para los dashboards de empleados).
--
-- Aplicada en producción 2026-06-05 via Supabase MCP. Idempotente.

UPDATE public.quick_contacts SET role = 'Tramitadora' WHERE name = 'Diana';
UPDATE public.quick_contacts SET role = 'Asesora'     WHERE name = 'Vanessa';

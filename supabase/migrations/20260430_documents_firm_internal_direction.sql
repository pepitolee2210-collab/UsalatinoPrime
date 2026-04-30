-- ══════════════════════════════════════════════════════════════════
-- Permite documentos internos de la firma (no entregados al cliente).
--
-- Añade el valor 'firm_internal' al CHECK de documents.direction
-- para soportar la pestaña "Documentos archivados" del portal del
-- paralegal. Estos documentos NO son visibles para el cliente: los
-- endpoints /api/cita/[token]/* ya filtran por direction explícito
-- ('client_to_admin' o 'admin_to_client'), así que firm_internal
-- queda automáticamente fuera del alcance del cliente sin más cambios.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_direction_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_direction_check
  CHECK (direction IN ('client_to_admin', 'admin_to_client', 'firm_internal'));

COMMENT ON COLUMN public.documents.direction IS
  'client_to_admin = subido por cliente o por paralegal en su nombre. admin_to_client = entregable al cliente. firm_internal = expediente interno de la firma, no visible para el cliente.';

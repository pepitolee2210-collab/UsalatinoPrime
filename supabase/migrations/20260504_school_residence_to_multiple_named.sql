-- Convierte "Prueba de residencia escolar" (id=68) de slot_kind='single' a
-- 'multiple_named' (max_slots=10) en fase 1 (custodia). El cliente con
-- varios hijos puede subir múltiples comprobantes con subtítulo custom
-- (ej. "Juan Pérez — informe escolar", "María Pérez — boletín").
--
-- Reusa la UI existente DocumentCardMultiple (modal "Nombre del archivo"
-- + botón "Añadir archivo"). Cero código nuevo.
--
-- Uploads existentes con slot_label=NULL se renombran a 'Original' para
-- que la UI multiple_named los muestre con etiqueta legible.

UPDATE document_types
SET slot_kind = 'multiple_named',
    max_slots = 10
WHERE code = 'school_residence_proof';

UPDATE documents
SET slot_label = 'Original'
WHERE document_type_id = (
        SELECT id FROM document_types WHERE code = 'school_residence_proof'
      )
  AND direction = 'client_to_admin'
  AND slot_label IS NULL;

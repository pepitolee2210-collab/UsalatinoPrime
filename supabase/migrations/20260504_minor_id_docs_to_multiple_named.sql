-- Convierte los documentos de identidad del menor de slot_kind='dual_es_en'
-- a 'multiple_named' (max_slots=10), para que un mismo case con varios hijos
-- pueda subir múltiples archivos por hijo con subtítulo custom (ej. "Juan
-- Pérez — acta", "María Pérez — acta"). El portal del cliente reusa
-- DocumentCardMultiple, que ya muestra modal de "Nombre del archivo" y botón
-- "Añadir archivo".
--
-- Aplicable a:
--   minor_birth_certificate (id=1) — visible custodia/i360/i485
--   minor_passport          (id=2) — visible custodia/i360
--   minor_national_id       (id=3) — visible custodia
--
-- Los uploads existentes con slot_label='es'/'en'/NULL se renombran a
-- 'Original'/'Traducción' para que la UI agrupada multiple_named los muestre
-- con etiquetas legibles en lugar de los códigos internos.

UPDATE document_types
SET slot_kind = 'multiple_named',
    max_slots = 10
WHERE code IN ('minor_birth_certificate', 'minor_passport', 'minor_national_id');

UPDATE documents
SET slot_label = 'Original'
WHERE document_type_id IN (
        SELECT id FROM document_types
        WHERE code IN ('minor_birth_certificate', 'minor_passport', 'minor_national_id')
      )
  AND direction = 'client_to_admin'
  AND (slot_label = 'es' OR slot_label IS NULL);

UPDATE documents
SET slot_label = 'Traducción'
WHERE document_type_id IN (
        SELECT id FROM document_types
        WHERE code IN ('minor_birth_certificate', 'minor_passport', 'minor_national_id')
      )
  AND direction = 'client_to_admin'
  AND slot_label = 'en';

-- Backfill: profiles.country_of_birth ← case_form_instances.m2_country_of_birth
--
-- One-shot idempotente. Para cada cliente con un cuestionario de Miedo Creíble
-- (`form_name = 'asilo_miedo_creible_cuestionario'`) que contenga
-- `m2_country_of_birth` poblado, copia el valor (trim + initcap) al perfil del
-- cliente *solo si* `profiles.country_of_birth` está NULL o vacío. Nunca
-- sobreescribe un valor ya presente. Re-runnable.
--
-- Caso disparador: Karelis Contreras Galicia (Venezuela) — su profile estaba
-- en NULL aunque el M2 estaba completo. El endpoint generate-credible-fear
-- validaba el profile antes de leer M2 y abortaba con
-- "No se conoce el país de origen del solicitante".
--
-- Slug fuente: `CREDIBLE_FEAR_QUESTIONNAIRE_SLUG` en
-- src/lib/legal/asilo-miedo-creible-form-schema.ts:18.

-- Antes de ejecutar el UPDATE, ejecutar este SELECT para conocer el alcance:
--
--   SELECT
--     p.id,
--     p.first_name,
--     p.last_name,
--     p.country_of_birth        AS current_value,
--     initcap(trim(sub.country)) AS would_become
--   FROM profiles p
--   JOIN (
--     SELECT DISTINCT ON (c.client_id)
--       c.client_id,
--       cfi.filled_values->>'m2_country_of_birth' AS country,
--       cfi.updated_at
--     FROM cases c
--     JOIN case_form_instances cfi ON cfi.case_id = c.id
--     WHERE cfi.form_name = 'asilo_miedo_creible_cuestionario'
--       AND cfi.filled_values->>'m2_country_of_birth' IS NOT NULL
--       AND trim(cfi.filled_values->>'m2_country_of_birth') <> ''
--       AND c.client_id IS NOT NULL
--     ORDER BY c.client_id, cfi.updated_at DESC
--   ) sub ON p.id = sub.client_id
--   WHERE (p.country_of_birth IS NULL OR trim(p.country_of_birth) = '');

BEGIN;

UPDATE profiles p
SET
  country_of_birth = initcap(trim(sub.country)),
  updated_at = now()
FROM (
  SELECT DISTINCT ON (c.client_id)
    c.client_id,
    cfi.filled_values->>'m2_country_of_birth' AS country,
    cfi.updated_at
  FROM cases c
  JOIN case_form_instances cfi ON cfi.case_id = c.id
  WHERE cfi.form_name = 'asilo_miedo_creible_cuestionario'
    AND cfi.filled_values->>'m2_country_of_birth' IS NOT NULL
    AND trim(cfi.filled_values->>'m2_country_of_birth') <> ''
    AND c.client_id IS NOT NULL
  ORDER BY c.client_id, cfi.updated_at DESC
) sub
WHERE p.id = sub.client_id
  AND (p.country_of_birth IS NULL OR trim(p.country_of_birth) = '');

COMMIT;

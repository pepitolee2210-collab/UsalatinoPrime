-- 20260508 — UNIQUE constraint sobre teléfono normalizado.
--
-- Se aplica DESPUÉS de la reconciliación de Jose Luis (script
-- reconcile_jose_luis_criollo.sql), una vez verificado que no hay
-- duplicados de phone normalizado entre clientes activos.
--
-- Verificar antes con:
--   SELECT normalize_phone(phone) AS np, COUNT(*)
--   FROM profiles WHERE role='client' AND phone IS NOT NULL
--     AND length(normalize_phone(phone)) BETWEEN 7 AND 15
--   GROUP BY np HAVING COUNT(*) > 1;
-- Esperado: 0 filas.

CREATE UNIQUE INDEX IF NOT EXISTS profiles_normalized_phone_unique
  ON profiles ((normalize_phone(phone)))
  WHERE phone IS NOT NULL
    AND length(normalize_phone(phone)) BETWEEN 7 AND 15
    AND role = 'client';

COMMENT ON INDEX profiles_normalized_phone_unique IS
  'Garantiza que un teléfono normalizado mapee a un único profile cliente. /register y register-client deben revisar antes de insertar.';

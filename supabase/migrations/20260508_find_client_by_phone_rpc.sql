-- 20260508 — RPC find_client_by_phone(text).
--
-- Devuelve el profile cliente cuyo teléfono normalizado coincide.
-- Es la ÚNICA forma correcta de identificar un cliente: usar email o
-- passport como fallback fue lo que generó el desastre de Jose Luis.

CREATE OR REPLACE FUNCTION find_client_by_phone(p_phone text)
RETURNS TABLE (id uuid, first_name text, last_name text, phone text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, first_name, last_name, phone, email
  FROM profiles
  WHERE role = 'client'
    AND phone IS NOT NULL
    AND normalize_phone(phone) = normalize_phone(p_phone)
    AND length(normalize_phone(p_phone)) BETWEEN 7 AND 15
  ORDER BY created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION find_client_by_phone(text) IS
  'Devuelve el profile cliente que coincide con el teléfono normalizado, o vacío. Es la única forma correcta de identificar a un cliente — no usar email ni passport.';

GRANT EXECUTE ON FUNCTION find_client_by_phone(text) TO authenticated, service_role;

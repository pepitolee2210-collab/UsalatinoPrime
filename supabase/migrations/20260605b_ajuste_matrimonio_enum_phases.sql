-- Servicio nuevo "Ajuste de Estatus por Matrimonio": fases propias.
-- Migración SEPARADA del seed (20260605c): un ADD VALUE de enum no es usable en
-- la misma transacción que lo crea (limitación de Postgres). Aplicar esta antes.
ALTER TYPE public.case_phase ADD VALUE IF NOT EXISTS 'matrimonio_i130';
ALTER TYPE public.case_phase ADD VALUE IF NOT EXISTS 'matrimonio_i485';

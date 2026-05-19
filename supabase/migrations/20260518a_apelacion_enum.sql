-- Apelación: parte A — agrega el valor 'apelacion' al enum case_phase.
--
-- Se separa del seed (parte B) porque PostgreSQL no permite usar un valor
-- de enum recién agregado dentro de la MISMA transacción donde se hace el
-- ALTER TYPE. Esta migración debe COMMITear antes que la B pueda referenciar
-- 'apelacion' en sus INSERTs.
--
-- Aplicada via Supabase MCP el 2026-05-18. Esta copia vive en el repo solo
-- como reflejo del estado real.

ALTER TYPE public.case_phase ADD VALUE IF NOT EXISTS 'apelacion';

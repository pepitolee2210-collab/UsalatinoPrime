-- Cambio de Corte: agrega el valor 'cambio_de_corte' al enum case_phase.
--
-- Se separa de cualquier seed/uso del valor porque PostgreSQL no permite usar
-- un valor de enum recién agregado dentro de la MISMA transacción donde se
-- hace el ALTER TYPE. Esta migración debe COMMITear antes que cualquier
-- migración o INSERT referencie 'cambio_de_corte'.
--
-- Servicio de UNA sola fase (`cambio_de_corte`), patrón espejo de 'apelacion'
-- (migración 20260518a_apelacion_enum.sql).

ALTER TYPE public.case_phase ADD VALUE IF NOT EXISTS 'cambio_de_corte';

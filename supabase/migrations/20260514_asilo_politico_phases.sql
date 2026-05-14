-- Migración M1 del refactor multi-servicio + servicio Asilo Político.
--
-- 1. Extiende `case_phase` con 3 valores nuevos para soportar el ciclo de
--    Asilo Político (Fase 1: asilo_sustentos, Fase 2: asilo_reforzar,
--    cierre: asilo_completado). ALTER TYPE ... ADD VALUE no es reversible
--    en Postgres; los nombres están namespaced con `asilo_` para no
--    colisionar con futuros servicios.
-- 2. Marca como inactivos los servicios legacy `asilo-afirmativo` y
--    `asilo-defensivo` (0 casos en BD verificados) — quedan como tombstones
--    históricos.
-- 3. Inserta el servicio `asilo-politico` con precio base 1500 y bandera
--    activa. El detalle de subservicios (`completo`, `solo-reforzar`) vive
--    en `src/lib/contracts/index.ts`, no en BD (precedente de
--    `visa-juvenil` y su `subservices` array TS).

ALTER TYPE public.case_phase ADD VALUE IF NOT EXISTS 'asilo_sustentos';
ALTER TYPE public.case_phase ADD VALUE IF NOT EXISTS 'asilo_reforzar';
ALTER TYPE public.case_phase ADD VALUE IF NOT EXISTS 'asilo_completado';

UPDATE public.service_catalog
SET is_active = false
WHERE slug IN ('asilo-afirmativo', 'asilo-defensivo');

INSERT INTO public.service_catalog (
  slug, name, short_description, base_price, allow_installments,
  estimated_duration, uscis_forms, is_active, display_order
)
VALUES (
  'asilo-politico',
  'Asilo Político',
  'Solicitud de asilo ante USCIS con asistencia de IA para Miedo Creíble',
  1500,
  true,
  '1-3+ años',
  ARRAY['I-589']::text[],
  true,
  1
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  base_price = EXCLUDED.base_price,
  allow_installments = EXCLUDED.allow_installments,
  estimated_duration = EXCLUDED.estimated_duration,
  uscis_forms = EXCLUDED.uscis_forms,
  is_active = true;

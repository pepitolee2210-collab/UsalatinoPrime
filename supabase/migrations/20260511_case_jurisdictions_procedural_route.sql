-- Agrega campos para registrar la ruta procedimental inferida en Fase 1
-- (custodia) de Visa Juvenil. La ruta determina qué set de formularios pide
-- el clerk de la corte para abrir el caso: custody (padre/madre biológico),
-- guardianship (familiar/cuidador), surrogate 17-A (NY, casos especiales) o
-- juvenile dependency (CPS/ACS).
--
-- Antes solo se buscaba guardianship por default — eso producía formularios
-- equivocados para casos como el de Bielka (madre biológica, ruta=custody en
-- NY exige GF-17, no Form 6-1).
--
-- El reason y confidence permiten auditar la inferencia y, en una segunda
-- iteración, permitir override manual desde el panel admin.

ALTER TABLE public.case_jurisdictions
  ADD COLUMN IF NOT EXISTS procedural_route text
    CHECK (procedural_route IS NULL OR procedural_route IN (
      'custody', 'guardianship', 'surrogate_17a', 'juvenile_dependency'
    )),
  ADD COLUMN IF NOT EXISTS petitioner_relation text,
  ADD COLUMN IF NOT EXISTS procedural_route_reason text,
  ADD COLUMN IF NOT EXISTS procedural_route_confidence text
    CHECK (procedural_route_confidence IS NULL OR procedural_route_confidence IN ('high', 'medium', 'low'));

COMMENT ON COLUMN public.case_jurisdictions.procedural_route IS
  'Ruta procedimental Fase 1 SIJS. custody=peticionario es padre/madre, guardianship=peticionario es no-padre (familiar/cuidador), surrogate_17a=NY Surrogate Court (raro), juvenile_dependency=hay CPS/ACS.';

COMMENT ON COLUMN public.case_jurisdictions.petitioner_relation IS
  'Categoría de la relación del peticionario con el menor inferida del tutor_guardian form (biological_parent, step_parent, adoptive_parent, relative_non_parent, non_relative_caregiver, self_petitioner, unknown).';

COMMENT ON COLUMN public.case_jurisdictions.procedural_route_reason IS
  'Frase corta en español que explica por qué se eligió la ruta (audit log). Ej: "relationship_to_minor=Madre biológica → ruta custody".';

COMMENT ON COLUMN public.case_jurisdictions.procedural_route_confidence IS
  'Confianza de la inferencia. high=match directo desde form, medium=heurística, low=default conservador (relacionado vacío o no reconocido).';

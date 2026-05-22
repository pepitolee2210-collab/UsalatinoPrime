-- 20260522a — Quitar "Declaración Jurada Personal" (id=85) como upload del cliente en Fase 2 de Asilo.
--
-- Por qué: el cliente no sabe llenar una declaración jurada formal. La calidad
-- del input degradaba la calidad del relato de Miedo Creíble generado por IA.
-- A partir de v5, los datos del cliente vienen del cuestionario M1-M11 que
-- se completa en la pestaña "Formularios" del portal cliente.
--
-- Qué hace: borra las 2 filas en document_type_phases que hacían visible el
-- documento bajo `asilo-politico` / `reforzar-asilo` en la fase `asilo_reforzar`.
-- El document_type 85 permanece activo (is_active=true) para que admin/paralegal
-- pueda seguir subiéndolo internamente como `firm_internal` si necesita backup
-- manual de un caso legacy.
--
-- Idempotente: el DELETE no falla si las filas ya no existen.

DELETE FROM public.document_type_phases
WHERE document_type_id = 85
  AND phase_code = 'asilo_reforzar'
  AND service_slug IN ('asilo-politico', 'reforzar-asilo');

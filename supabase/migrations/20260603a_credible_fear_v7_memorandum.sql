-- Miedo Creíble v7 — Memorándum Legal robusto (~20 págs) con jurisprudencia
-- federal real (web search verificado), anexo de noticias con carátulas, y
-- tabla cronológica. Reemplaza la declaración v6 como documento principal.
--
-- La generación pasa a ser un PIPELINE ASÍNCRONO en 2 workers QStash
-- encadenados (research → draft). El estado vive en la columna `status`, que
-- ahora admite los sub-estados de progreso 'RESEARCHING' y 'DRAFTING' además
-- de los 3 estados v6. La UI poolea ese status (patrón research-jurisdiction).
--
-- Cambios aditivos e idempotentes — los drafts v6 existentes quedan intactos
-- (columnas nuevas en NULL).

-- 1. Nuevas columnas JSONB con los componentes estructurados del v7.
ALTER TABLE case_credible_fear_drafts
  ADD COLUMN IF NOT EXISTS legal_brief_json   jsonb,  -- secciones I.1-I.5 del brief (texto + metadatos)
  ADD COLUMN IF NOT EXISTS jurisprudence_json jsonb,  -- casos federales verificados {name, citation, court, year, holding, factual_analogy, url, url_verified}
  ADD COLUMN IF NOT EXISTS news_appendix_json jsonb,  -- 4-5 noticias con carátula {source_name, author, verified_url, executive_summary, full_context, published_date}
  ADD COLUMN IF NOT EXISTS chronology_json    jsonb,  -- tabla cronológica [{date, event, consequence, exhibit}]
  ADD COLUMN IF NOT EXISTS generation_error   text;   -- mensaje de error del worker si una fase falla

-- 2. Ampliar el CHECK de `status` con los sub-estados de progreso del pipeline
--    async y un estado terminal de error ('FAILED').
ALTER TABLE case_credible_fear_drafts
  DROP CONSTRAINT IF EXISTS case_credible_fear_drafts_status_check;

ALTER TABLE case_credible_fear_drafts
  ADD CONSTRAINT case_credible_fear_drafts_status_check
  CHECK (
    status IS NULL OR status = ANY (ARRAY[
      'RESEARCHING'::text,      -- worker A: análisis + jurisprudencia + noticias
      'DRAFTING'::text,         -- worker B: redacción del memorándum + cronología
      'DRAFT_COMPLETE'::text,   -- documento final listo
      'GAPS_FOUND'::text,       -- el cuestionario tiene huecos críticos (E1-E7)
      'REQUIRES_REVIEW'::text,  -- flags legales o output inválido — revisión humana
      'FAILED'::text            -- error irrecuperable del pipeline
    ])
  );

COMMENT ON COLUMN case_credible_fear_drafts.legal_brief_json IS 'v7: secciones I.1-I.5 del Legal Brief & Argumentation';
COMMENT ON COLUMN case_credible_fear_drafts.jurisprudence_json IS 'v7: casos federales reales verificados (web_search + checkUrlReachable)';
COMMENT ON COLUMN case_credible_fear_drafts.news_appendix_json IS 'v7: Apéndice C — 4-5 noticias con carátula y links verificados';
COMMENT ON COLUMN case_credible_fear_drafts.chronology_json IS 'v7: Apéndice A — tabla cronológica estructurada';

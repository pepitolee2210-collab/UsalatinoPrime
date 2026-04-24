-- ============================================================
-- UsaLatino Prime — Cache de jurisdicción por caso
--
-- Contexto: los documentos SIJS (Petición de Tutela, Declaración
-- del Tutor, etc.) deben ir dirigidos a la corte juvenil/familiar
-- específica del estado donde vive el cliente. Antes, la IA
-- generaba documentos con placeholder [FALTA: Nombre del tribunal]
-- o dependía de que el admin llenara `supplementaryData.court.name`
-- manualmente.
--
-- Esta tabla cachea el resultado de una investigación con Claude +
-- web_search (limitado a dominios .gov/.us) por caseId: nombre oficial
-- de la corte, dirección, procedimiento de radicación, edad máxima
-- SIJS en el estado y las URLs oficiales que respaldan la información.
--
-- El cache expira a los 30 días (las cortes rara vez cambian pero
-- tampoco son inmutables). Se invalida manualmente con el botón
-- "Re-verificar" en el panel admin.
-- ============================================================

CREATE TABLE IF NOT EXISTS case_jurisdictions (
  case_id UUID PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
  state_code TEXT NOT NULL,
  state_name TEXT NOT NULL,
  client_zip TEXT,
  court_name TEXT NOT NULL,
  court_name_es TEXT,
  court_address TEXT,
  filing_procedure TEXT,
  filing_procedure_es TEXT,
  age_limit_sijs INTEGER,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK (confidence IN ('high', 'medium', 'low')),
  notes TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para mantener updated_at en sync
CREATE OR REPLACE FUNCTION touch_case_jurisdictions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_case_jurisdictions_updated_at ON case_jurisdictions;
CREATE TRIGGER trg_case_jurisdictions_updated_at
  BEFORE UPDATE ON case_jurisdictions
  FOR EACH ROW
  EXECUTE FUNCTION touch_case_jurisdictions_updated_at();

-- RLS: admin + employee pueden leer/escribir. Los endpoints del API
-- llegan por service role (bypass RLS) igual que case_form_submissions,
-- pero dejamos policies explícitas por si se accede desde el cliente.
ALTER TABLE case_jurisdictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all jurisdictions"
  ON case_jurisdictions
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin can upsert jurisdictions"
  ON case_jurisdictions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Employees can view jurisdictions"
  ON case_jurisdictions
  FOR SELECT
  USING (is_employee());

-- Index para lookups frecuentes (tab de declaraciones carga el panel)
CREATE INDEX IF NOT EXISTS idx_case_jurisdictions_state ON case_jurisdictions(state_code);
CREATE INDEX IF NOT EXISTS idx_case_jurisdictions_verified ON case_jurisdictions(verified_at);

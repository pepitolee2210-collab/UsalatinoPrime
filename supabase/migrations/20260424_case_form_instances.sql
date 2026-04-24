-- ══════════════════════════════════════════════════════════════════
-- Tabla para instancias de formularios oficiales por caso.
-- Una fila = un formulario PDF que el cliente debe llenar para su caso.
-- Los forms vienen del research de jurisdicción (required_forms +
-- intake_packet.required_forms). Esta tabla los instancia por caso,
-- guarda los valores llenados por el usuario, y referencia el PDF final.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.case_form_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,

  packet_type text NOT NULL
    CHECK (packet_type IN ('intake', 'merits')),
  form_name text NOT NULL,
  form_url_official text NOT NULL,
  form_description_es text,
  is_mandatory boolean NOT NULL DEFAULT false,

  acroform_schema jsonb DEFAULT '[]'::jsonb,
  schema_source text NOT NULL DEFAULT 'pending'
    CHECK (schema_source IN ('pending', 'acroform', 'ocr_gemini', 'failed')),
  schema_error text,

  filled_values jsonb DEFAULT '{}'::jsonb,
  filled_at timestamptz,

  filled_pdf_path text,
  filled_pdf_generated_at timestamptz,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'detecting', 'ready', 'partial', 'complete', 'downloaded', 'failed')),

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (case_id, packet_type, form_name)
);

CREATE INDEX IF NOT EXISTS idx_case_form_instances_case ON public.case_form_instances (case_id);
CREATE INDEX IF NOT EXISTS idx_case_form_instances_packet ON public.case_form_instances (case_id, packet_type);

CREATE OR REPLACE FUNCTION public.set_case_form_instances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_case_form_instances_updated_at ON public.case_form_instances;
CREATE TRIGGER trg_case_form_instances_updated_at
  BEFORE UPDATE ON public.case_form_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_case_form_instances_updated_at();

ALTER TABLE public.case_form_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_form_instances_admin_all ON public.case_form_instances
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY case_form_instances_employee_all ON public.case_form_instances
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'employee'));

CREATE POLICY case_form_instances_client_read ON public.case_form_instances
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM cases c
    WHERE c.id = case_form_instances.case_id
      AND c.client_id = auth.uid()
  ));

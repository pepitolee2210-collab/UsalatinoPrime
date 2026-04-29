-- ══════════════════════════════════════════════════════════════════
-- FASES SIJS + CATÁLOGO DE TIPOS DE DOCUMENTO
--
-- Introduce el concepto explícito de fase del proceso SIJS
-- (Custodia → I-360 → I-485) en `cases`, audit trail en
-- `case_phase_history`, y un catálogo maestro `document_types`
-- que reemplaza el modelo hardcoded actual de getDocumentCategories.
--
-- También extiende `case_form_instances` con flags para soportar
-- edición del cliente (FieldSpec.editableByClient en el código)
-- con bloqueo opcional por Diana cuando el form está listo
-- para imprimir.
--
-- Crea `service_phase_assets` (videos intro por fase × servicio)
-- y `quick_contacts` (Diana, Vanessa, Pepito configurables).
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- ENUMs nuevos
-- ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.case_phase AS ENUM ('custodia', 'i360', 'i485', 'completado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.document_slot_kind AS ENUM ('single', 'dual_es_en', 'multiple_named');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- cases: agregar fase actual + estado + flags clínicos
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS process_start        public.case_phase,
  ADD COLUMN IF NOT EXISTS current_phase        public.case_phase,
  ADD COLUMN IF NOT EXISTS state_us             varchar(2),
  ADD COLUMN IF NOT EXISTS parent_deceased      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_orr_custody       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_criminal_history boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS minor_close_to_21    boolean DEFAULT false;

COMMENT ON COLUMN public.cases.process_start IS
  'Fase de inicio del cliente. Auto-asignada por servicio (visa-juvenil → custodia). NULL para servicios fuera de SIJS.';
COMMENT ON COLUMN public.cases.current_phase IS
  'Fase actual del caso. Solo Diana avanza. NULL para servicios fuera de SIJS.';
COMMENT ON COLUMN public.cases.state_us IS
  'Estado US (TX, FL, etc.) — determina formularios estatales aplicables vía registry.';

CREATE INDEX IF NOT EXISTS cases_current_phase_idx ON public.cases(current_phase)
  WHERE current_phase IS NOT NULL;
CREATE INDEX IF NOT EXISTS cases_state_us_idx ON public.cases(state_us)
  WHERE state_us IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────
-- case_phase_history: audit de cambios de fase
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.case_phase_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  from_phase  public.case_phase,
  to_phase    public.case_phase NOT NULL,
  changed_by  uuid REFERENCES public.profiles(id),
  changed_at  timestamptz NOT NULL DEFAULT now(),
  reason      text
);

CREATE INDEX IF NOT EXISTS case_phase_history_case_idx
  ON public.case_phase_history(case_id, changed_at DESC);

ALTER TABLE public.case_phase_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_phase_history_admin_all" ON public.case_phase_history
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "case_phase_history_employee_read" ON public.case_phase_history
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'employee'));

-- ──────────────────────────────────────────────────────────────────
-- document_types: catálogo maestro
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.document_types (
  id                       serial PRIMARY KEY,
  code                     text UNIQUE NOT NULL,
  name_es                  text NOT NULL,
  name_en                  text NOT NULL,
  description_es           text,
  category_code            text NOT NULL,
  category_name_es         text NOT NULL,
  category_icon            text,
  requires_translation     boolean NOT NULL DEFAULT false,
  requires_certified_copy  boolean NOT NULL DEFAULT false,
  shown_in_custodia        boolean NOT NULL DEFAULT false,
  shown_in_i360            boolean NOT NULL DEFAULT false,
  shown_in_i485            boolean NOT NULL DEFAULT false,
  conditional_logic        jsonb,
  legal_reference          text,
  slot_kind                public.document_slot_kind NOT NULL DEFAULT 'single',
  max_slots                int,
  sort_order               int NOT NULL DEFAULT 0,
  is_active                boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_types IS
  'Catálogo maestro de tipos de documento solicitables al cliente. Seedeado desde usalatino-sijs-documentos-dinamicos.md (matriz sección 7).';
COMMENT ON COLUMN public.document_types.conditional_logic IS
  'JSONB con shape { type: "flag_eq", flag: "parent_deceased", value: true }. Evaluado contra cases.* para mostrar/ocultar el doc.';

CREATE INDEX IF NOT EXISTS document_types_category_idx
  ON public.document_types(category_code, sort_order);
CREATE INDEX IF NOT EXISTS document_types_phase_custodia_idx
  ON public.document_types(shown_in_custodia) WHERE shown_in_custodia;
CREATE INDEX IF NOT EXISTS document_types_phase_i360_idx
  ON public.document_types(shown_in_i360) WHERE shown_in_i360;
CREATE INDEX IF NOT EXISTS document_types_phase_i485_idx
  ON public.document_types(shown_in_i485) WHERE shown_in_i485;

CREATE OR REPLACE FUNCTION public.set_document_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_types_updated_at ON public.document_types;
CREATE TRIGGER trg_document_types_updated_at
  BEFORE UPDATE ON public.document_types
  FOR EACH ROW EXECUTE FUNCTION public.set_document_types_updated_at();

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_types_read_all" ON public.document_types
  FOR SELECT USING (true);

CREATE POLICY "document_types_admin_write" ON public.document_types
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ──────────────────────────────────────────────────────────────────
-- documents: trazabilidad por fase + soporte slot múltiple nombrado
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS document_type_id    int REFERENCES public.document_types(id),
  ADD COLUMN IF NOT EXISTS phase_when_uploaded public.case_phase,
  ADD COLUMN IF NOT EXISTS slot_label          text;

COMMENT ON COLUMN public.documents.phase_when_uploaded IS
  'Snapshot de cases.current_phase cuando se subió. NO se actualiza al avanzar fase. Usado para historial.';
COMMENT ON COLUMN public.documents.slot_label IS
  'Para slot_kind=multiple_named: nombre custom del slot (ej. "Carta del Sr. Juan Pérez"). NULL para slots single/dual_es_en.';

CREATE INDEX IF NOT EXISTS documents_type_idx
  ON public.documents(document_type_id) WHERE document_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS documents_phase_idx
  ON public.documents(phase_when_uploaded) WHERE phase_when_uploaded IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────
-- case_form_instances: soporte edición cliente con lock por Diana
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.case_form_instances
  ADD COLUMN IF NOT EXISTS locked_for_client    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_last_edit_at  timestamptz,
  ADD COLUMN IF NOT EXISTS client_submitted_at  timestamptz;

COMMENT ON COLUMN public.case_form_instances.locked_for_client IS
  'Cuando true, los endpoints /api/cita/[token]/forms/* rechazan PUT. Diana lo activa cuando va a imprimir.';
COMMENT ON COLUMN public.case_form_instances.client_last_edit_at IS
  'Timestamp de la última edición que vino del cliente (vía /api/cita/[token]/forms). NULL si solo Diana ha editado.';
COMMENT ON COLUMN public.case_form_instances.client_submitted_at IS
  'Cuando el cliente termina y envía a revisión. Notifica a Diana.';

-- Política nueva para que el cliente pueda hacer UPDATE de su propio caso
-- (lectura ya existe vía case_form_instances_client_read).
-- En la práctica los endpoints usan service role, esta policy es defensa
-- en profundidad por si en el futuro el cliente usa cliente Supabase directo.
CREATE POLICY "case_form_instances_client_update" ON public.case_form_instances
  FOR UPDATE
  USING (
    NOT locked_for_client AND
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_form_instances.case_id
        AND c.client_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- service_phase_assets: videos intro por fase × servicio
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_phase_assets (
  id                     serial PRIMARY KEY,
  service_id             uuid NOT NULL REFERENCES public.service_catalog(id) ON DELETE CASCADE,
  phase                  public.case_phase NOT NULL,
  welcome_video_url      text,
  welcome_video_poster   text,
  description_es         text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, phase)
);

COMMENT ON TABLE public.service_phase_assets IS
  'Assets multimedia por (servicio, fase). Permite a Diana subir un video introductorio diferente para Custodia, I-360 e I-485.';

CREATE OR REPLACE FUNCTION public.set_service_phase_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_phase_assets_updated_at ON public.service_phase_assets;
CREATE TRIGGER trg_service_phase_assets_updated_at
  BEFORE UPDATE ON public.service_phase_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_service_phase_assets_updated_at();

ALTER TABLE public.service_phase_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_phase_assets_read_all" ON public.service_phase_assets
  FOR SELECT USING (true);

CREATE POLICY "service_phase_assets_admin_write" ON public.service_phase_assets
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ──────────────────────────────────────────────────────────────────
-- quick_contacts: contactos configurables (Diana, Vanessa, Pepito)
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quick_contacts (
  id              serial PRIMARY KEY,
  name            text NOT NULL,
  role            text NOT NULL,
  phone_e164      text,
  whatsapp_e164   text,
  avatar_url      text,
  show_in_inicio  boolean NOT NULL DEFAULT true,
  show_in_ayuda   boolean NOT NULL DEFAULT true,
  sort_order      int NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quick_contacts IS
  'Contactos rápidos visibles en pantalla Inicio (mini-cards) y Más > Ayuda (lista completa). Editables por Diana sin tocar código.';

CREATE OR REPLACE FUNCTION public.set_quick_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quick_contacts_updated_at ON public.quick_contacts;
CREATE TRIGGER trg_quick_contacts_updated_at
  BEFORE UPDATE ON public.quick_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_quick_contacts_updated_at();

ALTER TABLE public.quick_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quick_contacts_read_active" ON public.quick_contacts
  FOR SELECT USING (is_active);

CREATE POLICY "quick_contacts_admin_write" ON public.quick_contacts
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- UsaLatino Prime — Dashboard de Consultoras Senior (Vanessa)
--
-- Contexto: posicionamos UsaLatino Prime como PLATAFORMA
-- TECNOLÓGICA que guía al usuario a organizar su propio
-- expediente. Las consultoras senior no son abogadas — son
-- guías que acompañan al usuario en la llamada gratuita de
-- evaluación de documentos.
--
-- Cambios:
--   1. profiles.employee_type para diferenciar Diana (paralegal)
--      de Vanessa (senior_consultant). El rol sigue siendo
--      'employee' — employee_type solo controla qué secciones
--      del /employee/* ve cada persona.
--   2. appointments extendido con campos de prospecto:
--      captured_data, probability, consultant_id,
--      consultant_notes, client_decision, call_status.
--   3. consultant_availability + consultant_blocks para la
--      agenda de Vanessa (Fase 4).
-- ============================================================

-- 1. Diferenciación entre tipos de employee
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS employee_type TEXT
  CHECK (employee_type IN ('paralegal', 'senior_consultant'));

COMMENT ON COLUMN profiles.employee_type IS
  'Subtipo de employee. paralegal=Diana (formularios, LEX). senior_consultant=Vanessa (prospectos IA, evaluación de documentos). NULL para admins o employees legacy.';

CREATE INDEX IF NOT EXISTS idx_profiles_employee_type
  ON profiles (employee_type) WHERE employee_type IS NOT NULL;

-- 2. Campos de seguimiento del prospecto en appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS captured_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS probability TEXT
    CHECK (probability IN ('alta', 'media', 'baja')),
  ADD COLUMN IF NOT EXISTS consultant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consultant_notes TEXT,
  ADD COLUMN IF NOT EXISTS client_decision TEXT
    CHECK (client_decision IN ('acepta', 'rechaza', 'lo_pensara', 'no_procede')),
  ADD COLUMN IF NOT EXISTS call_status TEXT
    CHECK (call_status IN ('llamada_ahora', 'programada', 'en_curso', 'completada', 'no_procede', 'no_contesta'));

COMMENT ON COLUMN appointments.captured_data IS
  'jsonb con los datos que la consultora senior captura durante la llamada de evaluación (menor, abandono, custodio, antecedentes, etc). Autoguardado cada 15s desde el panel lateral.';
COMMENT ON COLUMN appointments.probability IS
  'Evaluación subjetiva de la consultora sobre la viabilidad del caso (alta/media/baja). Se muestra al cliente como orientación.';
COMMENT ON COLUMN appointments.consultant_id IS
  'FK a profiles de la consultora senior asignada (típicamente Vanessa).';
COMMENT ON COLUMN appointments.client_decision IS
  'Decisión del cliente al final de la evaluación gratuita. acepta → Andriuw genera contrato.';
COMMENT ON COLUMN appointments.call_status IS
  'Estado operativo del prospecto (distinto de appointments.status que es legacy). Controla el bucket donde aparece en el dashboard de la consultora.';

CREATE INDEX IF NOT EXISTS idx_appointments_call_status
  ON appointments (call_status) WHERE source = 'voice-agent';
CREATE INDEX IF NOT EXISTS idx_appointments_consultant
  ON appointments (consultant_id) WHERE consultant_id IS NOT NULL;

-- 3. Disponibilidad de la consultora senior
CREATE TABLE IF NOT EXISTS consultant_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_hour SMALLINT NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour SMALLINT NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_hour_range CHECK (end_hour > start_hour),
  CONSTRAINT uq_consultant_day UNIQUE (consultant_id, day_of_week)
);

COMMENT ON TABLE consultant_availability IS
  'Horario semanal fijo de cada consultora senior. La IA de voz consulta esta tabla para proponer slots disponibles.';

CREATE INDEX IF NOT EXISTS idx_consultant_availability_consultant
  ON consultant_availability (consultant_id) WHERE is_available = TRUE;

-- 4. Bloqueos puntuales (vacaciones, almuerzos, etc.)
CREATE TABLE IF NOT EXISTS consultant_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_at_start TIMESTAMPTZ NOT NULL,
  blocked_at_end TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_block_range CHECK (blocked_at_end > blocked_at_start)
);

COMMENT ON TABLE consultant_blocks IS
  'Bloqueos puntuales de la agenda: vacaciones, reuniones internas, almuerzos. La IA de voz los respeta al proponer slots.';

CREATE INDEX IF NOT EXISTS idx_consultant_blocks_consultant_range
  ON consultant_blocks (consultant_id, blocked_at_start, blocked_at_end);

-- 5. RLS
ALTER TABLE consultant_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultant_blocks ENABLE ROW LEVEL SECURITY;

-- Admins ven todo
CREATE POLICY consultant_availability_admin_all ON consultant_availability FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY consultant_blocks_admin_all ON consultant_blocks FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Cada consultora gestiona su propia agenda
CREATE POLICY consultant_availability_self_all ON consultant_availability FOR ALL
  USING (auth.uid() = consultant_id);

CREATE POLICY consultant_blocks_self_all ON consultant_blocks FOR ALL
  USING (auth.uid() = consultant_id);

-- Service role bypasses RLS (usado por /api/voice-agent/slots)

-- ============================================================
-- INSTRUCCIONES MANUALES (ejecutar en Supabase SQL editor
-- después de correr esta migración):
--
-- 1) Crear el user de Vanessa en Supabase Auth (desde el panel
--    Auth → Users → Add user con su email real).
--
-- 2) Insertar su perfil:
--
--    INSERT INTO profiles (id, role, employee_type, first_name,
--                          last_name, phone, email)
--    VALUES (
--      '<UUID_DE_VANESSA>',
--      'employee',
--      'senior_consultant',
--      'Vanessa',
--      '<APELLIDO>',
--      '<TELEFONO>',
--      '<EMAIL>'
--    );
--
-- 3) Opcional — marcar a Diana como paralegal:
--
--    UPDATE profiles SET employee_type = 'paralegal'
--    WHERE email = 'diana@...';
--
-- 4) Horario por defecto de Vanessa (L-V 9am-6pm MT):
--
--    INSERT INTO consultant_availability
--      (consultant_id, day_of_week, start_hour, end_hour)
--    SELECT '<UUID_DE_VANESSA>', d, 9, 18
--    FROM generate_series(1, 5) d
--    ON CONFLICT DO NOTHING;
-- ============================================================

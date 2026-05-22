-- 20260523a — 12 nuevas categorías de documentos opcionales de evidencia para Fase 2 de Asilo.
--
-- Por qué: tras retirar el upload del affidavit personal (20260522a), la pestaña
-- Documentos del cliente en Fase 2 quedó vacía. La IA del Miedo Creíble v6 cita
-- evidencia documental concreta (denuncias, reportes médicos, fotos, capturas
-- de amenazas, cartas juradas de testigos, etc.). Estas categorías opcionales
-- le dan al cliente forma estructurada de subir esas pruebas, las cuales pasan
-- por OCR Gemini y alimentan el prompt v6.
--
-- Todas multiple_named para que el cliente pueda subir varias del mismo tipo
-- y nombrarlas (ej. "Denuncia GNB marzo 2022", "Denuncia GNB enero 2024").
-- is_required=false en el catálogo + is_required_override=false en M2M.

INSERT INTO public.document_types
  (code, name_es, name_en, description_es, category_code, category_name_es, category_icon, slot_kind, requires_translation, is_required, is_per_member, is_active)
VALUES
  ('asylum_police_report',              'Denuncia policial / Reporte de autoridad', 'Police report',           'Constancias o reportes de denuncias presentadas en tu país.', 'evidencia_situacion', 'Evidencia de la persecución', 'gavel',                'multiple_named', true,  false, false, true),
  ('asylum_medical_report',             'Reporte médico de lesiones',                'Medical report',          'Informes médicos por golpes, lesiones o secuelas de la persecución.', 'evidencia_situacion', 'Evidencia de la persecución', 'medical_services',     'multiple_named', true,  false, false, true),
  ('asylum_psychological_report',       'Reporte psicológico / psiquiátrico',        'Psychological report',    'Evaluaciones psicológicas o de trauma postraumático.', 'evidencia_situacion', 'Evidencia de la persecución', 'psychology',           'multiple_named', true,  false, false, true),
  ('asylum_threat_screenshots',         'Capturas de amenazas (WhatsApp, SMS, redes)', 'Threat screenshots',    'Mensajes amenazantes, llamadas o publicaciones en su contra.', 'evidencia_situacion', 'Evidencia de la persecución', 'chat',                 'multiple_named', false, false, false, true),
  ('asylum_threat_physical',            'Cartas o documentos amenazantes (escaneados)', 'Physical threat documents', 'Anónimos, panfletos, notas que recibió.', 'evidencia_situacion', 'Evidencia de la persecución', 'mail',                'multiple_named', true,  false, false, true),
  ('asylum_injury_photos',              'Fotos de lesiones',                          'Injury photos',           'Solo si las tienes y deseas incluirlas.', 'evidencia_situacion', 'Evidencia de la persecución', 'image',               'multiple_named', false, false, false, true),
  ('asylum_property_damage_photos',     'Fotos de propiedad dañada o destruida',     'Property damage photos',  'Daños a tu casa, vehículo, comercio.', 'evidencia_situacion', 'Evidencia de la persecución', 'home_repair_service', 'multiple_named', false, false, false, true),
  ('asylum_membership_proof',           'Credencial / carnet (partido, sindicato, iglesia, ONG)', 'Membership credential', 'Pruebas de tu pertenencia al grupo que te persigue.', 'evidencia_situacion', 'Evidencia de la persecución', 'badge',          'multiple_named', true,  false, false, true),
  ('asylum_witness_affidavit_uploaded', 'Carta jurada de testigo (firmada)',         'Signed witness affidavit', 'Declaraciones firmadas de familiares, vecinos o testigos.', 'evidencia_situacion', 'Evidencia de la persecución', 'fact_check',       'multiple_named', true,  false, false, true),
  ('asylum_court_decision_against',     'Sentencia judicial / proceso en mi contra', 'Court decision against me','Si hay procesos legales o sentencias en tu contra en tu país.', 'evidencia_situacion', 'Evidencia de la persecución', 'balance',         'multiple_named', true,  false, false, true),
  ('asylum_press_about_me',             'Notas de prensa sobre mí o mi caso',        'Press about me',          'Artículos donde aparece tu caso o tu nombre.', 'evidencia_situacion', 'Evidencia de la persecución', 'newspaper',                'multiple_named', false, false, false, true),
  ('asylum_social_media_my_posts',      'Mis publicaciones en redes (activismo / opinión)', 'My social media posts', 'Capturas de tu actividad pública que motivó la persecución.', 'evidencia_situacion', 'Evidencia de la persecución', 'public', 'multiple_named', false, false, false, true)
ON CONFLICT (code) DO NOTHING;

-- M2M: registrar los 12 doc_types como opcionales en Fase 2 para AMBOS servicios.
INSERT INTO public.document_type_phases
  (document_type_id, service_slug, phase_code, is_required_override, sort_order)
SELECT dt.id, s.slug, 'asilo_reforzar', false, 200 + (row_number() over (order by dt.id))
FROM public.document_types dt
CROSS JOIN (VALUES ('asilo-politico'), ('reforzar-asilo')) AS s(slug)
WHERE dt.code IN (
  'asylum_police_report','asylum_medical_report','asylum_psychological_report',
  'asylum_threat_screenshots','asylum_threat_physical','asylum_injury_photos',
  'asylum_property_damage_photos','asylum_membership_proof',
  'asylum_witness_affidavit_uploaded','asylum_court_decision_against',
  'asylum_press_about_me','asylum_social_media_my_posts'
)
ON CONFLICT (document_type_id, service_slug, phase_code) DO NOTHING;

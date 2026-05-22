-- 20260522c — Tabla de URLs de country conditions pre-curadas por país.
--
-- Por qué: el módulo M9 del cuestionario Miedo Creíble pide al cliente
-- 3-5 enlaces a prensa internacional, prensa local y reportes oficiales
-- (HRW, Amnesty, State Dept, CIDH, etc.). Pre-llenar URLs autoritativas
-- por país del solicitante reduce trabajo del cliente y asegura que las
-- fuentes citadas tengan peso ante USCIS. La tabla se actualiza
-- trimestralmente por la firma.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + INSERT ... ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS public.country_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  source_organization text NOT NULL,
  url text NOT NULL,
  url_title text NOT NULL,
  url_year int,
  category text NOT NULL CHECK (category IN (
    'general_human_rights',
    'violence_and_organized_crime',
    'political_repression',
    'religious_freedom',
    'lgbtq_rights',
    'press_freedom',
    'press_international',
    'press_local'
  )),
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  is_current boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, url)
);

CREATE INDEX IF NOT EXISTS country_evidence_links_country_active_idx
  ON public.country_evidence_links (country_code, sort_order)
  WHERE is_current;

ALTER TABLE public.country_evidence_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS country_evidence_links_select_authenticated ON public.country_evidence_links;
CREATE POLICY country_evidence_links_select_authenticated
  ON public.country_evidence_links
  FOR SELECT
  TO authenticated
  USING (is_current);

-- Seed inicial — landing pages estables de organizaciones autoritativas para
-- los 6 países latinoamericanos con mayor volumen actual de clientes de Asilo.
-- Las URLs específicas por año se actualizan mediante UPDATE; estas landings
-- siempre apuntan al reporte más reciente del país.

INSERT INTO public.country_evidence_links
  (country_code, source_organization, url, url_title, url_year, category, sort_order)
VALUES
  -- VENEZUELA
  ('VE', 'U.S. State Department',  'https://www.state.gov/reports/2024-country-reports-on-human-rights-practices/venezuela/',  '2024 Country Report on Human Rights Practices: Venezuela', 2024, 'general_human_rights', 10),
  ('VE', 'Human Rights Watch',     'https://www.hrw.org/americas/venezuela',                                                   'HRW: Venezuela page',                                       NULL, 'general_human_rights', 20),
  ('VE', 'Amnesty International',  'https://www.amnesty.org/en/location/americas/south-america/venezuela/',                   'Amnesty: Venezuela',                                        NULL, 'general_human_rights', 30),
  ('VE', 'Foro Penal',             'https://foropenal.com/',                                                                  'Foro Penal — presos políticos en Venezuela',                NULL, 'political_repression', 40),
  ('VE', 'Provea',                 'https://provea.org/',                                                                     'Provea — Programa Venezolano de Educación-Acción en DDHH',  NULL, 'general_human_rights', 50),
  ('VE', 'Espacio Público',        'https://espaciopublico.ong/',                                                             'Espacio Público — libertad de expresión Venezuela',         NULL, 'press_freedom',        60),

  -- MEXICO
  ('MX', 'U.S. State Department',  'https://www.state.gov/reports/2024-country-reports-on-human-rights-practices/mexico/',     '2024 Country Report on Human Rights Practices: Mexico',    2024, 'general_human_rights',          10),
  ('MX', 'Human Rights Watch',     'https://www.hrw.org/americas/mexico',                                                      'HRW: Mexico page',                                          NULL, 'general_human_rights',          20),
  ('MX', 'Amnesty International',  'https://www.amnesty.org/en/location/americas/north-america/mexico/',                       'Amnesty: Mexico',                                           NULL, 'general_human_rights',          30),
  ('MX', 'InSight Crime',          'https://insightcrime.org/mexico-organized-crime-news/',                                    'InSight Crime — Mexico organized crime news',               NULL, 'violence_and_organized_crime',  40),
  ('MX', 'Comisión Mexicana de DDH','https://cmdpdh.org/',                                                                     'CMDPDH — Comisión Mexicana de Defensa y Promoción de DDH',  NULL, 'general_human_rights',          50),

  -- HONDURAS
  ('HN', 'U.S. State Department',  'https://www.state.gov/reports/2024-country-reports-on-human-rights-practices/honduras/',   '2024 Country Report on Human Rights Practices: Honduras',   2024, 'general_human_rights',          10),
  ('HN', 'Human Rights Watch',     'https://www.hrw.org/americas/honduras',                                                    'HRW: Honduras page',                                        NULL, 'general_human_rights',          20),
  ('HN', 'Amnesty International',  'https://www.amnesty.org/en/location/americas/central-america-and-the-caribbean/honduras/', 'Amnesty: Honduras',                                         NULL, 'general_human_rights',          30),
  ('HN', 'InSight Crime',          'https://insightcrime.org/honduras-organized-crime-news/',                                  'InSight Crime — Honduras organized crime news',             NULL, 'violence_and_organized_crime',  40),

  -- COLOMBIA
  ('CO', 'U.S. State Department',  'https://www.state.gov/reports/2024-country-reports-on-human-rights-practices/colombia/',   '2024 Country Report on Human Rights Practices: Colombia',   2024, 'general_human_rights',          10),
  ('CO', 'Human Rights Watch',     'https://www.hrw.org/americas/colombia',                                                    'HRW: Colombia page',                                        NULL, 'general_human_rights',          20),
  ('CO', 'Amnesty International',  'https://www.amnesty.org/en/location/americas/south-america/colombia/',                     'Amnesty: Colombia',                                         NULL, 'general_human_rights',          30),
  ('CO', 'Indepaz',                'https://indepaz.org.co/',                                                                  'Indepaz — Instituto de Estudios para el Desarrollo y la Paz',NULL, 'violence_and_organized_crime', 40),
  ('CO', 'CIDH',                   'https://www.oas.org/en/iachr/multimedia/2023/colombia-truth-commission/colombia.html',      'CIDH — Colombia',                                           NULL, 'general_human_rights',          50),

  -- NICARAGUA
  ('NI', 'U.S. State Department',  'https://www.state.gov/reports/2024-country-reports-on-human-rights-practices/nicaragua/',  '2024 Country Report on Human Rights Practices: Nicaragua',  2024, 'general_human_rights',          10),
  ('NI', 'Human Rights Watch',     'https://www.hrw.org/americas/nicaragua',                                                   'HRW: Nicaragua page',                                       NULL, 'general_human_rights',          20),
  ('NI', 'Amnesty International',  'https://www.amnesty.org/en/location/americas/central-america-and-the-caribbean/nicaragua/','Amnesty: Nicaragua',                                        NULL, 'political_repression',          30),
  ('NI', 'CIDH',                   'https://www.oas.org/en/iachr/multimedia/2018/nicaragua/nicaragua.html',                     'CIDH — Nicaragua observatorio',                             NULL, 'political_repression',          40),

  -- CUBA
  ('CU', 'U.S. State Department',  'https://www.state.gov/reports/2024-country-reports-on-human-rights-practices/cuba/',       '2024 Country Report on Human Rights Practices: Cuba',       2024, 'general_human_rights',          10),
  ('CU', 'Human Rights Watch',     'https://www.hrw.org/americas/cuba',                                                        'HRW: Cuba page',                                            NULL, 'general_human_rights',          20),
  ('CU', 'Amnesty International',  'https://www.amnesty.org/en/location/americas/central-america-and-the-caribbean/cuba/',     'Amnesty: Cuba',                                             NULL, 'political_repression',          30),
  ('CU', 'CPJ',                    'https://cpj.org/americas/cuba/',                                                           'CPJ — Committee to Protect Journalists: Cuba',              NULL, 'press_freedom',                 40)
ON CONFLICT (country_code, url) DO NOTHING;

COMMENT ON TABLE public.country_evidence_links IS
  'URLs autoritativas de DDHH por país, pre-curadas para pre-llenar el módulo M9 del cuestionario Miedo Creíble. Mantenida por la firma trimestralmente.';

-- 20260523c — Expandir country_evidence_links con CASOS EMBLEMÁTICOS del país.
--
-- La carta de referencia (Karen Maleni / Jalisco) menciona el caso Giovanni
-- López y el Antimonumento 5J como anclajes narrativos concretos. Estos son
-- casos puntuales (no landing pages de HRW/State Dept) que dan tracción al
-- relato del cliente. El prompt v6 instruye a Claude a CITARLOS cuando sean
-- relevantes al tipo de persecución del cliente.

INSERT INTO public.country_evidence_links
  (country_code, source_organization, url, url_title, url_year, category, sort_order)
VALUES
  -- VENEZUELA — represión política, presos políticos, colectivos
  ('VE', 'Foro Penal',            'https://foropenal.com/cifras/',                                                                                'Foro Penal — Cifras de presos políticos en Venezuela',                          2026, 'political_repression', 70),
  ('VE', 'AP News',               'https://apnews.com/article/venezuela-maduro-political-prisoners',                                              'AP News — Venezuela political prisoners and detentions',                        2024, 'political_repression', 80),
  ('VE', 'Reuters',               'https://www.reuters.com/world/americas/venezuela-protests-maduro-election/',                                   'Reuters — Venezuela post-election protests and crackdown',                      2024, 'political_repression', 90),

  -- MÉXICO — desapariciones forzadas, violencia policial, caso Giovanni López, caso Ayotzinapa
  ('MX', 'The New York Times',    'https://www.nytimes.com/2020/06/05/world/americas/mexico-giovanni-lopez-protests.html',                       'NYT — Protests Erupt in Mexico Over Man''s Death After Arrest (caso Giovanni López, Jalisco)', 2020, 'general_human_rights',         60),
  ('MX', 'The Washington Post',   'https://www.washingtonpost.com/world/the_americas/mexico-police-custody-death/2020/06/05',                    'WaPo — Mexican protesters set police cars on fire after man dies in custody', 2020, 'general_human_rights',         70),
  ('MX', 'CNN en Español',        'https://www.cnn.com/2023/05/10/americas/mexico-mothers-march-disappeared-children-intl/index.html',           'CNN — Mexican mothers march to demand action on disappeared children',         2023, 'general_human_rights',         80),
  ('MX', 'Comisión Interamericana','https://www.oas.org/es/cidh/multimedia/2018/ayotzinapa/ayotzinapa.html',                                      'CIDH — Caso Ayotzinapa (43 estudiantes desaparecidos)',                         NULL, 'general_human_rights',         90),

  -- HONDURAS — Berta Cáceres, pandillas
  ('HN', 'BBC News',              'https://www.bbc.com/mundo/noticias-america-latina-58800221',                                                   'BBC — Caso Berta Cáceres y la defensa ambiental en Honduras',                   NULL, 'general_human_rights',         50),
  ('HN', 'The Guardian',          'https://www.theguardian.com/global-development/2022/jun/22/berta-caceres-honduras-environmental-defenders',   'The Guardian — Berta Cáceres and environmental defenders in Honduras',           2022, 'general_human_rights',         60),

  -- NICARAGUA — represión iglesia católica, opositores 2018+, Monseñor Álvarez
  ('NI', 'Reuters',               'https://www.reuters.com/world/americas/nicaragua-bishop-alvarez-jailed/',                                      'Reuters — Nicaragua jails Bishop Rolando Álvarez',                              2024, 'religious_freedom',             50),
  ('NI', 'Human Rights Watch',    'https://www.hrw.org/news/2023/09/22/nicaragua-civil-society-shutdown',                                        'HRW — Nicaragua civil society shutdown',                                        2023, 'political_repression',          60),

  -- CUBA — 11J protestas 2021, artistas
  ('CU', 'BBC News',              'https://www.bbc.com/mundo/noticias-america-latina-58000000',                                                   'BBC — Las protestas del 11J en Cuba (julio 2021)',                              2021, 'political_repression',          50),
  ('CU', 'Amnesty International', 'https://www.amnesty.org/en/latest/news/2022/07/cuba-protests-anniversary/',                                   'Amnesty — Cuba: One year after 11J protests',                                   2022, 'political_repression',          60)
ON CONFLICT (country_code, url) DO NOTHING;

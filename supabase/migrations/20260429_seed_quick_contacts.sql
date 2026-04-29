-- ══════════════════════════════════════════════════════════════════
-- Seed inicial de quick_contacts (Diana, Vanessa, Pepito)
--
-- Diana: asesora legal principal (existente, mantiene número actual).
-- Vanessa: nueva asesora.
-- Pepito (Giuseppe): soporte técnico (existente).
--
-- Diana puede editar/agregar/desactivar desde admin sin tocar código.
-- ══════════════════════════════════════════════════════════════════

INSERT INTO public.quick_contacts
  (name, role, phone_e164, whatsapp_e164, show_in_inicio, show_in_ayuda, sort_order, is_active)
VALUES
  ('Diana',   'Asesora Legal',     '+12677874365', '+12677874365',  true,  true, 10, true),
  ('Vanessa', 'Asesora Legal',      NULL,           NULL,            true,  true, 20, true),
  ('Pepito',  'Soporte Técnico',   '+51908765016', '+51908765016',  true,  true, 30, true)
ON CONFLICT DO NOTHING;

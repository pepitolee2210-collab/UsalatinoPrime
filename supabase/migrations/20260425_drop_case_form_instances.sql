-- Drop case_form_instances: AcroForm interactivo retirado.
-- El admin descarga el formulario oficial en blanco y lo llena manualmente.
-- Se reemplazó por una sección estática en jurisdiction-panel con botón
-- "Descargar oficial" por formulario y "Descargar todos" por radicación.
DROP TABLE IF EXISTS case_form_instances CASCADE;

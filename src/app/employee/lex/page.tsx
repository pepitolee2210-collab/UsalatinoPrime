// Wrapper fino para el chatbot LEX desde el portal de empleados.
// Reutiliza el mismo componente de /admin/revisor-ia para mantener una sola
// fuente de verdad del chat — los endpoints /api/admin/legal-chat* ya permiten
// tanto admin como employee (role check compartido).
export { default } from '@/app/admin/revisor-ia/page'

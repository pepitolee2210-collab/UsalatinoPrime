export const statusLabels: Record<string, { label: string; color: string }> = {
  payment_pending: { label: 'Pago Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'En Progreso', color: 'bg-blue-100 text-blue-800' },
  submitted: { label: 'Enviado', color: 'bg-purple-100 text-purple-800' },
  under_review: { label: 'En Revision', color: 'bg-orange-100 text-orange-800' },
  needs_correction: { label: 'Correcciones', color: 'bg-red-100 text-red-800' },
  approved_by_henry: { label: 'Aprobado', color: 'bg-green-100 text-green-800' },
  filed: { label: 'Presentado', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' },
}

// Allowed Kanban drag transitions
export const kanbanTransitions: Record<string, string[]> = {
  submitted: ['under_review', 'needs_correction', 'approved_by_henry'],
  under_review: ['needs_correction', 'approved_by_henry'],
  approved_by_henry: ['filed'],
}

export const kanbanColumns = [
  { id: 'in_progress', title: 'En Progreso' },
  { id: 'submitted', title: 'Enviados' },
  { id: 'under_review', title: 'En Revision' },
  { id: 'needs_correction', title: 'Correcciones' },
  { id: 'approved_by_henry', title: 'Aprobados' },
  { id: 'filed', title: 'Presentados' },
] as const

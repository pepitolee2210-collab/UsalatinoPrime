/**
 * Spanish labels for appointment statuses.
 *
 * Centralized because several admin views render the raw `status` column,
 * each with their own copy of the same mapping. Using this helper keeps the
 * wording consistent (so we don't end up with "Agendada" in one page and
 * "Programada" in another).
 */

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No se presentó',
}

export function appointmentStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return APPOINTMENT_STATUS_LABELS[status] ?? status
}

export const APPOINTMENT_STATUS_BADGE_STYLE: Record<string, string> = {
  scheduled: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-slate-100 text-slate-800',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-amber-100 text-amber-800',
}

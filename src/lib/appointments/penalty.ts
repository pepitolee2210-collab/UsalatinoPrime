import type { Appointment } from '@/types/database'
import { PENALTY_DAYS, MIN_CANCEL_HOURS } from './constants'

interface PenaltyResult {
  isPenalized: boolean
  canScheduleAfter: Date | null
  reason: string | null
}

/**
 * Verifica si un cliente está penalizado basado en su historial de citas.
 *
 * Penalizado si:
 * - Último appointment fue `no_show`
 * - Último appointment fue cancelado con menos de 24h de anticipación
 * Y la fecha del incidente + 7 días > ahora
 */
export function checkPenalty(appointments: Appointment[]): PenaltyResult {
  if (appointments.length === 0) {
    return { isPenalized: false, canScheduleAfter: null, reason: null }
  }

  // Ordenar por fecha descendente para encontrar el más reciente
  const sorted = [...appointments].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
  )

  const latest = sorted[0]
  const now = new Date()

  // Si Henry levanto la penalizacion, no penalizar
  if (latest.penalty_waived) {
    return { isPenalized: false, canScheduleAfter: null, reason: null }
  }

  // Caso 1: No show
  if (latest.status === 'no_show') {
    const penaltyEnd = new Date(latest.scheduled_at)
    penaltyEnd.setDate(penaltyEnd.getDate() + PENALTY_DAYS)

    if (penaltyEnd > now) {
      return {
        isPenalized: true,
        canScheduleAfter: penaltyEnd,
        reason: 'No se presentó a su última cita.',
      }
    }
  }

  // Caso 2: Cancelación tardía (< 24h de anticipación)
  if (latest.status === 'cancelled' && latest.cancelled_at) {
    const scheduledTime = new Date(latest.scheduled_at).getTime()
    const cancelledTime = new Date(latest.cancelled_at).getTime()
    const hoursBeforeAppointment = (scheduledTime - cancelledTime) / (1000 * 60 * 60)

    if (hoursBeforeAppointment < MIN_CANCEL_HOURS) {
      const penaltyEnd = new Date(latest.cancelled_at)
      penaltyEnd.setDate(penaltyEnd.getDate() + PENALTY_DAYS)

      if (penaltyEnd > now) {
        return {
          isPenalized: true,
          canScheduleAfter: penaltyEnd,
          reason: 'Canceló su última cita con menos de 24 horas de anticipación.',
        }
      }
    }
  }

  return { isPenalized: false, canScheduleAfter: null, reason: null }
}

/**
 * Server-side helpers compartidos entre los endpoints admin y employee
 * para agendar/reprogramar citas. Antes la lógica vivía duplicada en:
 *   - /api/admin/appointments/book/route.ts
 *   - /api/admin/appointments/reschedule/route.ts
 *   - /api/appointments/book/route.ts
 *
 * Centralizar evita drift cuando se modifican reglas (límite semanal,
 * antelación mínima, double-booking) y permite que el nuevo endpoint
 * /api/employee/appointments/book reuse exactamente la misma validación.
 *
 * No incluye permisos: cada endpoint resuelve role/employee_type antes
 * de llamar a estas funciones.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const MIN_ADVANCE_HOURS_DEFAULT = 24

export type BookingError =
  | { code: 'invalid_input'; message: string }
  | { code: 'case_mismatch'; message: string }
  | { code: 'already_has_appointment'; message: string }
  | { code: 'weekly_limit'; message: string }
  | { code: 'too_soon'; message: string }
  | { code: 'slot_taken'; message: string }
  | { code: 'db_error'; message: string }

export type BookingValidation = { ok: true } | { ok: false; error: BookingError }

export interface ValidateClientBookingArgs {
  client: SupabaseClient
  caseId: string
  clientId: string
  scheduledAt: string
  minAdvanceHours?: number
}

/**
 * Reglas para agendar una cita a un cliente con caso. No aplica a
 * guests/prospects (esos no tienen weekly limit ni 24h check explícito).
 */
export async function validateClientBooking(
  args: ValidateClientBookingArgs,
): Promise<BookingValidation> {
  const { client, caseId, clientId, scheduledAt } = args
  const minAdvance = args.minAdvanceHours ?? MIN_ADVANCE_HOURS_DEFAULT

  if (!caseId || !clientId || !scheduledAt) {
    return {
      ok: false,
      error: { code: 'invalid_input', message: 'case_id, client_id y scheduled_at son requeridos.' },
    }
  }

  // Antelación mínima
  const slotTime = new Date(scheduledAt).getTime()
  if (Number.isNaN(slotTime)) {
    return { ok: false, error: { code: 'invalid_input', message: 'Fecha inválida.' } }
  }
  const minTime = Date.now() + minAdvance * 60 * 60 * 1000
  if (slotTime < minTime) {
    return {
      ok: false,
      error: {
        code: 'too_soon',
        message: `Las citas se deben agendar con al menos ${minAdvance} horas de anticipación.`,
      },
    }
  }

  // Caso pertenece al cliente
  const { data: caseRow } = await client
    .from('cases')
    .select('id, client_id')
    .eq('id', caseId)
    .single()
  if (!caseRow || caseRow.client_id !== clientId) {
    return {
      ok: false,
      error: { code: 'case_mismatch', message: 'El caso no pertenece al cliente especificado.' },
    }
  }

  // No tiene cita activa
  const { data: existing } = await client
    .from('appointments')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'scheduled')
    .limit(1)
  if (existing && existing.length > 0) {
    return {
      ok: false,
      error: {
        code: 'already_has_appointment',
        message: 'Este cliente ya tiene una cita agendada. Cancele la actual antes de crear otra.',
      },
    }
  }

  // Solo 1 cita por semana (lun-dom)
  const apptDate = new Date(scheduledAt)
  const dayOfWeek = apptDate.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(apptDate)
  weekStart.setDate(apptDate.getDate() + mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const { data: weekAppts } = await client
    .from('appointments')
    .select('id')
    .eq('client_id', clientId)
    .in('status', ['scheduled', 'completed'])
    .gte('scheduled_at', weekStart.toISOString())
    .lt('scheduled_at', weekEnd.toISOString())
    .limit(1)
  if (weekAppts && weekAppts.length > 0) {
    return {
      ok: false,
      error: {
        code: 'weekly_limit',
        message: 'Este cliente ya tiene una cita esta semana. Solo se permite 1 cita por semana.',
      },
    }
  }

  return { ok: true }
}

/** Verifica si el slot exacto está libre (excluyendo opcionalmente una cita). */
export async function isSlotFree(
  client: SupabaseClient,
  scheduledAt: string,
  excludeId?: string,
): Promise<boolean> {
  let query = client
    .from('appointments')
    .select('id')
    .eq('scheduled_at', scheduledAt)
    .eq('status', 'scheduled')
    .limit(1)
  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query
  return !data || data.length === 0
}

export interface ValidateRescheduleArgs {
  client: SupabaseClient
  appointmentId: string
  scheduledAt: string
}

export async function validateReschedule(
  args: ValidateRescheduleArgs,
): Promise<
  | { ok: true; current: { case_id: string | null; scheduled_at: string } }
  | { ok: false; error: BookingError }
> {
  const { client, appointmentId, scheduledAt } = args
  if (!appointmentId || !scheduledAt) {
    return {
      ok: false,
      error: { code: 'invalid_input', message: 'appointment_id y scheduled_at son requeridos.' },
    }
  }
  const { data: appointment } = await client
    .from('appointments')
    .select('id, status, case_id, scheduled_at')
    .eq('id', appointmentId)
    .single()
  if (!appointment) {
    return {
      ok: false,
      error: { code: 'invalid_input', message: 'Cita no encontrada.' },
    }
  }
  if (appointment.status !== 'scheduled') {
    return {
      ok: false,
      error: {
        code: 'invalid_input',
        message: 'Solo se pueden reprogramar citas en estado agendada.',
      },
    }
  }
  const free = await isSlotFree(client, scheduledAt, appointmentId)
  if (!free) {
    return { ok: false, error: { code: 'slot_taken', message: 'Este horario ya fue tomado.' } }
  }
  return {
    ok: true,
    current: { case_id: appointment.case_id, scheduled_at: appointment.scheduled_at },
  }
}

/** Source value para auditoría según quién agenda. */
export function sourceForActor(args: {
  role: 'admin' | 'employee'
  employeeType?: string | null
}): string {
  if (args.role === 'admin') return 'admin'
  if (args.employeeType === 'senior_consultant') return 'consultant'
  if (args.employeeType === 'contracts_manager') return 'contracts_manager'
  return 'employee'
}

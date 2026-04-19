import type { SchedulingConfig, Appointment } from '@/types/database'
import { TIMEZONE } from './constants'

/**
 * Find the next available slot starting from a given date, looking forward
 * up to N days. Returns null if nothing opens up within the window.
 *
 * Used by the voice agent to proactively suggest the nearest appointment
 * instead of asking the prospect to pick a date.
 */
export function getNextAvailableSlot(
  startDate: Date,
  config: SchedulingConfig[],
  existingAppointments: Appointment[],
  slotDurationMinutes: number,
  blockedDates: string[],
  advanceNoticeHours: number = 2,
  lookAheadDays: number = 14,
): { iso: string; date: string } | null {
  const minStart = new Date(Date.now() + advanceNoticeHours * 60 * 60 * 1000)
  for (let offset = 0; offset < lookAheadDays; offset++) {
    const day = new Date(startDate)
    day.setUTCDate(day.getUTCDate() + offset)
    const dateStr = day.toISOString().slice(0, 10)
    if (blockedDates.includes(dateStr)) continue

    const slots = getAvailableSlots(dateStr, config, existingAppointments, slotDurationMinutes)
    for (const iso of slots) {
      if (new Date(iso).getTime() >= minStart.getTime()) {
        return { iso, date: dateStr }
      }
    }
  }
  return null
}

/**
 * Genera los slots disponibles para una fecha dada en Mountain Time.
 * Filtra slots ocupados y slots ya pasados.
 */
export function getAvailableSlots(
  date: string, // YYYY-MM-DD
  config: SchedulingConfig[],
  existingAppointments: Appointment[],
  slotDurationMinutes: number = 60
): string[] {
  // Obtener el día de la semana en MT
  const dateInMT = new Date(`${date}T12:00:00`)
  const mtDate = new Date(dateInMT.toLocaleString('en-US', { timeZone: TIMEZONE }))
  const dayOfWeek = mtDate.getDay()

  const dayConfig = config.find(c => c.day_of_week === dayOfWeek)
  if (!dayConfig || !dayConfig.is_available) return []

  // Use time_blocks if available, otherwise fall back to start_hour/end_hour
  const blocks = dayConfig.time_blocks && dayConfig.time_blocks.length > 0
    ? dayConfig.time_blocks
    : [{ start_hour: dayConfig.start_hour, end_hour: dayConfig.end_hour }]

  const slots: string[] = []
  const now = new Date()

  for (const block of blocks) {
    for (let hour = block.start_hour; hour < block.end_hour; hour++) {
      const slotDateStr = `${date}T${hour.toString().padStart(2, '0')}:00:00`

      const slotInUTC = mtToUTC(slotDateStr)
      if (!slotInUTC) continue

      if (slotInUTC <= now) continue

      const isOccupied = existingAppointments.some(apt => {
        const aptTime = new Date(apt.scheduled_at)
        return Math.abs(aptTime.getTime() - slotInUTC.getTime()) < slotDurationMinutes * 60 * 1000
      })

      if (!isOccupied) {
        slots.push(slotInUTC.toISOString())
      }
    }
  }

  return slots
}

/**
 * Convierte una fecha/hora en Mountain Time a UTC.
 */
function mtToUTC(dateTimeStr: string): Date | null {
  // Crear un Date interpretándolo como hora local, luego ajustar
  // Usamos Intl para determinar el offset actual de MT
  const tempDate = new Date(dateTimeStr + 'Z') // Start with UTC
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // Determinar el offset de MT para esta fecha
  const parts = formatter.formatToParts(tempDate)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || ''

  const mtNow = new Date(
    `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}Z`
  )

  // El offset es la diferencia entre UTC y lo que MT muestra
  const offsetMs = tempDate.getTime() - mtNow.getTime()

  // Ahora creamos el Date correcto: la hora que queremos en MT + el offset
  const [datePart, timePart] = dateTimeStr.split('T')
  const target = new Date(`${datePart}T${timePart}Z`)

  return new Date(target.getTime() + offsetMs)
}

/**
 * Formatea una fecha UTC a hora de Mountain Time para display.
 */
export function formatToMT(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Formatea una fecha UTC a fecha completa en Mountain Time.
 */
export function formatDateMT(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('es-US', {
    timeZone: TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

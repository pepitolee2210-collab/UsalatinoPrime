import { TIMEZONE } from '@/lib/appointments/constants'

/**
 * Business hours for the voice agent to connect to Henry live.
 * Monday–Saturday, 8am to 8pm Mountain Time.
 * Sunday is closed.
 */
export function isWithinBusinessHours(now: Date = new Date()): {
  open: boolean
  reason?: 'weekend' | 'before-open' | 'after-close'
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const weekday = parts.find(p => p.type === 'weekday')?.value || ''
  const hourStr = parts.find(p => p.type === 'hour')?.value || '0'
  const hour = parseInt(hourStr, 10)

  if (weekday === 'Sun') return { open: false, reason: 'weekend' }
  if (hour < 8) return { open: false, reason: 'before-open' }
  if (hour >= 20) return { open: false, reason: 'after-close' }

  return { open: true }
}

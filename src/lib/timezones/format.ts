/**
 * Centralized TZ-aware formatting helpers.
 *
 * The office books, validates and stores appointments in Mountain Time
 * (slots.ts hace la conversión MT↔UTC). Pero el display lo decide cada
 * superficie: el cliente en su zona local, Vanessa en Bogotá, Henry en
 * Utah. Estos helpers permiten pasar la timezone como parámetro en vez
 * de hardcodear `America/Denver` en cada sitio.
 *
 * No depende de date-fns-tz — usamos `Intl` para mantener la convención
 * actual del codebase.
 */

import { stateName, type UsStateCode } from './us-states'

export const OFFICE_TIMEZONE = 'America/Denver'

/** Hora corta: "9:00 AM". */
export function formatTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Fecha larga: "lunes, 15 de mayo de 2026". */
export function formatDate(
  iso: string,
  tz: string,
  locale: string = 'es-US',
): string {
  return new Date(iso).toLocaleDateString(locale, {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Fecha + hora compacta: "lun 15 may, 3:00 PM". */
export function formatDateTimeShort(
  iso: string,
  tz: string,
  locale: string = 'es-US',
): string {
  const date = new Date(iso).toLocaleDateString(locale, {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const time = formatTime(iso, tz)
  return `${date}, ${time}`
}

/** Etiqueta corta de la TZ para badges: "MT", "ET", "Bogotá". */
export function tzShortLabel(tz: string): string {
  return TZ_SHORT_LABELS[tz] ?? tz.split('/').pop()?.replace(/_/g, ' ') ?? tz
}

const TZ_SHORT_LABELS: Record<string, string> = {
  'America/Denver': 'MT',
  'America/Phoenix': 'MST',
  'America/Los_Angeles': 'PT',
  'America/Chicago': 'CT',
  'America/New_York': 'ET',
  'America/Anchorage': 'AKT',
  'Pacific/Honolulu': 'HST',
  'America/Bogota': 'Bogotá',
  'America/Lima': 'Lima',
  'America/Mexico_City': 'CDMX',
  'America/Guatemala': 'Guatemala',
  'America/Caracas': 'Caracas',
  'America/Santiago': 'Chile',
  'America/Argentina/Buenos_Aires': 'Buenos Aires',
  'America/Sao_Paulo': 'São Paulo',
}

/** Offset numérico de una TZ para un instante dado: "UTC-5". */
export function tzOffsetLabel(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date(iso))
  const offset = parts.find(p => p.type === 'timeZoneName')?.value || ''
  return offset.replace('GMT', 'UTC')
}

/**
 * Timezone del navegador. SOLO usar en client components — en server
 * components siempre devuelve la TZ del servidor (Vercel: UTC).
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || OFFICE_TIMEZONE
  } catch {
    return OFFICE_TIMEZONE
  }
}

/** Verifica si una string es una IANA timezone válida. */
export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * Etiqueta humana de la TZ para mostrar al cliente: "Eastern Time (Florida)"
 * o "Bogotá (UTC-5)". Toma un state opcional para enriquecer si es US.
 */
export function tzHumanLabel(tz: string, stateCode?: UsStateCode | null): string {
  if (stateCode) return `${tzShortLabel(tz)} · ${stateName(stateCode)}`
  return tzShortLabel(tz)
}

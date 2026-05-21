'use client'

import { useMemo } from 'react'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  OFFICE_TIMEZONE,
  getBrowserTimezone,
  tzShortLabel,
  isValidTimezone,
} from '@/lib/timezones/format'

/**
 * Combobox para seleccionar la timezone con la que el usuario quiere ver
 * y agendar sus citas. El storage de la cita es siempre UTC; este selector
 * solo afecta el display y la interpretación del slot picker.
 *
 * Lista curada — no exponemos todas las IANA porque la UI sería abrumadora
 * y casi todos nuestros usuarios están en US o Latam. Si alguien necesita
 * algo exótico, lo agregamos puntualmente.
 */

export interface TimezoneSelectorProps {
  value: string
  onChange: (tz: string) => void
  /** Ocultar opción "Auto" (útil en admin donde queremos persistencia explícita). */
  hideAuto?: boolean
  className?: string
  size?: 'sm' | 'default'
}

interface TzOption {
  value: string
  label: string
}

const US_OPTIONS: TzOption[] = [
  { value: 'America/New_York', label: 'Eastern Time · NY, FL, GA, MA…' },
  { value: 'America/Chicago', label: 'Central Time · TX, IL, MN…' },
  { value: 'America/Denver', label: 'Mountain Time · UT, CO, NM…' },
  { value: 'America/Phoenix', label: 'Arizona (sin DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time · CA, WA, NV, OR' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawái' },
]

const LATAM_OPTIONS: TzOption[] = [
  { value: 'America/Mexico_City', label: 'México (CDMX)' },
  { value: 'America/Guatemala', label: 'Guatemala / El Salvador / Honduras' },
  { value: 'America/Bogota', label: 'Colombia · Perú · Ecuador' },
  { value: 'America/Caracas', label: 'Venezuela' },
  { value: 'America/Santiago', label: 'Chile' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina / Uruguay / Paraguay' },
  { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
]

const AUTO_VALUE = '__auto__'

export function TimezoneSelector({
  value,
  onChange,
  hideAuto = false,
  className = '',
  size = 'default',
}: TimezoneSelectorProps) {
  const browserTz = useMemo(() => getBrowserTimezone(), [])

  // Si la value actual no está en la lista, la inyectamos arriba como
  // "Tu zona actual" para que el Select pueda mostrarla seleccionada
  // (evita el caso de un cliente con TZ exótica que no aparece en las
  // categorías predefinidas).
  const allListed = [...US_OPTIONS, ...LATAM_OPTIONS].map(o => o.value)
  const valueIsListed = allListed.includes(value)

  function handleChange(next: string) {
    if (next === AUTO_VALUE) {
      const tz = browserTz || OFFICE_TIMEZONE
      onChange(isValidTimezone(tz) ? tz : OFFICE_TIMEZONE)
      return
    }
    onChange(next)
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className={`${size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm'} ${className}`}>
        <SelectValue placeholder="Selecciona tu zona horaria">
          {tzShortLabel(value)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {!hideAuto && (
          <>
            <SelectItem value={AUTO_VALUE}>
              Auto-detectar — {tzShortLabel(browserTz)}
            </SelectItem>
            <SelectSeparator />
          </>
        )}
        {!valueIsListed && (
          <>
            <SelectGroup>
              <SelectLabel>Tu zona actual</SelectLabel>
              <SelectItem value={value}>{value}</SelectItem>
            </SelectGroup>
            <SelectSeparator />
          </>
        )}
        <SelectGroup>
          <SelectLabel>Estados Unidos</SelectLabel>
          {US_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Latinoamérica</SelectLabel>
          {LATAM_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

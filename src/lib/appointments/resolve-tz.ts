/**
 * Cascada para resolver la timezone con la que se debe mostrar la cita al
 * cliente.
 *
 * Prioridad (de más a menos confiable):
 *   1. `profile.preferred_timezone` — el cliente seleccionó manualmente o
 *      fue backfilleado desde su contrato.
 *   2. `contract.client_state` — snapshot del estado al firmar contrato.
 *   3. `profile.address_state` — intake del cliente.
 *   4. `browserTz` — solo en client components.
 *   5. `OFFICE_TIMEZONE` — fallback final.
 *
 * El storage de la cita siempre es UTC; esto es solo para display.
 */

import { OFFICE_TIMEZONE, isValidTimezone } from '@/lib/timezones/format'
import { normalizeStateCode, tzForState } from '@/lib/timezones/us-states'

export type TzSource = 'preferred' | 'contract' | 'profile' | 'browser' | 'office'

export interface ResolveTimezoneArgs {
  preferredTz?: string | null
  contractState?: string | null
  profileState?: string | null
  browserTz?: string | null
}

export interface ResolvedTimezone {
  tz: string
  source: TzSource
}

export function resolveClientTimezone(args: ResolveTimezoneArgs): ResolvedTimezone {
  // 1. Preferencia explícita
  if (args.preferredTz && isValidTimezone(args.preferredTz)) {
    return { tz: args.preferredTz, source: 'preferred' }
  }

  // 2. Estado del contrato (más reciente)
  const contractCode = normalizeStateCode(args.contractState ?? '')
  if (contractCode) {
    return { tz: tzForState(contractCode), source: 'contract' }
  }

  // 3. Estado del profile
  const profileCode = normalizeStateCode(args.profileState ?? '')
  if (profileCode) {
    return { tz: tzForState(profileCode), source: 'profile' }
  }

  // 4. Browser (cliente)
  if (args.browserTz && isValidTimezone(args.browserTz)) {
    return { tz: args.browserTz, source: 'browser' }
  }

  // 5. Oficina
  return { tz: OFFICE_TIMEZONE, source: 'office' }
}

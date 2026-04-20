/**
 * U.S. state → IANA timezone mapping for slot display.
 *
 * The appointment itself is stored in UTC and scheduled in the office's
 * Mountain Time calendar (see `lib/appointments/constants.ts`). This map
 * lets the WhatsApp bot echo the slot in the *client's* local time so the
 * person doesn't have to do a timezone conversion in their head.
 *
 * For states that span multiple zones (TX panhandle, FL panhandle, etc.)
 * we pick the majority zone. Edge cases fall to human review.
 */

export type UsStateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL'
  | 'GA' | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME'
  | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH'
  | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI'
  | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI'
  | 'WY'

export const STATE_TIMEZONE: Record<UsStateCode, string> = {
  // Eastern
  CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York',
  FL: 'America/New_York', GA: 'America/New_York', IN: 'America/New_York',
  ME: 'America/New_York', MD: 'America/New_York', MA: 'America/New_York',
  MI: 'America/New_York', NH: 'America/New_York', NJ: 'America/New_York',
  NY: 'America/New_York', NC: 'America/New_York', OH: 'America/New_York',
  PA: 'America/New_York', RI: 'America/New_York', SC: 'America/New_York',
  VT: 'America/New_York', VA: 'America/New_York', WV: 'America/New_York',

  // Central
  AL: 'America/Chicago', AR: 'America/Chicago', IL: 'America/Chicago',
  IA: 'America/Chicago', KS: 'America/Chicago', KY: 'America/Chicago',
  LA: 'America/Chicago', MN: 'America/Chicago', MS: 'America/Chicago',
  MO: 'America/Chicago', NE: 'America/Chicago', ND: 'America/Chicago',
  OK: 'America/Chicago', SD: 'America/Chicago', TN: 'America/Chicago',
  TX: 'America/Chicago', WI: 'America/Chicago',

  // Mountain (standard — honors DST)
  CO: 'America/Denver', MT: 'America/Denver', NM: 'America/Denver',
  UT: 'America/Denver', WY: 'America/Denver', ID: 'America/Denver',

  // Mountain Standard year-round (no DST)
  AZ: 'America/Phoenix',

  // Pacific
  CA: 'America/Los_Angeles', NV: 'America/Los_Angeles',
  OR: 'America/Los_Angeles', WA: 'America/Los_Angeles',

  // Non-contiguous
  AK: 'America/Anchorage',
  HI: 'Pacific/Honolulu',
}

/** State name / code → canonical 2-letter code. Case-insensitive. */
const STATE_NAME_TO_CODE: Record<string, UsStateCode> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR',
  california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  'district of columbia': 'DC', washington_dc: 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
  minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY',
}

/**
 * Resolve a free-text input ("texas", "TX", "Tejas") to a canonical code.
 * Returns null for input we can't confidently map — callers should ask again.
 */
export function normalizeStateCode(input: string): UsStateCode | null {
  if (!input) return null
  const cleaned = input.trim().toLowerCase()
  if (cleaned.length === 2) {
    const upper = cleaned.toUpperCase() as UsStateCode
    return upper in STATE_TIMEZONE ? upper : null
  }
  return STATE_NAME_TO_CODE[cleaned] ?? null
}

export function tzForState(state: string): string {
  const code = normalizeStateCode(state)
  if (!code) return 'America/Denver' // office default
  return STATE_TIMEZONE[code]
}

// Prefill builder para USCIS Form I-130 (Petition for Alien Relative).
//
// Caso base: petición por MATRIMONIO. El peticionario es el esposo ciudadano
// estadounidense y es el `client_id` del caso. La beneficiaria es su cónyuge
// extranjero/a, cuyos datos se capturan a mano en la Parte 4 (no hay perfil
// de la beneficiaria en BD).
//
// Por eso este prefill llena SOLO la Parte 2 (información del peticionario) y
// la Parte 6 (contacto del peticionario) desde `profiles[client_id]`, más los
// valores fijos del caso por matrimonio (relación = Spouse, estado civil =
// casado, ciudadanía = U.S. Citizen). La Parte 4 (cónyuge) queda para llenado
// manual del cliente / equipo legal, y luego el I-485 la reutiliza (cross-form).
//
// Patrón clonado de i485-prefill.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'

const log = createLogger('i130-prefill')

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function formatDateMMDDYYYY(value: string | null | undefined): string {
  if (!value) return ''
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`
  return String(value)
}

function formatPhone(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11 && d.startsWith('1')) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  return String(raw ?? '')
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return ''
}

function inferSex(...values: unknown[]): 'F' | 'M' | '' {
  for (const v of values) {
    const s = String(v ?? '').toLowerCase().trim()
    if (!s) continue
    if (/^(f|female|femenino|mujer)/.test(s)) return 'F'
    if (/^(m|male|masculino|hombre|varon|varón)/.test(s)) return 'M'
  }
  return ''
}

// Los dropdowns de estado del I-130 usan el código USPS de 2 letras. Normaliza
// nombres completos comunes; si ya es un código de 2 letras lo deja igual.
const US_STATE_CODES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'puerto rico': 'PR',
}

function usStateCode(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase()
  return US_STATE_CODES[s.toLowerCase()] ?? ''
}

// ──────────────────────────────────────────────────────────────────
// Builder principal
// ──────────────────────────────────────────────────────────────────

export async function buildI130PrefilledValues(
  caseId: string,
  service: SupabaseClient,
): Promise<Record<string, string | boolean | null | undefined>> {
  const caseRes = await service
    .from('cases')
    .select('client_id, state_us')
    .eq('id', caseId)
    .single()
  const clientId = caseRes.data?.client_id ?? null
  const stateUs = (caseRes.data?.state_us as string | null) ?? ''

  const profileRes = clientId
    ? await service
        .from('profiles')
        .select(
          'first_name, last_name, middle_name, date_of_birth, country_of_birth, nationality, gender, a_number, uscis_account_number, ssn, address_street, address_city, address_state, address_zip, phone, email',
        )
        .eq('id', clientId)
        .single()
    : { data: null }

  const profile = (profileRes.data ?? {}) as Record<string, unknown>

  const out: Record<string, string | boolean | null | undefined> = {}

  // ─── Parte 1 — Relación (Spouse) ────────────────────────────────
  // Hardcoded en el schema (pt1line1_spouse), pero lo reforzamos aquí.
  out['pt1line1_spouse'] = true

  // ─── Parte 2 — Información sobre el peticionario (esposo ciudadano) ──
  out['pt2line4a_familyname'] = pickString(profile.last_name)
  out['pt2line4b_givenname'] = pickString(profile.first_name)
  const middle = pickString(profile.middle_name)
  if (middle) out['pt2line4c_middlename'] = middle

  const ssn = pickString(profile.ssn)
  if (ssn) out['pt2line11_ssn'] = ssn

  const dob = formatDateMMDDYYYY(pickString(profile.date_of_birth))
  if (dob) out['pt2line8_dateofbirth'] = dob

  const sex = inferSex(profile.gender)
  if (sex === 'M') out['pt2line9_male'] = true
  else if (sex === 'F') out['pt2line9_female'] = true

  const countryOfBirth = pickString(profile.country_of_birth)
  if (countryOfBirth) out['pt2line7_countryofbirth'] = countryOfBirth

  // Dirección postal (item 10)
  const street = pickString(profile.address_street)
  const city = pickString(profile.address_city)
  const stateCode = usStateCode(pickString(profile.address_state, stateUs))
  const zip = pickString(profile.address_zip)
  if (street) out['pt2line10_streetnumbername'] = street
  if (city) out['pt2line10_cityortown'] = city
  if (stateCode) out['pt2line10_state'] = stateCode
  if (zip) out['pt2line10_zipcode'] = zip
  if (street || city) out['pt2line10_country'] = 'United States'

  // Estado civil del peticionario: casado (este servicio es por matrimonio).
  out['pt2line17_married'] = true

  // Ciudadanía: el peticionario es ciudadano estadounidense (item 36).
  out['pt2line36_uscitizen'] = true

  // Cuenta USCIS Online (header), si la tiene.
  const uscisOnline = pickString(profile.uscis_account_number)
  if (uscisOnline) out['uscisonlineacctnumber'] = uscisOnline

  // ─── Parte 6 — Contacto del peticionario ────────────────────────
  const phone = formatPhone(pickString(profile.phone))
  if (phone) {
    out['pt6line3_daytimephonenumber'] = phone
    out['pt6line4_mobilenumber'] = phone
  }
  const email = pickString(profile.email)
  if (email) out['pt6line5_email'] = email

  // ─── Parte 4 — Beneficiaria (cónyuge): se llena a mano ──────────
  // No hay perfil de la beneficiaria en BD; el cliente/equipo legal completa
  // la Parte 4. El I-485 reutilizará esos datos vía cross-form.

  log.info('buildI130PrefilledValues', {
    caseId,
    populated: Object.keys(out).filter((k) => out[k] !== '' && out[k] !== undefined).length,
  })

  return out
}

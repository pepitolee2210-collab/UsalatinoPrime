// Prefill builder para el I-485 del servicio "Ajuste de Estatus por Matrimonio".
//
// La solicitante del I-485 es la CÓNYUGE extranjera (beneficiaria del I-130),
// pero el `client_id` del caso es el ESPOSO ciudadano (peticionario). Por eso:
//
//   • Parte 1 (información de la solicitante = la esposa) → se REUTILIZA del
//     I-130 ya llenado (cross-form): los datos de la Parte 4 del I-130
//     (beneficiaria) viven en case_form_instances.filled_values del form
//     'USCIS Form I-130'.
//   • Parte 6 (historial marital → cónyuge actual = el esposo) → del perfil
//     del client_id.
//   • Dirección y contacto → del perfil (normalmente conviven).
//
// Degrada con gracia: si el I-130 aún no se ha llenado, la Parte 1 queda vacía
// y el equipo legal la completa a mano (ver computeLegalWarnings en el registry).
//
// INDEPENDIENTE del prefill SIJS (i485-prefill.ts), que no se toca.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'
import { FORM_NAME as I130_FORM_NAME } from './i130-form-schema'

const log = createLogger('i485-matrimonio-prefill')

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

// Los dropdowns de estado del I-485 usan el código USPS de 2 letras.
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

export async function buildI485MatrimonioPrefilledValues(
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

  const [profileRes, i130Res] = await Promise.all([
    clientId
      ? service
          .from('profiles')
          .select(
            'first_name, last_name, middle_name, date_of_birth, country_of_birth, a_number, address_street, address_city, address_state, address_zip, phone, email',
          )
          .eq('id', clientId)
          .single()
      : Promise.resolve({ data: null }),
    service
      .from('case_form_instances')
      .select('filled_values')
      .eq('case_id', caseId)
      .eq('form_name', I130_FORM_NAME)
      .maybeSingle(),
  ])

  const profile = (profileRes.data ?? {}) as Record<string, unknown>
  const i130 = ((i130Res.data?.filled_values ?? {}) as Record<string, unknown>) || {}

  const out: Record<string, string | boolean | null | undefined> = {}

  // ─── Parte 1 — Información de la solicitante (la esposa) ──────────
  // Cross-form: datos de la beneficiaria capturados en la Parte 4 del I-130.
  const lastName = pickString(i130['pt4line4a_familyname'])
  const firstName = pickString(i130['pt4line4b_givenname'])
  const middleName = pickString(i130['pt4line4c_middlename'])
  if (lastName) out['pt1line1_familyname'] = lastName
  if (firstName) out['pt1line1_givenname'] = firstName
  if (middleName) out['pt1line1_middlename'] = middleName

  const dob = formatDateMMDDYYYY(pickString(i130['pt4line9_dateofbirth']))
  if (dob) out['pt1line3_dob'] = dob

  // Sexo de la solicitante: pt1line6_cb_sex (index 0 = F) / _1 (index 1 = M).
  if (i130['pt4line9_female'] === true) {
    out['pt1line6_cb_sex'] = true
    out['pt1line6_cb_sex_1'] = false
  } else if (i130['pt4line9_male'] === true) {
    out['pt1line6_cb_sex'] = false
    out['pt1line6_cb_sex_1'] = true
  }

  const cityOfBirth = pickString(i130['pt4line7_citytownofbirth'])
  if (cityOfBirth) out['pt1line7_citytownofbirth'] = cityOfBirth
  const countryOfBirth = pickString(i130['pt4line8_countryofbirth'])
  if (countryOfBirth) out['pt1line7_countryofbirth'] = countryOfBirth

  const passportNum = pickString(i130['pt4line22_passportnumber'])
  if (passportNum) out['pt1line10_passportnum'] = passportNum

  // ─── Dirección física actual de la solicitante (Parte 1, item 18) ──
  // La pareja normalmente convive → se usa la dirección del perfil del esposo.
  const street = pickString(profile.address_street)
  const city = pickString(profile.address_city)
  const stateCode = usStateCode(pickString(profile.address_state, stateUs))
  const zip = pickString(profile.address_zip)
  if (street) out['pt1line18_streetnumbername'] = street
  if (city) out['pt1line18_cityortown'] = city
  if (stateCode) out['pt1line18_state'] = stateCode
  if (zip) out['pt1line18_zipcode'] = zip

  // ─── Parte 3 — Contacto de la solicitante (del I-130 Pt4, o del perfil) ──
  const phone = formatPhone(pickString(i130['pt4line14_daytimephonenumber'], profile.phone))
  if (phone) {
    out['pt3line3_daytimephonenumber1'] = phone
    out['p3_line4_daytimetelephonenumber'] = phone
  }
  const email = pickString(i130['pt4line16_emailaddress'], profile.email)
  if (email) {
    out['pt3line5_email'] = email
    out['p3_line6_email'] = email
  }

  // ─── Parte 6 — Historial marital: Casada + cónyuge actual (el esposo) ──
  out['pt6line1_maritalstatus_3'] = true // on='2' = Married
  out['pt6line4_familyname'] = pickString(profile.last_name)
  out['pt6line4_givenname'] = pickString(profile.first_name)
  const spouseMiddle = pickString(profile.middle_name)
  if (spouseMiddle) out['pt6line4_middlename'] = spouseMiddle
  const spouseDob = formatDateMMDDYYYY(pickString(profile.date_of_birth))
  if (spouseDob) out['pt6line16_dateofbirth'] = spouseDob
  const spouseCountry = pickString(profile.country_of_birth)
  if (spouseCountry) out['pt6line10_country'] = spouseCountry
  const spouseANumber = pickString(profile.a_number).replace(/\s/g, '')
  if (spouseANumber) out['pt6line5_aliennumber'] = spouseANumber.replace(/^A?/i, '')

  log.info('buildI485MatrimonioPrefilledValues', {
    caseId,
    hasI130: Object.keys(i130).length > 0,
    populated: Object.keys(out).filter((k) => out[k] !== '' && out[k] !== undefined).length,
  })

  return out
}

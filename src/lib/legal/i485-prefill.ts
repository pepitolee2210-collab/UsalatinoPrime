// Prefill builder para USCIS Form I-485.
//
// Construye un mapping `semanticKey → valor` con datos que ya tenemos en BD,
// para que el cliente vea muchos campos pre-rellenados al abrir el formulario.
//
// Fuentes prioritarias (de más confiable a menos):
//   1. case_form_submissions con form_type='i360_sijs' — el I-360 ya fue llenado
//      en Fase 2 con los datos del beneficiary (el menor) y suele estar revisado.
//   2. case_form_submissions con form_type='client_story' (minorBasic) —
//      datos del menor capturados en la historia.
//   3. case_form_submissions con form_type='tutor_guardian' — del tutor.
//   4. profiles del client_id del caso — cuenta del adulto/cliente.
//   5. cases.state_us — estado donde está el caso.
//
// El cliente y Diana pueden sobrescribir cualquier valor pre-rellenado
// (saved_values gana siempre en el merge final del print).
//
// Patrón clonado de sapcr100-prefill.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'

const log = createLogger('i485-prefill')

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
    if (/^(f|female|femenino|mujer|niña)/.test(s)) return 'F'
    if (/^(m|male|masculino|hombre|niño|varon|varón)/.test(s)) return 'M'
  }
  return ''
}

// ──────────────────────────────────────────────────────────────────
// Builder principal
// ──────────────────────────────────────────────────────────────────

export async function buildI485PrefilledValues(
  caseId: string,
  service: SupabaseClient,
): Promise<Record<string, string | boolean | null | undefined>> {
  const caseRes = await service
    .from('cases')
    .select('client_id, state_us, current_phase, parent_deceased')
    .eq('id', caseId)
    .single()
  const clientId = caseRes.data?.client_id ?? null
  const stateUs = (caseRes.data?.state_us as string | null) ?? ''

  const [profileRes, i360Res, storyRes, tutorRes] = await Promise.all([
    clientId
      ? service
          .from('profiles')
          .select(
            'first_name, last_name, middle_name, date_of_birth, country_of_birth, nationality, gender, marital_status, a_number, uscis_account_number, ssn, address_street, address_city, address_state, address_zip, phone, email, last_entry_date, entry_status, i94_number, passport_number, passport_country, passport_expiry',
          )
          .eq('id', clientId)
          .single()
      : Promise.resolve({ data: null }),
    service
      .from('case_form_submissions')
      .select('form_data')
      .eq('case_id', caseId)
      .eq('form_type', 'i360_sijs')
      .maybeSingle(),
    service
      .from('case_form_submissions')
      .select('form_data')
      .eq('case_id', caseId)
      .eq('form_type', 'client_story')
      .maybeSingle(),
    service
      .from('case_form_submissions')
      .select('form_data')
      .eq('case_id', caseId)
      .eq('form_type', 'tutor_guardian')
      .maybeSingle(),
  ])

  const profile = (profileRes.data ?? {}) as Record<string, unknown>
  const i360 = ((i360Res.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const story = ((storyRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const tutor = ((tutorRes.data?.form_data ?? {}) as Record<string, unknown>) || {}

  // El I-485 se llena para EL MENOR (beneficiary). Las fuentes preferidas son
  // el i360_sijs y client_story.minorBasic — no el profile del cliente
  // (que típicamente es la madre/tutor).
  const i360Beneficiary = (i360.beneficiary ?? i360.minor ?? {}) as Record<string, unknown>
  const minorBasic = (story.minorBasic ?? story.minor ?? {}) as Record<string, unknown>

  const out: Record<string, string | boolean | null | undefined> = {}

  // ─── Part 1 — Información sobre ti (el menor) ────────────────────

  const lastName = pickString(
    i360Beneficiary.last_name,
    minorBasic.last_name,
    minorBasic.familyName,
    profile.last_name,
  )
  const firstName = pickString(
    i360Beneficiary.first_name,
    minorBasic.first_name,
    minorBasic.givenName,
    profile.first_name,
  )
  const middleName = pickString(
    i360Beneficiary.middle_name,
    minorBasic.middle_name,
    profile.middle_name,
  )
  out['pt1line1_familyname'] = lastName
  out['pt1line1_givenname'] = firstName
  out['pt1line1_middlename'] = middleName

  // A-Number (Pt1Line4_AlienNumber + Pt1Line4_YN si tiene)
  const aNumber = pickString(i360Beneficiary.a_number, profile.a_number).replace(/\s/g, '')
  if (aNumber) {
    out['pt1line4_aliennumber'] = aNumber.replace(/^A?/i, '')
    out['pt1line4_yn'] = true            // Sí, tengo A-Number
  }

  // USCIS Online Account Number
  const uscisOnline = pickString(profile.uscis_account_number)
  if (uscisOnline) out['pt1line9_usciso'] = uscisOnline

  // Date of Birth
  const dob = formatDateMMDDYYYY(
    pickString(i360Beneficiary.dob, minorBasic.dob, profile.date_of_birth),
  )
  if (dob) {
    out['pt1line3_dob'] = dob
    out['pt1line5_dob'] = dob // algunas variantes
  }

  // Sex / Gender — checkbox group F/M
  const sex = inferSex(i360Beneficiary.sex, i360Beneficiary.gender, minorBasic.gender, profile.gender)
  if (sex === 'F') {
    out['pt1line6_cb_sex'] = true     // index 0 = F
    out['pt1line6_cb_sex_1'] = false  // index 1 = M
  } else if (sex === 'M') {
    out['pt1line6_cb_sex'] = false
    out['pt1line6_cb_sex_1'] = true
  }

  // City/Country of Birth
  const cityOfBirth = pickString(
    i360Beneficiary.city_of_birth,
    minorBasic.city_of_birth,
    minorBasic.birthCity,
  )
  if (cityOfBirth) out['pt1line7_citytownofbirth'] = cityOfBirth

  const countryOfBirth = pickString(
    i360Beneficiary.country_of_birth,
    minorBasic.country_of_birth,
    profile.country_of_birth,
  )
  if (countryOfBirth) out['pt1line7_countryofbirth'] = countryOfBirth

  // Country of Citizenship
  const citizenship = pickString(
    i360Beneficiary.country_of_citizenship,
    minorBasic.country_of_citizenship,
    profile.nationality,
  )
  if (citizenship) out['pt1line8_countryofcitizenshipnationality'] = citizenship

  // Passport (Pt1Line10)
  const passportNum = pickString(profile.passport_number)
  if (passportNum) out['pt1line10_passportnum'] = passportNum
  const passportExp = formatDateMMDDYYYY(pickString(profile.passport_expiry))
  if (passportExp) out['pt1line10_expdate'] = passportExp

  // Last arrival date (Pt1Line10_DateofArrival)
  const lastEntry = formatDateMMDDYYYY(pickString(profile.last_entry_date))
  if (lastEntry) out['pt1line10_dateofarrival'] = lastEntry

  // I-94 number (P1Line12_I94)
  const i94 = pickString(profile.i94_number)
  if (i94) out['p1line12_i94'] = i94

  // ─── Part 4 — Address (mailing + physical) ────────────────────────
  // El I-485 tiene dos bloques de dirección. Pre-rellenamos la actual del
  // perfil/tutor para ambos; el cliente o Diana ajusta si es distinto.

  const street = pickString(profile.address_street, tutor.full_address)
  const city = pickString(profile.address_city)
  const stateAddr = pickString(profile.address_state, stateUs)
  const zip = pickString(profile.address_zip)

  // Bloque 7 (mailing address)
  if (street) out['p4line7_streetname'] = street
  if (city) out['p4line7_city'] = city
  if (stateAddr) out['p4line7_state'] = stateAddr
  if (zip) out['p4line7_zipcode'] = zip

  // Bloque 8 (physical address) — copia
  if (street) out['p4line8_streetname'] = street
  if (city) out['p4line8_city'] = city
  if (stateAddr) out['p4line8_state'] = stateAddr
  if (zip) out['p4line8_zipcode'] = zip

  // ─── Part 6 — Marital Status (en SIJS típicamente single = '1') ───
  // El catalog de USCIS para I-485 Pt6Line1_MaritalStatus es checkbox group
  // con on values: 1=Single, 2=Married, 3=Divorced, 4=Widowed, 5=Marriage Annulled, 7=Other
  const maritalStatus = String(profile.marital_status ?? '').toLowerCase()
  if (maritalStatus.includes('single') || maritalStatus.includes('soltero')) {
    out['pt6line1_maritalstatus_1'] = true // index 1 = "1" Single
  } else if (maritalStatus.includes('married') || maritalStatus.includes('casado')) {
    out['pt6line1_maritalstatus_3'] = true // index 3 = "2" Married
  }

  // ─── Part 3 — Información de contacto ────────────────────────────

  const phone = formatPhone(pickString(profile.phone, tutor.phone))
  if (phone) {
    out['pt3line3_daytimephonenumber1'] = phone
    out['p3_line4_daytimetelephonenumber'] = phone
  }
  const email = pickString(profile.email, tutor.email)
  if (email) {
    out['pt3line5_email'] = email
    out['p3_line6_email'] = email
  }

  log.info('buildI485PrefilledValues', {
    caseId,
    populated: Object.keys(out).filter((k) => out[k] !== '' && out[k] !== undefined).length,
  })

  return out
}

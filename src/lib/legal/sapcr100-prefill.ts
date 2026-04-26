// Construye los valores prellenados del SAPCR-100 a partir de los datos
// existentes en BD para un caso específico. Devuelve un Partial<SapcrFormValues>
// que se mergea con los `filled_values` guardados en case_form_instances
// (saved values WIN — el admin manda).
//
// La fuente de verdad de qué campos se derivan de dónde es el array
// `deriveFrom` en sapcr100-form-schema.ts. Aquí construimos un "data bag"
// con todas las fuentes posibles y luego resolvemos cada `deriveFrom` con
// notación dot/index.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_FIELDS, HARDCODED_SIJS_VALUES, type SapcrFormValues } from './sapcr100-form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('sapcr100-prefill')

// ──────────────────────────────────────────────────────────────────
// Tipos del data bag (lo que se construye consultando la BD)
// ──────────────────────────────────────────────────────────────────

interface DataBag {
  petitioner: {
    full_name: string
    first_name: string
    last_name: string
    phone: string
    email: string
    full_address: string
    ssn_last3: [string, string, string]
    no_ssn: boolean
    dl_state: string
    no_dl: boolean
    relationship_en: string
    standing: {
      mother: boolean
      father: boolean
      caregiver_6mo: boolean
      relative: boolean
    }
  }
  child_1: {
    full_name: string
    initials: string
    dob: string
    lives_county_state: string
  }
  respondent_a: {
    full_name: string
    is_alleged_father: boolean
    alleged_father_children: string
    service_address: string
    publication: boolean
    lives_outside_tx: boolean
    full_name_if_oos: string
  }
  jurisdiction: {
    county: string
    court_number: string
    state_code: string
    lived_tx_6mo: boolean
  }
  minor: {
    medicaid: boolean
    medicaid_now_or_past: boolean
  }
  /** Defaults SIJS — editables por el admin pero pre-marcados. */
  sijs_defaults: {
    mother_sole_mc: boolean
    exclusive_passport: boolean
    spo_unworkable: boolean
    no_possession: boolean
    safety_concern_father: boolean
    kidnapping_concern: boolean
    confidentiality: boolean
    no_protective_order: boolean
    child_no_property: boolean
    health_father_unavailable: boolean
    dental_father_unavailable: boolean
    possession_text: string
  }
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('.') + (fullName.trim() ? '.' : '')
}

function lastNDigits(value: string | null | undefined, n: number): string[] {
  if (!value) return Array(n).fill('')
  const digits = String(value).replace(/\D/g, '')
  if (digits.length < n) return Array(n).fill('')
  const last = digits.slice(-n).split('')
  return last.length === n ? last : Array(n).fill('')
}

function formatDateMMDDYYYY(value: string | null | undefined): string {
  if (!value) return ''
  // Acepta YYYY-MM-DD o ya MM/DD/YYYY
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

function get(bag: unknown, path: string): unknown {
  if (!path) return undefined
  const parts = path.split('.')
  let cur: unknown = bag
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined
    const idxMatch = part.match(/^(\d+)$/)
    if (idxMatch && Array.isArray(cur)) {
      cur = cur[Number(idxMatch[1])]
      continue
    }
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

// ──────────────────────────────────────────────────────────────────
// Construcción del data bag
// ──────────────────────────────────────────────────────────────────

async function buildDataBag(
  caseId: string,
  service: SupabaseClient
): Promise<DataBag> {
  const caseRes = await service.from('cases').select('client_id').eq('id', caseId).single()
  const clientId = caseRes.data?.client_id ?? null

  const [profileRes, tutorRes, storyRes, jurisdictionRes] = await Promise.all([
    clientId
      ? service
          .from('profiles')
          .select('first_name, last_name, phone, email, ssn, address_state, address_city, address_zip, address_street')
          .eq('id', clientId)
          .single()
      : Promise.resolve({ data: null }),
    service
      .from('case_form_submissions')
      .select('form_data')
      .eq('case_id', caseId)
      .eq('form_type', 'tutor_guardian')
      .maybeSingle(),
    service
      .from('case_form_submissions')
      .select('form_data')
      .eq('case_id', caseId)
      .eq('form_type', 'client_story')
      .maybeSingle(),
    service
      .from('case_jurisdictions')
      .select('state_code, state_name, client_zip, court_name, court_address')
      .eq('case_id', caseId)
      .maybeSingle(),
  ])

  const profile = (profileRes.data ?? {}) as Record<string, unknown>
  const tutor = ((tutorRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const story = ((storyRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const jurisdiction = (jurisdictionRes.data ?? {}) as Record<string, unknown>

  const minorBasic = ((story.minorBasic as Record<string, unknown>) ?? {})

  // Petitioner = el tutor/peticionario (típicamente la madre del menor en SIJS).
  const petitionerFullName =
    (tutor.full_name as string) ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
    ''

  const petitionerAddress =
    (tutor.full_address as string) ||
    [profile.address_street, profile.address_city, profile.address_state, profile.address_zip]
      .filter(Boolean)
      .join(', ')

  const ssn = (profile.ssn as string) ?? ''
  const ssnLast3 = lastNDigits(ssn, 3) as [string, string, string]

  // Standing del peticionario (deriva de relationship_to_minor).
  const relRaw = String(tutor.relationship_to_minor ?? '').trim().toLowerCase()
  const isMother = relRaw.includes('madre') || relRaw.includes('mother')
  const isFather = relRaw === 'padre' || relRaw === 'father'
  const isCaregiver = relRaw.includes('cuidador') || relRaw.includes('caregiver')
  const isRelative = relRaw.includes('abuela') || relRaw.includes('abuelo') || relRaw.includes('tío') || relRaw.includes('tia') || relRaw.includes('grandmother') || relRaw.includes('grandfather') || relRaw.includes('aunt') || relRaw.includes('uncle')

  // Padre ausente — heurística por relato de abandono. Para SIJS, casi siempre
  // viene de tutor.who_perpetrated o de la narrativa minorAbuse.
  const respondentName =
    (tutor.absent_parent_name as string) ||
    (tutor.who_perpetrated as string) ||
    ''

  // ¿Vive fuera de TX el respondent? Heurística: si la jurisdicción del caso es
  // TX y el relato menciona Honduras/México/Guatemala/El Salvador/etc., es safe
  // marcar lives_outside_tx = true.
  const abuseDescription = String(tutor.abuse_description ?? '')
  const livesOutsideTx = /honduras|mexico|méxico|guatemala|el salvador|nicaragua|colombia|venezuela|ecuador|peru|perú|brasil|chile|argentina|cuba/i.test(
    `${abuseDescription} ${tutor.absent_parent_country ?? ''}`
  )

  // Initials del menor (B.Y.R.V. para "Brandon Yair Ramirez Velasquez").
  const childFullName = String(minorBasic.full_name ?? '')
  const childInitials = initials(childFullName)
  const childDob = formatDateMMDDYYYY(String(minorBasic.dob ?? ''))

  // Defaults SIJS: marcados true salvo que el admin los desmarque manualmente.
  const sijsDefaults = {
    mother_sole_mc: isMother,                           // CRÍTICO predicate finding
    exclusive_passport: true,                            // siempre para SIJS
    spo_unworkable: livesOutsideTx,                      // si padre fuera de US, SPO no aplica
    no_possession: livesOutsideTx,                       // sin acceso si padre ausente
    safety_concern_father: !!abuseDescription,           // si hay relato de abuso
    kidnapping_concern: livesOutsideTx,                  // passport hold si padre fuera de US
    confidentiality: true,                                // siempre para casos sensibles
    no_protective_order: true,                            // típicamente no hay PO previo
    child_no_property: true,                              // menor sin propiedad
    health_father_unavailable: livesOutsideTx,           // padre desempleado típicamente
    dental_father_unavailable: livesOutsideTx,
    possession_text: livesOutsideTx
      ? `No possession or access by Father at this time given his complete abandonment of the child and current absence from the United States. Father has been absent from the child's life with no significant contact, financial support, or parental engagement.`
      : '',
  }

  return {
    petitioner: {
      full_name: petitionerFullName,
      first_name: String(profile.first_name ?? ''),
      last_name: String(profile.last_name ?? ''),
      phone: formatPhone(String(profile.phone ?? '')),
      email: String(profile.email ?? ''),
      full_address: petitionerAddress,
      ssn_last3: ssnLast3,
      no_ssn: !ssn,
      dl_state: '',                  // no se recopila en intake
      no_dl: true,                    // default — admin puede destildar
      relationship_en: isMother ? 'mother' : isFather ? 'father' : isCaregiver ? 'caregiver' : '',
      standing: {
        mother: isMother,
        father: isFather,
        caregiver_6mo: isCaregiver,
        relative: isRelative,
      },
    },
    child_1: {
      full_name: childFullName,
      initials: childInitials,
      dob: childDob,
      lives_county_state: (jurisdiction.state_code as string)
        ? `${(jurisdiction.court_name as string ?? '').match(/Harris|Travis|Dallas|Bexar|Tarrant|Collin|Denton|Fort Bend|Williamson|El Paso|Hidalgo/i)?.[0] ?? ''} County, ${jurisdiction.state_name ?? ''}`.replace(/^\s*County,/, '').trim()
        : '',
    },
    respondent_a: {
      full_name: respondentName,
      is_alleged_father: !!respondentName,
      alleged_father_children: childFullName || '',
      service_address: '',
      publication: livesOutsideTx,
      lives_outside_tx: livesOutsideTx,
      full_name_if_oos: livesOutsideTx ? respondentName : '',
    },
    jurisdiction: {
      county: ((jurisdiction.court_name as string) ?? '').match(/(\w+)\s+County/i)?.[1] ?? '',
      court_number: '',
      state_code: String(jurisdiction.state_code ?? ''),
      lived_tx_6mo: String(jurisdiction.state_code ?? '').toUpperCase() === 'TX',
    },
    minor: {
      medicaid: false,                  // FALTANTE EN INTAKE
      medicaid_now_or_past: false,
    },
    sijs_defaults: sijsDefaults,
  }
}

// ──────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────

/**
 * Construye los valores prellenados del SAPCR-100 desde la BD del caso.
 * - Aplica primero los `hardcoded` universales (que el admin puede sobreescribir).
 * - Luego aplica los `deriveFrom` resueltos contra el data bag.
 * - Devuelve un Partial<SapcrFormValues> — campos sin fuente quedan undefined.
 */
export async function buildSapcrPrefilledValues(
  caseId: string,
  service: SupabaseClient
): Promise<Partial<SapcrFormValues>> {
  const bag = await buildDataBag(caseId, service)
  const out: Record<string, string | boolean> = { ...HARDCODED_SIJS_VALUES }

  for (const f of ALL_FIELDS) {
    if (!f.deriveFrom) continue
    const v = get(bag, f.deriveFrom)
    if (v === undefined || v === null) continue
    if (typeof v === 'boolean' || typeof v === 'string') {
      out[f.semanticKey] = v
    } else if (typeof v === 'number') {
      out[f.semanticKey] = String(v)
    }
  }

  log.info('prefill computed', { caseId, fieldsWithValues: Object.keys(out).length })
  return out as Partial<SapcrFormValues>
}

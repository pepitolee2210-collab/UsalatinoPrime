// Construye los valores prellenados del PR-GEN-116 (Texas Civil Case Information
// Sheet) desde la BD del caso. Sigue el mismo patrón que sapcr100-prefill.ts y
// sapcr-aff-100-prefill.ts: data bag → resolución de `deriveFrom`.
//
// Reusa las mismas fuentes que SAPCR-100 (profiles + tutor_guardian +
// client_story.minorBasic + case_jurisdictions) y, adicionalmente, lee la
// instancia ya rellenada del SAPCR-100 (`case_form_instances`) para extraer
// datos consolidados que el admin/cliente ya capturó al llenar la petición.
//
// Esto evita que el admin tenga que escribir el mismo nombre del menor o el
// nombre del padre demandado dos veces (una en SAPCR-100 y otra aquí).

import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_FIELDS, HARDCODED_VALUES, type CcisFormValues } from './pr-gen-116-form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('pr-gen-116-prefill')

// ──────────────────────────────────────────────────────────────────
// Tipos del data bag
// ──────────────────────────────────────────────────────────────────

interface DataBag {
  petitioner: {
    full_name: string
    email: string
    phone: string
    street: string
    city_state_zip: string
  }
  parties: {
    plaintiff_1: string
    defendant_1: string
    custodial_parent: string
    non_custodial_parent: string
  }
  caption: {
    styled: string
  }
  person_completing: {
    pro_se: boolean
  }
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

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

function cleanText(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  return String(raw).replace(/\r\n/g, '\n').replace(/\\n/g, '\n').trim()
}

function formatPhone(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11 && d.startsWith('1')) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  return String(raw ?? '')
}

/** Genera iniciales tipo "B.Y.R.V." a partir de "Brandon Yair Ramirez Velasquez". */
function initials(fullName: string): string {
  const parts = fullName.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  return parts.map((n) => n[0]?.toUpperCase() ?? '').join('.') + '.'
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

  const [profileRes, tutorRes, storyRes, jurisdictionRes, sapcr100Res] = await Promise.all([
    clientId
      ? service
          .from('profiles')
          .select('first_name, last_name, phone, email, address_state, address_city, address_zip, address_street')
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
      .select('state_code, state_name, court_name')
      .eq('case_id', caseId)
      .maybeSingle(),
    // Reusa lo ya rellenado en la SAPCR-100 (si existe) para que `defendant_respondent_1`
    // tome el mismo "Padre" que el peticionario ya escribió allá.
    service
      .from('case_form_instances')
      .select('filled_values')
      .eq('case_id', caseId)
      .eq('packet_type', 'merits')
      .eq('form_name', 'TX FM-SAPCR-100 Petition')
      .maybeSingle(),
  ])

  const profile = (profileRes.data ?? {}) as Record<string, unknown>
  const tutor = ((tutorRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const story = ((storyRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const jurisdiction = (jurisdictionRes.data ?? {}) as Record<string, unknown>
  const sapcr = ((sapcr100Res.data?.filled_values ?? {}) as Record<string, unknown>) || {}

  const minorBasic = ((story.minorBasic as Record<string, unknown>) ?? {})

  // Petitioner = el cliente del caso (típicamente la madre en SIJS).
  const petitionerFullName = cleanText(
    tutor.full_name
      || (sapcr.petitioner_full_name as string)
      || [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  )

  const street = cleanText(profile.address_street) || ''
  const city = cleanText(profile.address_city)
  const stateCode = cleanText(profile.address_state)
  const zip = cleanText(profile.address_zip)
  const cityStateZip = [city, stateCode, zip].filter(Boolean).join(', ').trim()

  // Si no hay address en profile, intentar parsear el "petitioner_mailing_address" del SAPCR-100.
  // Formato típico: "2500 West Mount Houston Road #251 houston tx 77038"
  let derivedStreet = street
  let derivedCityStateZip = cityStateZip
  if (!derivedStreet && typeof sapcr.petitioner_mailing_address === 'string') {
    const sapcrAddr = sapcr.petitioner_mailing_address.trim()
    // Heurística: separar street del resto si termina en "STATE ZIP".
    const m = sapcrAddr.match(/^(.+?)\s+([a-zA-Z .]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i)
    if (m) {
      derivedStreet = m[1].trim()
      derivedCityStateZip = `${m[2].trim()}, ${m[3].toUpperCase()} ${m[4]}`
    } else {
      derivedStreet = sapcrAddr
    }
  }

  // Caption — formato SAPCR estándar usando iniciales del menor.
  const childFullName =
    cleanText(minorBasic.full_name) ||
    cleanText(sapcr.child_1_full_name) ||
    ''
  const childInitials = cleanText(sapcr.child_1_initials) || initials(childFullName)
  const styled = childInitials
    ? `In the interest of ${childInitials}, a child`
    : ''

  // Plaintiff y Defendant.
  const plaintiff1 = petitionerFullName
  const defendant1 = cleanText(sapcr.respondent_a_full_name) || cleanText(tutor.absent_parent_name) || ''

  // Custodial / Non-custodial parent (sólo aplican si el caso es child support; los completamos
  // por consistencia para SIJS donde la madre busca sole MC).
  const relRaw = String(tutor.relationship_to_minor ?? '').trim().toLowerCase()
  const isMother = relRaw.includes('madre') || relRaw.includes('mother')
  const isFather = relRaw === 'padre' || relRaw === 'father'

  let custodialParent = ''
  let nonCustodialParent = ''
  if (isMother) {
    custodialParent = petitionerFullName
    nonCustodialParent = defendant1
  } else if (isFather) {
    custodialParent = petitionerFullName
    nonCustodialParent = defendant1
  } else {
    // Caregiver / abuelo / tío — en este caso el non-custodial es típicamente la madre/padre del menor.
    custodialParent = petitionerFullName
    nonCustodialParent = defendant1
  }

  return {
    petitioner: {
      full_name: petitionerFullName,
      email: cleanText(profile.email),
      phone: formatPhone(String(profile.phone ?? '')),
      street: derivedStreet,
      city_state_zip: derivedCityStateZip,
    },
    parties: {
      plaintiff_1: plaintiff1,
      defendant_1: defendant1,
      custodial_parent: custodialParent,
      non_custodial_parent: nonCustodialParent,
    },
    caption: {
      styled,
    },
    person_completing: {
      pro_se: true,
    },
  }
}

// ──────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────

/**
 * Construye los valores prellenados del PR-GEN-116 desde la BD del caso.
 * - Aplica primero los `hardcoded` universales (Pro Se + case_type SIJS default).
 * - Luego aplica los `deriveFrom` resueltos contra el data bag.
 */
export async function buildPrGen116PrefilledValues(
  caseId: string,
  service: SupabaseClient
): Promise<Partial<CcisFormValues>> {
  const bag = await buildDataBag(caseId, service)
  const out: Record<string, string | boolean> = { ...HARDCODED_VALUES }

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
  return out as Partial<CcisFormValues>
}

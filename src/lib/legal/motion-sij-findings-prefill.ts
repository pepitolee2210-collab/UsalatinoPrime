// Construye los valores prellenados del Motion for Findings Regarding SIJ Status
// desde la BD del caso. Reusa el data bag del SAPCR-100 ya rellenado y la
// jurisdicción para extraer petitioner/child/respondent.
//
// El template DFPS asume un caso de DFPS-conservatorship; pero en UsaLatinoPrime
// la mayoría de casos son madre Pro Se buscando sole MC, así que el prefill
// adapta `petitioner_org_name` al peticionario real.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_FIELDS, HARDCODED_VALUES, type MotionSijFormValues } from './motion-sij-findings-form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('motion-sij-findings-prefill')

interface DataBag {
  petitioner: {
    org_name: string
  }
  child: {
    full_name: string
    caption_name: string
    sex: string
    birth_place: string
    birth_date: string
    country: string
  }
  mother: {
    name: string
  }
  father: {
    name: string
  }
  jurisdiction: {
    county: string
  }
  prior_order: {
    date: string
    year: string
  }
  final_order: {
    date: string
  }
  today: {
    month_year: string
  }
}

function get(bag: unknown, path: string): unknown {
  if (!path) return undefined
  const parts = path.split('.')
  let cur: unknown = bag
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function cleanText(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  return String(raw).replace(/\r\n/g, '\n').replace(/\\n/g, '\n').trim()
}

function formatDateMMDDYYYY(value: string | null | undefined): string {
  if (!value) return ''
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`
  return String(value)
}

function todayMonthYear(): string {
  const now = new Date()
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[now.getMonth()]} ${now.getFullYear()}`
}

async function buildDataBag(
  caseId: string,
  service: SupabaseClient
): Promise<DataBag> {
  const caseRes = await service.from('cases').select('client_id').eq('id', caseId).single()
  const clientId = caseRes.data?.client_id ?? null

  const [profileRes, tutorRes, storyRes, jurisdictionRes, sapcr100Res] = await Promise.all([
    clientId
      ? service.from('profiles').select('first_name, last_name, country_of_birth, gender').eq('id', clientId).single()
      : Promise.resolve({ data: null }),
    service.from('case_form_submissions').select('form_data')
      .eq('case_id', caseId).eq('form_type', 'tutor_guardian').maybeSingle(),
    service.from('case_form_submissions').select('form_data')
      .eq('case_id', caseId).eq('form_type', 'client_story').maybeSingle(),
    service.from('case_jurisdictions').select('state_code, court_name')
      .eq('case_id', caseId).maybeSingle(),
    service.from('case_form_instances').select('filled_values')
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

  // Petitioner: en SIJS por madre Pro Se, el peticionario es la cliente.
  // Cambia el header DFPS por su nombre.
  const petitionerFullName = cleanText(
    tutor.full_name ||
    sapcr.petitioner_full_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  )
  const petitionerOrgName = petitionerFullName
    ? `Petitioner ${petitionerFullName}, Pro Se`
    : 'Texas Department of Family and Protective Services'

  // Datos del menor
  const childFullName = cleanText(minorBasic.full_name) || cleanText(sapcr.child_1_full_name)
  const childInitials = cleanText(sapcr.child_1_initials)
  const childCaption = childInitials || childFullName  // En el caption va las iniciales (privacy)
  const childSex = cleanText(minorBasic.sex) || cleanText(profile.gender)
  const childBirthPlace = cleanText(minorBasic.birth_place) || cleanText(profile.country_of_birth)
  const childBirthDate = formatDateMMDDYYYY(cleanText(minorBasic.dob))

  // País de origen del menor para el predicate finding de "no best interest to return"
  const childCountry = cleanText(minorBasic.country_of_birth) || cleanText(profile.country_of_birth) || ''

  // Padre/madre — desde el SAPCR-100. Para el caso típico de madre Pro Se, el
  // mother_name es la peticionaria misma y el father_name es el "Padre" ausente.
  const motherName = cleanText(sapcr.petitioner_relationship_to_child) === 'mother'
    ? petitionerFullName
    : ''
  const fatherName = cleanText(sapcr.respondent_a_full_name) || cleanText(tutor.absent_parent_name)

  // Condado (parsea de court_name "District Courts of Harris County, Texas - ...")
  const courtName = String(jurisdiction.court_name ?? '')
  const countyMatch = courtName.match(/(\w+)\s+County/i)
  const county = countyMatch ? countyMatch[1] : ''

  // Final order: si aún no hay fecha real, dejarlo en blanco — el admin escribe
  // "the date of this hearing" o la fecha real cuando agende.
  const finalOrderDate = ''

  return {
    petitioner: { org_name: petitionerOrgName },
    child: {
      full_name: childFullName,
      caption_name: childCaption,
      sex: childSex,
      birth_place: childBirthPlace,
      birth_date: childBirthDate,
      country: childCountry,
    },
    mother: { name: motherName },
    father: { name: fatherName },
    jurisdiction: { county },
    prior_order: { date: '', year: '' },  // admin completa cuando tenga la orden firmada
    final_order: { date: finalOrderDate },
    today: { month_year: todayMonthYear() },
  }
}

export async function buildMotionSijPrefilledValues(
  caseId: string,
  service: SupabaseClient
): Promise<Partial<MotionSijFormValues>> {
  const bag = await buildDataBag(caseId, service)
  const out: Record<string, string | boolean> = { ...HARDCODED_VALUES }

  for (const f of ALL_FIELDS) {
    if (!f.deriveFrom) continue
    const v = get(bag, f.deriveFrom)
    if (v === undefined || v === null) continue
    if (typeof v === 'boolean' || typeof v === 'string') out[f.semanticKey] = v
    else if (typeof v === 'number') out[f.semanticKey] = String(v)
  }

  log.info('prefill computed', { caseId, fieldsWithValues: Object.keys(out).length })
  return out as Partial<MotionSijFormValues>
}

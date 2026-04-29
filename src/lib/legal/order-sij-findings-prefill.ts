// Construye los valores prellenados del Order SIJ Findings desde la BD del caso.
// Reusa el data bag del SAPCR-100 + Motion + Affidavit ya rellenados.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_FIELDS, HARDCODED_VALUES, type OrderSijFormValues } from './order-sij-findings-form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('order-sij-findings-prefill')

interface DataBag {
  conservator: {
    name_full: string
    short: string
  }
  child: {
    full_name: string
    caption_name: string
    sex: string
    birth_date: string
    birth_place: string
    country: string
  }
  mother: {
    respondent_name: string
  }
  father: {
    name: string
    grounds_default: string
    facts_default: string
  }
  jurisdiction: {
    county: string
  }
  prior_order: {
    date_full: string
  }
  final_order: {
    action_default: string
  }
  best_interest: {
    facts_default: string
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

async function buildDataBag(caseId: string, service: SupabaseClient): Promise<DataBag> {
  const caseRes = await service.from('cases').select('client_id').eq('id', caseId).single()
  const clientId = caseRes.data?.client_id ?? null

  const [profileRes, tutorRes, storyRes, jurisdictionRes, sapcrRes, motionRes, affidavitRes] = await Promise.all([
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
      .eq('case_id', caseId).eq('form_name', 'TX FM-SAPCR-100 Petition').maybeSingle(),
    service.from('case_form_instances').select('filled_values')
      .eq('case_id', caseId).eq('form_name', 'TX DFPS Motion for Findings Regarding SIJ Status').maybeSingle(),
    service.from('case_form_instances').select('filled_values')
      .eq('case_id', caseId).eq('form_name', 'TX DFPS Affidavit to Support SIJ Motion').maybeSingle(),
  ])

  const profile = (profileRes.data ?? {}) as Record<string, unknown>
  const tutor = ((tutorRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const story = ((storyRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const jurisdiction = (jurisdictionRes.data ?? {}) as Record<string, unknown>
  const sapcr = ((sapcrRes.data?.filled_values ?? {}) as Record<string, unknown>) || {}
  const motion = ((motionRes.data?.filled_values ?? {}) as Record<string, unknown>) || {}
  const affidavit = ((affidavitRes.data?.filled_values ?? {}) as Record<string, unknown>) || {}

  const minorBasic = ((story.minorBasic as Record<string, unknown>) ?? {})

  const petitionerFullName = cleanText(
    tutor.full_name ||
    sapcr.petitioner_full_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  )

  const rel = String(tutor.relationship_to_minor ?? sapcr.petitioner_relationship_to_child ?? '').toLowerCase()
  const isMotherPetitioner = rel.includes('madre') || rel.includes('mother')
  const isFatherPetitioner = rel === 'padre' || rel === 'father'
  const isPetitionerProSe = isMotherPetitioner || isFatherPetitioner ||
    rel.includes('cuidador') || rel.includes('caregiver') || rel.includes('abuel')

  // Conservator: Pro Se = Petitioner. DFPS = Department.
  const conservatorNameFull = isPetitionerProSe
    ? `Petitioner ${petitionerFullName}`
    : 'The Texas Department of Family & Protective Services (DFPS)'
  const conservatorShort = isPetitionerProSe ? 'Petitioner' : 'DFPS'

  // Child data — usa los valores que el admin ya capturó en el Affidavit (que son los más completos)
  const childFullName = cleanText(affidavit.child_full_name) || cleanText(motion.child_full_name) ||
    cleanText(minorBasic.full_name) || cleanText(sapcr.child_1_full_name)
  const childCaption = cleanText(affidavit.child_caption_name) || cleanText(motion.child_caption_name) ||
    cleanText(sapcr.child_1_initials) || childFullName
  const childSex = cleanText(affidavit.child_sex) || cleanText(motion.child_sex) ||
    cleanText(minorBasic.sex) || cleanText(profile.gender)
  const childBirthDate = cleanText(affidavit.child_birth_date) || cleanText(motion.child_birth_date) ||
    formatDateMMDDYYYY(cleanText(minorBasic.dob))
  const childBirthPlace = cleanText(affidavit.child_birth_place) || cleanText(motion.child_birth_place) ||
    cleanText(minorBasic.birth_place) || cleanText(profile.country_of_birth)
  const childCountry = cleanText(affidavit.child_country) || cleanText(motion.child_country) ||
    cleanText(minorBasic.country_of_birth) || cleanText(profile.country_of_birth)

  // Padre/madre como respondent
  const motherRespondent = isMotherPetitioner ? '' : cleanText(motion.mother_name)
  const fatherFullName = isFatherPetitioner
    ? petitionerFullName
    : (cleanText(affidavit.father_name) || cleanText(sapcr.respondent_a_full_name) ||
       cleanText(motion.father_name) || cleanText(tutor.absent_parent_name))

  const fatherGrounds = cleanText(affidavit.father_grounds) || (isFatherPetitioner ? '' : 'abandonment and neglect')
  const fatherFacts = cleanText(affidavit.father_facts) || cleanText(sapcr.possession_c_unworkable_text) ||
    'The father has been absent from the child’s life with no significant contact, financial support, or parental engagement, and currently resides outside of the United States.'

  const bestInterestFacts = cleanText(affidavit.best_interest_facts) ||
    'The child has built strong ties in this community (school enrollment, friends, stable housing). There are no parents or relatives in the home country able to provide care or financial support. Returning the child would interrupt critical educational continuity and remove access to U.S. health, social, and protective services that are not equivalent in the home country.'

  const finalOrderActionDefault = cleanText(affidavit.final_order_action) ||
    `granting ${conservatorShort} Permanent Managing Conservatorship`

  // Prior order date (full): combina date + year del Motion si existen
  const priorOrderDateFull = (() => {
    if (cleanText(affidavit.prior_order_date)) return cleanText(affidavit.prior_order_date)
    const d = cleanText(motion.prior_order_date)
    const y = cleanText(motion.prior_order_year)
    if (d && y) return `${d}, ${y}`
    if (d) return d
    return ''
  })()

  const courtName = String(jurisdiction.court_name ?? '')
  const countyMatch = courtName.match(/(\w+)\s+County/i)
  const county = countyMatch ? countyMatch[1] : (cleanText(motion.county_name) || cleanText(sapcr.case_county))

  return {
    conservator: { name_full: conservatorNameFull, short: conservatorShort },
    child: {
      full_name: childFullName,
      caption_name: childCaption,
      sex: childSex,
      birth_date: childBirthDate,
      birth_place: childBirthPlace,
      country: childCountry,
    },
    mother: { respondent_name: motherRespondent },
    father: {
      name: fatherFullName,
      grounds_default: fatherGrounds,
      facts_default: fatherFacts,
    },
    jurisdiction: { county },
    prior_order: { date_full: priorOrderDateFull },
    final_order: { action_default: finalOrderActionDefault },
    best_interest: { facts_default: bestInterestFacts },
  }
}

export async function buildOrderSijPrefilledValues(
  caseId: string,
  service: SupabaseClient
): Promise<Partial<OrderSijFormValues>> {
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
  return out as Partial<OrderSijFormValues>
}

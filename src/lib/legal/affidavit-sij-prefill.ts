// Construye los valores prellenados del DFPS Affidavit to Support SIJ Motion
// desde la BD del caso. Reusa el data bag del SAPCR-100 + Motion ya rellenados.
//
// El affidavit es flexible para dos perfiles:
//  - Madre Pro Se (caso típico UsaLatinoPrime): peticionaria es la affiant,
//    Petitioner es conservator, mother_grounds vacío (ella no es respondent).
//  - DFPS Caseworker: caseworker es affiant, DFPS es conservator.
//
// El prefill detecta el perfil mirando `tutor_guardian.relationship_to_minor`
// y `case_form_instances.TX FM-SAPCR-100 Petition.filled_values.petitioner_relationship_to_child`.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_FIELDS, HARDCODED_VALUES, type AffidavitSijFormValues } from './affidavit-sij-form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('affidavit-sij-prefill')

interface DataBag {
  affiant: {
    name: string
    role_intro: string
    title: string
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
    name: string
    respondent_name: string  // sólo si la madre es respondent (no peticionaria)
  }
  father: {
    name: string
    grounds_default: string
    facts_default: string
  }
  conservator: {
    name: string
    pronoun: string
  }
  jurisdiction: {
    county: string
  }
  prior_order: {
    date: string
  }
  final_order: {
    action_default: string
  }
  best_interest: {
    facts_default: string
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
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const now = new Date()
  return `${months[now.getMonth()]} ${now.getFullYear()}`
}

async function buildDataBag(caseId: string, service: SupabaseClient): Promise<DataBag> {
  const caseRes = await service.from('cases').select('client_id').eq('id', caseId).single()
  const clientId = caseRes.data?.client_id ?? null

  const [profileRes, tutorRes, storyRes, jurisdictionRes, sapcr100Res, motionRes] = await Promise.all([
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
  ])

  const profile = (profileRes.data ?? {}) as Record<string, unknown>
  const tutor = ((tutorRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const story = ((storyRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const jurisdiction = (jurisdictionRes.data ?? {}) as Record<string, unknown>
  const sapcr = ((sapcr100Res.data?.filled_values ?? {}) as Record<string, unknown>) || {}
  const motion = ((motionRes.data?.filled_values ?? {}) as Record<string, unknown>) || {}

  const minorBasic = ((story.minorBasic as Record<string, unknown>) ?? {})

  const petitionerFullName = cleanText(
    tutor.full_name ||
    sapcr.petitioner_full_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  )

  const rel = String(tutor.relationship_to_minor ?? sapcr.petitioner_relationship_to_child ?? '').toLowerCase()
  const isMotherPetitioner = rel.includes('madre') || rel.includes('mother')
  const isFatherPetitioner = rel === 'padre' || rel === 'father'

  // Affiant: madre/padre Pro Se firma su propio affidavit; caseworker DFPS firma para el Department.
  // En UsaLatinoPrime asumimos Pro Se por defecto.
  const affiantName = petitionerFullName
  const affiantRoleIntro = isMotherPetitioner
    ? 'I am the petitioner and biological mother of the child.'
    : isFatherPetitioner
      ? 'I am the petitioner and biological father of the child.'
      : 'I am the petitioner in this case.'
  const affiantTitle = 'Petitioner, Pro Se'

  // Conservator: en Pro Se, la peticionaria misma. En DFPS, el Department.
  const conservatorName = 'Petitioner'
  const conservatorPronoun = isMotherPetitioner ? 'her' : isFatherPetitioner ? 'him' : 'them'

  // Child data
  const childFullName = cleanText(minorBasic.full_name) || cleanText(sapcr.child_1_full_name) || cleanText(motion.child_full_name)
  const childCaption = cleanText(motion.child_caption_name) || cleanText(sapcr.child_1_initials) || childFullName
  const childSex = cleanText(minorBasic.sex) || cleanText(profile.gender) || cleanText(motion.child_sex)
  const childBirthDate = cleanText(motion.child_birth_date) || formatDateMMDDYYYY(cleanText(minorBasic.dob))
  const childBirthPlace = cleanText(motion.child_birth_place) || cleanText(minorBasic.birth_place) || cleanText(profile.country_of_birth)
  const childCountry = cleanText(motion.child_country) || cleanText(minorBasic.country_of_birth) || cleanText(profile.country_of_birth)

  // Mother / father del menor
  const motherFullName = isMotherPetitioner
    ? petitionerFullName
    : (cleanText(motion.mother_name) || '')
  const motherRespondentName = isMotherPetitioner ? '' : motherFullName

  const fatherFullName = isFatherPetitioner
    ? petitionerFullName
    : (cleanText(sapcr.respondent_a_full_name) || cleanText(motion.father_name) || cleanText(tutor.absent_parent_name))

  // Para el caso típico (madre Pro Se contra padre ausente):
  // Father grounds: abandonment es lo más común cuando el padre desapareció.
  const fatherGroundsDefault = isFatherPetitioner ? '' : 'abandonment and neglect'
  const fatherFactsDefault = isFatherPetitioner ? '' : (
    cleanText(sapcr.possession_c_unworkable_text) ||
    cleanText(tutor.abuse_description) ||
    'The father has been absent from the child’s life with no significant contact, financial support, or parental engagement. He currently resides outside of the United States and his whereabouts have not been a meaningful part of this child’s life.'
  )

  // Best interest defaults — texto sugerido que el admin debe revisar y personalizar.
  const bestInterestFactsDefault = `The child has built strong ties in this community, including school enrollment, friends, and stable housing. There are no parents or relatives in the home country able to provide care or financial support. Returning the child would interrupt critical educational continuity and remove access to U.S. health, social, and protective services that are not equivalent in the home country.`

  // Final order action default
  const finalOrderActionDefault = `granting Petitioner Permanent Managing Conservatorship of this child`

  // County
  const courtName = String(jurisdiction.court_name ?? '')
  const countyMatch = courtName.match(/(\w+)\s+County/i)
  const county = countyMatch ? countyMatch[1] : (cleanText(motion.county_name) || cleanText(sapcr.case_county))

  // Prior order date — del Motion ya rellenado o vacío
  const priorOrderDate = (() => {
    const d = cleanText(motion.prior_order_date)
    const y = cleanText(motion.prior_order_year)
    if (d && y) return `${d}, ${y}`
    if (d) return d
    return ''
  })()

  return {
    affiant: { name: affiantName, role_intro: affiantRoleIntro, title: affiantTitle },
    child: {
      full_name: childFullName,
      caption_name: childCaption,
      sex: childSex,
      birth_date: childBirthDate,
      birth_place: childBirthPlace,
      country: childCountry,
    },
    mother: { name: motherFullName, respondent_name: motherRespondentName },
    father: {
      name: fatherFullName,
      grounds_default: fatherGroundsDefault,
      facts_default: fatherFactsDefault,
    },
    conservator: { name: conservatorName, pronoun: conservatorPronoun },
    jurisdiction: { county },
    prior_order: { date: priorOrderDate },
    final_order: { action_default: finalOrderActionDefault },
    best_interest: { facts_default: bestInterestFactsDefault },
    today: { month_year: todayMonthYear() },
  }
}

export async function buildAffidavitSijPrefilledValues(
  caseId: string,
  service: SupabaseClient
): Promise<Partial<AffidavitSijFormValues>> {
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
  return out as Partial<AffidavitSijFormValues>
}

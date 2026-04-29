// Construye los valores prellenados del FM-SAPCR-205 (Nonparent Custody Order)
// desde la BD del caso. Reusa el data bag completo del ecosistema SIJS:
// SAPCR-100 + Motion + Affidavit + Order Findings ya rellenados.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_FIELDS, HARDCODED_VALUES, type FmSapcr205FormValues } from './fm-sapcr-205-form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('fm-sapcr-205-prefill')

interface DataBag {
  petitioner: { full_name: string }
  respondent_a: { full_name: string }
  mother: { full_name: string }
  father: { full_name: string }
  child: {
    caption_name: string
    sex: string
    dob: string
  }
  jurisdiction: { county: string; state_code: string }
  final_order: { date: string }
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
  return String(raw).trim()
}

async function buildDataBag(caseId: string, service: SupabaseClient): Promise<DataBag> {
  const caseRes = await service.from('cases').select('client_id').eq('id', caseId).single()
  const clientId = caseRes.data?.client_id ?? null

  const [profileRes, tutorRes, storyRes, jurisdictionRes, sapcrRes, motionRes, affidavitRes, orderRes] = await Promise.all([
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
    service.from('case_form_instances').select('filled_values')
      .eq('case_id', caseId).eq('form_name', 'TX DFPS Order Regarding SIJ Findings').maybeSingle(),
  ])

  const profile = (profileRes.data ?? {}) as Record<string, unknown>
  const tutor = ((tutorRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const story = ((storyRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const jurisdiction = (jurisdictionRes.data ?? {}) as Record<string, unknown>
  const sapcr = ((sapcrRes.data?.filled_values ?? {}) as Record<string, unknown>) || {}
  const motion = ((motionRes.data?.filled_values ?? {}) as Record<string, unknown>) || {}
  const affidavit = ((affidavitRes.data?.filled_values ?? {}) as Record<string, unknown>) || {}
  const order = ((orderRes.data?.filled_values ?? {}) as Record<string, unknown>) || {}

  const minorBasic = ((story.minorBasic as Record<string, unknown>) ?? {})

  // Petitioner
  const petitionerFullName = cleanText(
    tutor.full_name || sapcr.petitioner_full_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  )

  const rel = String(tutor.relationship_to_minor ?? sapcr.petitioner_relationship_to_child ?? '').toLowerCase()
  const isMotherPetitioner = rel.includes('madre') || rel.includes('mother')
  const isFatherPetitioner = rel === 'padre' || rel === 'father'

  // Respondent A — el otro padre
  const respondentAFullName = cleanText(
    sapcr.respondent_a_full_name || affidavit.father_name || motion.father_name || tutor.absent_parent_name
  )

  // Mother / father del menor
  const motherFullName = isMotherPetitioner ? petitionerFullName : (cleanText(motion.mother_name || affidavit.mother_name) || respondentAFullName)
  const fatherFullName = isFatherPetitioner ? petitionerFullName : (cleanText(affidavit.father_name || sapcr.respondent_a_full_name || motion.father_name) || respondentAFullName)

  // Child
  const childCaption = cleanText(
    affidavit.child_caption_name || motion.child_caption_name || sapcr.child_1_initials || order.child_caption_name
  )
  const childFullName = cleanText(
    affidavit.child_full_name || motion.child_full_name || sapcr.child_1_full_name || minorBasic.full_name
  )
  // Sex: el form pide M/F, lo normalizamos
  let childSex = cleanText(affidavit.child_sex || order.child_sex || motion.child_sex || minorBasic.sex || profile.gender)
  if (childSex.toLowerCase() === 'male') childSex = 'M'
  else if (childSex.toLowerCase() === 'female') childSex = 'F'
  const childDob = cleanText(
    affidavit.child_birth_date || order.child_birth_date || motion.child_birth_date ||
    sapcr.child_1_dob || minorBasic.dob
  )

  // Jurisdicción
  const courtName = String(jurisdiction.court_name ?? '')
  const countyMatch = courtName.match(/(\w+)\s+County/i)
  const county = countyMatch ? countyMatch[1] : (cleanText(motion.county_name) || cleanText(sapcr.case_county))
  const stateCode = cleanText(jurisdiction.state_code) || 'TX'

  // Final order date
  const finalOrderDate = cleanText(order.final_order_date || affidavit.final_order_date)

  return {
    petitioner: { full_name: petitionerFullName },
    respondent_a: { full_name: respondentAFullName || (childCaption ? 'Padre' : '') },
    mother: { full_name: motherFullName },
    father: { full_name: fatherFullName },
    child: {
      caption_name: childCaption || childFullName,
      sex: childSex,
      dob: childDob,
    },
    jurisdiction: { county, state_code: stateCode },
    final_order: { date: finalOrderDate },
  }
}

export async function buildFmSapcr205PrefilledValues(
  caseId: string,
  service: SupabaseClient
): Promise<Partial<FmSapcr205FormValues>> {
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
  return out as Partial<FmSapcr205FormValues>
}

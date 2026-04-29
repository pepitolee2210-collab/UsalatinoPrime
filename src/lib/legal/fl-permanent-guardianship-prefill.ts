// Prefill builder para FL Permanent Guardianship Petition.
// Reutiliza el data bag pattern de los schemas TX adaptado a Florida.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FlGuardianshipFormValues } from './fl-permanent-guardianship-form-schema'
import { FORM_SECTIONS, HARDCODED_VALUES } from './fl-permanent-guardianship-form-schema'

interface DataBag {
  petitioner: {
    full_name: string
    full_address: string
    phone: string
    email: string
    relationship_en: string
  }
  child: {
    full_name: string
    dob: string
    country_of_birth: string
    current_address: string
    abuse_narrative: string
  }
  jurisdiction: {
    county: string
  }
}

function get(bag: unknown, path: string): unknown {
  if (!path) return undefined
  const parts = path.split('.')
  let cur: unknown = bag
  for (const part of parts) {
    if (cur == null) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function formatDateMMDDYYYY(value: string | null | undefined): string {
  if (!value) return ''
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`
  return String(value)
}

function formatPhone(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return String(raw ?? '')
}

async function buildDataBag(caseId: string, service: SupabaseClient): Promise<DataBag> {
  const caseRes = await service.from('cases').select('client_id').eq('id', caseId).single()
  const clientId = caseRes.data?.client_id ?? null

  const [profileRes, tutorRes, storyRes, jurisdictionRes] = await Promise.all([
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
      .select('court_name, state_code, state_name')
      .eq('case_id', caseId)
      .maybeSingle(),
  ])

  const profile = (profileRes.data ?? {}) as Record<string, unknown>
  const tutor = ((tutorRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const story = ((storyRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const jurisdiction = (jurisdictionRes.data ?? {}) as Record<string, unknown>

  const minorBasic = ((story.minorBasic as Record<string, unknown>) ?? {})
  const minorAbuse = ((story.minorAbuse as Record<string, unknown>) ?? {})

  const petitionerFullName =
    (tutor.full_name as string) ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()

  const petitionerAddress =
    (tutor.full_address as string) ||
    [profile.address_street, profile.address_city, profile.address_state, profile.address_zip]
      .filter(Boolean)
      .join(', ')

  const relRaw = String(tutor.relationship_to_minor ?? '').toLowerCase()
  const relationshipEn = relRaw.includes('madre') || relRaw.includes('mother') ? 'mother'
    : relRaw === 'padre' || relRaw === 'father' ? 'father'
    : relRaw.includes('abuela') ? 'grandmother'
    : relRaw.includes('abuelo') ? 'grandfather'
    : relRaw.includes('tia') || relRaw.includes('tía') ? 'aunt'
    : relRaw.includes('tio') || relRaw.includes('tío') ? 'uncle'
    : relRaw.includes('hermana') ? 'sister'
    : relRaw.includes('cuidador') ? 'caregiver'
    : ''

  const courtName = String(jurisdiction.court_name ?? '')
  const countyMatch = courtName.match(/(\w+(?:[\s-]\w+)*)\s+County/i)?.[1] ?? ''

  return {
    petitioner: {
      full_name: petitionerFullName,
      full_address: petitionerAddress,
      phone: formatPhone(String(profile.phone ?? '')),
      email: String(profile.email ?? ''),
      relationship_en: relationshipEn,
    },
    child: {
      full_name: String(minorBasic.full_name ?? ''),
      dob: formatDateMMDDYYYY(String(minorBasic.dob ?? '')),
      country_of_birth: String(minorBasic.country ?? ''),
      current_address: String(minorBasic.address ?? petitionerAddress),
      abuse_narrative: String(minorAbuse.abandonment_details ?? minorAbuse.life_in_country ?? ''),
    },
    jurisdiction: {
      county: countyMatch,
    },
  }
}

export async function buildFlGuardianshipPrefilledValues(
  caseId: string,
  service: SupabaseClient,
): Promise<Partial<FlGuardianshipFormValues>> {
  const bag = await buildDataBag(caseId, service)
  const out: Record<string, string | boolean> = { ...HARDCODED_VALUES }

  for (const section of FORM_SECTIONS) {
    for (const f of section.fields) {
      if (!f.deriveFrom) continue
      const v = get(bag, f.deriveFrom)
      if (v == null) continue
      if (typeof v === 'string' && v) out[f.semanticKey] = v
      else if (typeof v === 'boolean') out[f.semanticKey] = v
    }
  }
  return out as Partial<FlGuardianshipFormValues>
}

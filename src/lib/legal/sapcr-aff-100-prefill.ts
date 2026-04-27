// Construye los valores prellenados del FM-SAPCR-AFF-100 a partir de los
// datos existentes en BD para un caso específico. Sigue el mismo patrón que
// sapcr100-prefill.ts: data bag → resolución de `deriveFrom`.
//
// Decisiones de prefill (validadas con el usuario):
//   - `other_facts` se prellena con la narrativa completa de
//     `tutor_guardian.form_data.why_cannot_reunify` (texto libre del intake).
//     El admin lo edita en el modal antes de imprimir.
//   - Los 4 checkboxes "Not applicable" arrancan en true salvo `other_facts`,
//     porque la narrativa entra ahí por defecto. El admin destildará los que
//     sean relevantes según los hechos del caso.
//   - `notary_state = "Texas"` (hardcoded en el schema), `notary_county`
//     deriva del condado del filing.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_FIELDS, HARDCODED_VALUES, type SapcrAffFormValues } from './sapcr-aff-100-form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('sapcr-aff-100-prefill')

// ──────────────────────────────────────────────────────────────────
// Tipos del data bag
// ──────────────────────────────────────────────────────────────────

interface DataBag {
  petitioner: {
    full_name: string
  }
  child_1: {
    full_name: string
  }
  jurisdiction: {
    county: string
    court_number: string
    state_code: string
  }
  sijs_aff_defaults: {
    physical_not_applicable: boolean
    emotional_not_applicable: boolean
    incapacity_not_applicable: boolean
    other_facts_check: boolean
    narrative_prefill: string
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
  // Normaliza saltos de línea raros del intake (\r\n → \n, secuencias
  // escapadas \\n del JSON ya parseado quedan literales en algunos lugares).
  return String(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .trim()
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
          .select('first_name, last_name')
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
  ])

  const profile = (profileRes.data ?? {}) as Record<string, unknown>
  const tutor = ((tutorRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const story = ((storyRes.data?.form_data ?? {}) as Record<string, unknown>) || {}
  const jurisdiction = (jurisdictionRes.data ?? {}) as Record<string, unknown>

  const minorBasic = ((story.minorBasic as Record<string, unknown>) ?? {})

  const petitionerFullName =
    cleanText(tutor.full_name) ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
    ''

  const childFullName = cleanText(minorBasic.full_name)

  // Narrativa de prefill: usar `why_cannot_reunify` (relato detallado del
  // intake del tutor). Si está vacío, intentar con `abuse_description`.
  const narrative =
    cleanText(tutor.why_cannot_reunify) ||
    cleanText(tutor.abuse_description) ||
    ''

  const county = ((jurisdiction.court_name as string) ?? '').match(/(\w+)\s+County/i)?.[1] ?? ''

  return {
    petitioner: {
      full_name: petitionerFullName,
    },
    child_1: {
      full_name: childFullName,
    },
    jurisdiction: {
      county,
      court_number: '', // FALTANTE EN INTAKE — lo asigna el clerk
      state_code: String(jurisdiction.state_code ?? ''),
    },
    sijs_aff_defaults: {
      // Por defecto las 3 secciones de daño arrancan en "Not applicable".
      // El admin destilda las que aplican según los hechos.
      physical_not_applicable: true,
      emotional_not_applicable: true,
      incapacity_not_applicable: true,
      // "Other facts" SIEMPRE se marca cuando hay narrativa para prellenar.
      other_facts_check: !!narrative,
      narrative_prefill: narrative,
    },
  }
}

// ──────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────

/**
 * Construye los valores prellenados del SAPCR-AFF-100 desde la BD del caso.
 * - Aplica primero los `hardcoded` universales.
 * - Luego aplica los `deriveFrom` resueltos contra el data bag.
 */
export async function buildSapcrAffPrefilledValues(
  caseId: string,
  service: SupabaseClient
): Promise<Partial<SapcrAffFormValues>> {
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
  return out as Partial<SapcrAffFormValues>
}

/**
 * Lee la relación de la peticionaria con el menor desde el intake del tutor
 * y retorna `true` si es la madre/padre biológico (lo que invalida el uso
 * del Affidavit por TFC §102.0031, exclusivo para no-padres).
 *
 * Una sola consulta: `case_form_submissions` filtrada por `tutor_guardian`.
 */
export async function isPetitionerBiologicalParent(
  caseId: string,
  service: SupabaseClient
): Promise<boolean> {
  const { data } = await service
    .from('case_form_submissions')
    .select('form_data')
    .eq('case_id', caseId)
    .eq('form_type', 'tutor_guardian')
    .maybeSingle()

  const tutor = ((data?.form_data ?? {}) as Record<string, unknown>) || {}
  const rel = String(tutor.relationship_to_minor ?? '').trim().toLowerCase()
  return (
    rel.includes('madre') ||
    rel.includes('mother') ||
    rel === 'padre' ||
    rel === 'father' ||
    rel.includes('biológic') ||
    rel.includes('biologic')
  )
}

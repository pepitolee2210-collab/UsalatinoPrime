// Construye los valores prellenados del EOIR-26 (Notice of Appeal) a partir
// de los datos existentes en BD para un caso de Apelación.
//
// La fuente de verdad de qué campos se derivan de dónde es el array
// `deriveFrom` en eoir-26-form-schema.ts. Aquí construimos un "data bag"
// con todas las fuentes posibles y luego resolvemos cada `deriveFrom` con
// notación dot/index.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_FIELDS, HARDCODED_VALUES, type Eoir26FormValues } from './eoir-26-form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('eoir-26-prefill')

// ──────────────────────────────────────────────────────────────────
// Información de la firma (sección 11 del PDF EOIR-26 — Attorney/Representative).
//
// El cliente de UsaLatino Prime presenta la apelación pro se (sin representante
// legal acreditado ante EOIR). Estos campos quedan en blanco al imprimir.
// Si en el futuro algún caso lleva representante, Diana puede llenarlos
// manualmente desde el modal del admin — pero NO se auto-rellenan.
// ──────────────────────────────────────────────────────────────────

const FIRM_INFO = {
  name: '',
  street_address: '',
  suite: '',
  city_state_zip: '',
  phone: '',
  email: '',
}

// ──────────────────────────────────────────────────────────────────
// Data bag
// ──────────────────────────────────────────────────────────────────

interface DataBag {
  appellant: {
    full_name: string
    street_address: string
    apartment: string
    city_state_zip: string
    phone: string
    aliens_list: string
    custody_status: string
  }
  appeal_decision: {
    last_hearing_location: string
    summary: string
    decision_date: string
    hearing_date_1: string
  }
  firm: typeof FIRM_INFO
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function joinName(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => !!p && p.trim()).join(' ').trim()
}

function joinCityStateZip(
  city: string | null,
  state: string | null,
  zip: string | null,
): string {
  const cs = [city, state].filter((p) => !!p && p.trim()).join(', ')
  return [cs, zip].filter((p) => !!p && p.trim()).join(' ').trim()
}

function formatAlienEntry(
  lastName: string,
  firstName: string,
  middleName: string | null,
  aNumber: string | null,
): string {
  const fullName = joinName([lastName, ',', firstName, middleName]).replace(', ', ', ')
  const a = aNumber?.trim() ? `A${aNumber.replace(/^A/i, '').trim()}` : ''
  return [fullName, a].filter(Boolean).join(' — ')
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc == null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[k]
  }, obj)
}

// ──────────────────────────────────────────────────────────────────
// Builder principal
// ──────────────────────────────────────────────────────────────────

export async function buildEoir26PrefilledValues(
  caseId: string,
  service: SupabaseClient,
): Promise<Partial<Eoir26FormValues>> {
  const { data: caseRow } = await service
    .from('cases')
    .select('id, client_id, decision_date')
    .eq('id', caseId)
    .maybeSingle()

  if (!caseRow) {
    log.warn('case not found', { caseId })
    return { ...HARDCODED_VALUES }
  }

  const { data: profile } = await service
    .from('profiles')
    .select(
      'first_name, last_name, middle_name, phone, a_number, address_street, address_city, address_state, address_zip',
    )
    .eq('id', caseRow.client_id)
    .maybeSingle()

  // Buscar el "Auto de Denegación del Juez" más reciente (subido por el cliente)
  // con extracción de IA completada. La columna `ai_extracted_data` la popula el
  // worker `/api/workers/extract-eoir-26-decision` después del upload.
  const { data: denegacionDoc } = await service
    .from('documents')
    .select('ai_extracted_data')
    .eq('case_id', caseId)
    .eq('document_key', 'apelacion_denegacion_juez')
    .eq('ai_extraction_status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const aiDecisionDate =
    (denegacionDoc?.ai_extracted_data as { eoir_26?: { decision_date?: string } } | null)?.eoir_26
      ?.decision_date ?? ''

  const firstName = (profile?.first_name ?? '').trim()
  const lastName = (profile?.last_name ?? '').trim()
  const middleName = (profile?.middle_name ?? '').trim()
  const fullName = joinName([firstName, middleName, lastName])

  // Prioridad de `decision_date`: cases.decision_date (manual de Diana) > IA > vacío.
  // La IA es ayuda, no sobreescritura silenciosa del trabajo manual.
  const decisionDate = caseRow.decision_date
    ? String(caseRow.decision_date)
    : aiDecisionDate

  const bag: DataBag = {
    appellant: {
      full_name: fullName,
      street_address: profile?.address_street ?? '',
      apartment: '',
      city_state_zip: joinCityStateZip(
        profile?.address_city ?? null,
        profile?.address_state ?? null,
        profile?.address_zip ?? null,
      ),
      phone: profile?.phone ?? '',
      aliens_list: lastName || firstName
        ? formatAlienEntry(lastName, firstName, middleName || null, profile?.a_number ?? null)
        : '',
      custody_status: 'Not Detained',
    },
    appeal_decision: {
      last_hearing_location: '',
      summary: '',
      decision_date: decisionDate,
      hearing_date_1: '',
    },
    firm: FIRM_INFO,
  }

  const out: Record<string, string | boolean | null | undefined> = { ...HARDCODED_VALUES }

  for (const f of ALL_FIELDS) {
    if (!f.deriveFrom) continue
    const v = getByPath(bag, f.deriveFrom)
    if (v === undefined || v === null) continue
    if (typeof v === 'string' || typeof v === 'boolean') {
      out[f.semanticKey] = v
    }
  }

  // Aplicar defaultValue para campos sin valor derivado ni hardcoded — esto
  // permite que el cliente vea "Not Detained" preseleccionado en la UI.
  for (const f of ALL_FIELDS) {
    if (out[f.semanticKey] !== undefined && out[f.semanticKey] !== '') continue
    if (f.defaultValue !== undefined) {
      out[f.semanticKey] = f.defaultValue
    }
  }

  return out as Partial<Eoir26FormValues>
}

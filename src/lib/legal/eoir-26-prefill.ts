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
// Constantes de la firma (UsaLatino Prime).
// Si la firma se muda o cambia de dirección, actualizar aquí. Estos
// valores aparecen en la sección "Attorney/Representative" del Notice
// of Appeal (sección 11 del PDF EOIR-26).
// ──────────────────────────────────────────────────────────────────

const FIRM_INFO = {
  name: 'UsaLatino Prime',
  street_address: '',
  suite: '',
  city_state_zip: '',
  phone: '',
  email: 'henry@usalatino.com',
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

  const firstName = (profile?.first_name ?? '').trim()
  const lastName = (profile?.last_name ?? '').trim()
  const middleName = (profile?.middle_name ?? '').trim()
  const fullName = joinName([firstName, middleName, lastName])

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
      custody_status: '',
    },
    appeal_decision: {
      last_hearing_location: '',
      summary: '',
      decision_date: caseRow.decision_date ? String(caseRow.decision_date) : '',
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

  return out as Partial<Eoir26FormValues>
}

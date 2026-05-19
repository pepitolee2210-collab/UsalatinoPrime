// Construye los valores prellenados del EOIR-26A (Fee Waiver Request) a partir
// de los datos existentes en BD para un caso de Apelación.
//
// El cliente decide si llena este form (es opcional). La presencia de datos
// en filled_values significa que está activo. Diana solo descarga si está
// activo.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_FIELDS, HARDCODED_VALUES, type Eoir26aFormValues } from './eoir-26a-form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('eoir-26a-prefill')

const PREPARER_INFO = {
  name: 'UsaLatino Prime',
}

interface DataBag {
  appellant: {
    full_name: string
    name_last_first_middle: string
    a_number: string
    eoir_id: string
  }
  preparer: typeof PREPARER_INFO
}

function joinName(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => !!p && p.trim()).join(' ').trim()
}

function formatLastFirstMiddle(
  lastName: string,
  firstName: string,
  middleName: string,
): string {
  const fullParts = [firstName, middleName].filter((p) => p.trim()).join(' ')
  return [lastName.trim(), fullParts].filter(Boolean).join(', ')
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc == null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[k]
  }, obj)
}

export async function buildEoir26aPrefilledValues(
  caseId: string,
  service: SupabaseClient,
): Promise<Partial<Eoir26aFormValues>> {
  const { data: caseRow } = await service
    .from('cases')
    .select('id, client_id')
    .eq('id', caseId)
    .maybeSingle()

  if (!caseRow) {
    log.warn('case not found', { caseId })
    return { ...HARDCODED_VALUES }
  }

  const { data: profile } = await service
    .from('profiles')
    .select('first_name, last_name, middle_name, a_number, uscis_account_number')
    .eq('id', caseRow.client_id)
    .maybeSingle()

  const firstName = (profile?.first_name ?? '').trim()
  const lastName = (profile?.last_name ?? '').trim()
  const middleName = (profile?.middle_name ?? '').trim()
  const fullName = joinName([firstName, middleName, lastName])

  const bag: DataBag = {
    appellant: {
      full_name: fullName,
      name_last_first_middle: formatLastFirstMiddle(lastName, firstName, middleName),
      a_number: profile?.a_number ?? '',
      eoir_id: profile?.uscis_account_number ?? '',
    },
    preparer: PREPARER_INFO,
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

  return out as Partial<Eoir26aFormValues>
}

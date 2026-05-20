// Construye los valores prellenados del EOIR-33 a partir de los datos del
// cliente en BD para un caso de "cambio-de-corte". Sigue el patrón de
// sapcr-aff-100-prefill.ts: data bag → resolución de `deriveFrom`.
//
// Fuentes consultadas (en este orden de prioridad):
//   1. profiles.* — la fuente principal: nombre, A#, dirección, teléfono, email
//   2. cambio_corte_submissions matched por phone (legacy/standalone) — solo
//      para precargar A# y datos del caso si el profile no los tiene
//
// Las direcciones "anteriores" arrancan vacías por defecto (porque el cliente
// tendrá que recordar/buscar su dirección previa). La actual sale del profile.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_FIELDS, HARDCODED_VALUES, type Eoir33FormValues } from './eoir-33-form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('eoir-33-prefill')

// ──────────────────────────────────────────────────────────────────
// Tipos del data bag
// ──────────────────────────────────────────────────────────────────

interface AddressBlock {
  street: string
  city_state_zip: string
  city_state_zip_country: string
}

interface DataBag {
  respondent: {
    full_name: string
    full_name_upper: string
    a_number: string
    current_address: AddressBlock
    current_phone: string
    current_email: string
    prior_address: AddressBlock
    prior_phone: string
    prior_email: string
    selected_court: string
  }
  document: {
    date_today: string  // YYYY-MM-DD
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
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function cleanText(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  return String(raw).trim()
}

function buildAddressBlock(
  street?: string | null,
  city?: string | null,
  state?: string | null,
  zip?: string | null,
  country = 'USA',
): AddressBlock {
  const s = cleanText(street)
  const c = cleanText(city)
  const st = cleanText(state)
  const z = cleanText(zip)
  const cityStateZip = [c, [st, z].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const cityStateZipCountry = [cityStateZip, country].filter(Boolean).join(', ')
  return {
    street: s,
    city_state_zip: cityStateZip,
    city_state_zip_country: cityStateZipCountry,
  }
}

function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ──────────────────────────────────────────────────────────────────
// Construcción del data bag
// ──────────────────────────────────────────────────────────────────

async function buildDataBag(
  caseId: string,
  service: SupabaseClient,
): Promise<DataBag> {
  const caseRes = await service.from('cases').select('client_id').eq('id', caseId).single()
  const clientId = caseRes.data?.client_id ?? null

  const profileRes = clientId
    ? await service
        .from('profiles')
        .select(
          'first_name, last_name, middle_name, phone, email, a_number, address_street, address_city, address_state, address_zip, country_of_birth',
        )
        .eq('id', clientId)
        .single()
    : { data: null }

  const profile = (profileRes.data ?? {}) as Record<string, unknown>

  // Legacy lookup: si Henry creó un cambio_corte_submissions a mano para este
  // cliente con el mismo phone, reusar A# y datos del caso como fallback.
  const phone = cleanText(profile.phone)
  let legacy: Record<string, unknown> = {}
  if (phone) {
    const legacyRes = await service
      .from('cambio_corte_submissions')
      .select('file_number, client_address_street, client_address_city, client_address_state, client_address_zip, judge_name, current_court_name')
      .eq('client_phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    legacy = (legacyRes.data ?? {}) as Record<string, unknown>
  }

  const fullName = [profile.first_name, profile.middle_name, profile.last_name]
    .map(cleanText)
    .filter(Boolean)
    .join(' ')

  const aNumber = cleanText(profile.a_number) || cleanText(legacy.file_number)

  const currentAddress = buildAddressBlock(
    (profile.address_street as string) ?? (legacy.client_address_street as string),
    (profile.address_city as string) ?? (legacy.client_address_city as string),
    (profile.address_state as string) ?? (legacy.client_address_state as string),
    (profile.address_zip as string) ?? (legacy.client_address_zip as string),
  )

  // La dirección anterior no se conoce a priori — el admin/cliente la llena.
  const priorAddress = buildAddressBlock(null, null, null, null)

  // El tribunal "actualmente asignado" sale del legacy current_court_name si
  // existe; el cliente sobreescribirá con el tribunal AL QUE quiere transferir.
  // El dropdown del PDF solo soporta los 74 tribunales del catálogo: si no
  // matchea exactamente, dejamos vacío para evitar que el AcroForm lo ignore.
  const selectedCourt = cleanText(legacy.current_court_name)
    .replace(/^Immigration Court\s*[-–]\s*/i, '')

  return {
    respondent: {
      full_name: fullName,
      full_name_upper: fullName.toUpperCase(),
      a_number: aNumber,
      current_address: currentAddress,
      current_phone: phone,
      current_email: cleanText(profile.email),
      prior_address: priorAddress,
      prior_phone: '',
      prior_email: '',
      selected_court: selectedCourt,
    },
    document: {
      date_today: todayIso(),
    },
  }
}

// ──────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────

/**
 * Construye los valores prellenados del EOIR-33 desde la BD del caso.
 * Aplica primero los `hardcoded` universales, luego los `deriveFrom`
 * resueltos contra el data bag.
 */
export async function buildEoir33PrefilledValues(
  caseId: string,
  service: SupabaseClient,
): Promise<Partial<Eoir33FormValues>> {
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
  return out as Partial<Eoir33FormValues>
}

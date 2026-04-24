import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeStateCode, stateName, type UsStateCode } from '@/lib/timezones/us-states'
import { createLogger } from '@/lib/logger'

const log = createLogger('resolve-client-location')

/**
 * Nivel de confianza de la ubicación detectada. Determina el color del badge
 * en el panel admin y si la IA debe aceptarla como autoritativa.
 */
export type LocationConfidence = 'high' | 'medium' | 'low' | 'missing'

/**
 * Fuente desde la que se obtuvo la ubicación. Se muestra al admin para que
 * sepa qué tan fresco es el dato (p.ej. contrato firmado vs dirección libre
 * escrita por el tutor).
 */
export type LocationSource =
  | 'contract'      // contracts.client_state/city/zip/address — admin firmó con autofill
  | 'profile'       // profiles.address_state/city/zip/street — intake
  | 'tutor_form'    // case_form_submissions.form_data.full_address del tutor_guardian
  | 'zip_derived'   // solo había ZIP; resuelto con zippopotam.us
  | 'missing'

export interface ClientLocation {
  stateCode: UsStateCode
  stateName: string
  city: string | null
  zip: string | null
  street: string | null
  source: LocationSource
  confidence: LocationConfidence
}

/**
 * Extrae state code + ZIP de una dirección libre tipo
 *   "123 Main St, Salt Lake City, UT 84101"
 * usando regex. Devuelve null si no logra detectar el estado.
 */
function parseFreeAddress(addr: string): {
  stateCode: UsStateCode | null
  zip: string | null
  city: string | null
} {
  if (!addr) return { stateCode: null, zip: null, city: null }

  // Captura "XX 12345" al final (state + zip). El zip es opcional.
  const stateZipMatch = addr.match(/\b([A-Z]{2})\b[\s,]*(\d{5})?/i)
  const stateCode = stateZipMatch ? normalizeStateCode(stateZipMatch[1]) : null
  const zip = stateZipMatch?.[2] || null

  // La ciudad suele estar antes del state. "..., Salt Lake City, UT ..."
  let city: string | null = null
  if (stateZipMatch) {
    const beforeState = addr.slice(0, stateZipMatch.index).trim().replace(/,$/, '')
    const parts = beforeState.split(',').map(p => p.trim()).filter(Boolean)
    city = parts[parts.length - 1] || null
  }

  return { stateCode, zip, city }
}

/**
 * Resuelve ZIP → {city, state} usando zippopotam.us. Solo se llama como
 * último recurso cuando hay ZIP pero no pudimos extraer state.
 */
async function zipLookup(zip: string): Promise<{ city: string; stateCode: UsStateCode } | null> {
  if (!/^\d{5}$/.test(zip)) return null
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const place = data?.places?.[0]
    if (!place) return null
    const code = normalizeStateCode(String(place['state abbreviation'] || ''))
    if (!code) return null
    return { city: String(place['place name'] || ''), stateCode: code }
  } catch (err) {
    log.warn('zipLookup failed', { zip, err: err instanceof Error ? err.message : err })
    return null
  }
}

/**
 * Cascada de fuentes para encontrar la ubicación US del cliente. Retorna null
 * solo si ningún sistema tiene el dato — en ese caso, el documento seguirá
 * saliendo con `[FALTA: Nombre del tribunal]` igual que hoy.
 *
 * Prioridad (de más a menos confiable):
 *   1. contracts.client_state/city/zip/address   → confidence high, source contract
 *   2. profiles.address_state/city/zip/street    → confidence high, source profile
 *   3. tutor_guardian.full_address (parse regex) → confidence medium, source tutor_form
 *   4. ZIP solo, via zippopotam.us               → confidence medium, source zip_derived
 */
export async function resolveClientLocation(
  caseId: string,
  client?: SupabaseClient,
): Promise<ClientLocation | null> {
  const supabase = client ?? createServiceClient()

  // Traemos el client_id del caso y toda la data relevante en 3 queries paralelas.
  const caseRes = await supabase
    .from('cases')
    .select('client_id')
    .eq('id', caseId)
    .single()

  const clientId = caseRes.data?.client_id
  if (!clientId) {
    log.warn('case has no client_id', { caseId })
    return null
  }

  const [contractsRes, profileRes, tutorRes] = await Promise.all([
    supabase
      .from('contracts')
      .select('client_state, client_city, client_zip, client_address')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('profiles')
      .select('address_state, address_city, address_zip, address_street')
      .eq('id', clientId)
      .single(),
    supabase
      .from('case_form_submissions')
      .select('form_data')
      .eq('case_id', caseId)
      .eq('form_type', 'tutor_guardian')
      .single(),
  ])

  // --- Fuente 1: contrato firmado ---
  const contract = contractsRes.data?.[0]
  if (contract) {
    const code = normalizeStateCode(contract.client_state || '')
    if (code) {
      return {
        stateCode: code,
        stateName: stateName(code),
        city: contract.client_city || null,
        zip: contract.client_zip || null,
        street: contract.client_address || null,
        source: 'contract',
        confidence: 'high',
      }
    }
  }

  // --- Fuente 2: profile del cliente ---
  const profile = profileRes.data
  if (profile) {
    const code = normalizeStateCode(profile.address_state || '')
    if (code) {
      return {
        stateCode: code,
        stateName: stateName(code),
        city: profile.address_city || null,
        zip: profile.address_zip || null,
        street: profile.address_street || null,
        source: 'profile',
        confidence: 'high',
      }
    }
  }

  // --- Fuente 3: parse del full_address del tutor ---
  const tutorForm = tutorRes.data?.form_data as Record<string, unknown> | null
  const fullAddress = (tutorForm?.full_address as string) || ''
  if (fullAddress) {
    const parsed = parseFreeAddress(fullAddress)
    if (parsed.stateCode) {
      return {
        stateCode: parsed.stateCode,
        stateName: stateName(parsed.stateCode),
        city: parsed.city,
        zip: parsed.zip,
        street: fullAddress,
        source: 'tutor_form',
        confidence: 'medium',
      }
    }

    // --- Fuente 4: solo hay ZIP en el string → zippopotam ---
    if (parsed.zip) {
      const fromZip = await zipLookup(parsed.zip)
      if (fromZip) {
        return {
          stateCode: fromZip.stateCode,
          stateName: stateName(fromZip.stateCode),
          city: fromZip.city,
          zip: parsed.zip,
          street: fullAddress,
          source: 'zip_derived',
          confidence: 'medium',
        }
      }
    }
  }

  log.info('could not resolve client location', { caseId, clientId })
  return null
}

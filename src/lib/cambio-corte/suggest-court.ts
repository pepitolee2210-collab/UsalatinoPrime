// Sugerencia de Nueva Corte (Change of Venue) a partir de la nueva dirección del
// cliente. Estrategia híbrida pedida por el usuario:
//   - Claude (claude-opus-4-7) hace el RAZONAMIENTO geográfico: dada la nueva
//     dirección, ¿qué Corte de Inmigración EOIR tiene jurisdicción?
//   - El CATÁLOGO curado (eoir-court-catalog.ts) es la fuente de los DATOS:
//     Claude solo devuelve la `key` de la corte; las direcciones exactas (corte
//     y OPLA/Chief Counsel) las tomamos del catálogo, NO del texto del modelo.
//     Así las direcciones legales nunca se alucinan.
//
// El staff SIEMPRE revisa la sugerencia antes de generar el PDF.

import { generateText } from '@/lib/ai/anthropic-client'
import { jsonrepair } from 'jsonrepair'
import { EOIR_COURTS, serializeCourtsForPrompt, type EoirCourt } from './eoir-court-catalog'
import { createLogger } from '@/lib/logger'

const log = createLogger('suggest-court')

export interface NewAddressInput {
  street?: string
  city?: string
  state?: string
  zip?: string
}

export interface CourtSuggestion {
  /** Vacío si no hubo match confiable. */
  new_court_name: string
  new_court_street: string
  new_court_city_state_zip: string
  /** Bloque OPLA/Chief Counsel de la NUEVA corte (referencia; no se imprime). */
  new_court_chief_counsel_address: string
  confidence: 'alta' | 'media' | 'baja'
  /** Explicación corta en español del porqué de la elección. */
  reasoning: string
  /** Key del catálogo que matcheó, o null. */
  matched_court_key: string | null
  /** Nota de verificación heredada del catálogo, si aplica. */
  note?: string
}

// ──────────────────────────────────────────────────────────────────
// Prompt. Las reglas de desambiguación viven aquí: este es el punto
// donde el criterio legal del equipo afina el comportamiento.
// ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un asistente legal experto en jurisdicción de las Cortes de Inmigración de EE. UU. (EOIR) y sus oficinas de fiscal principal (OPLA / Office of the Chief Counsel).

TAREA: dada la NUEVA dirección de residencia de un inmigrante en proceso de remoción (non-detained), identifica la Corte de Inmigración EOIR cuya jurisdicción territorial cubre esa dirección, eligiéndola EXCLUSIVAMENTE del catálogo provisto.

REGLAS:
1. Elige SOLO una corte que aparezca en el catálogo. NO inventes cortes, direcciones ni oficinas que no estén en el catálogo. Cada corte tiene un identificador key="..."; devuelve EXACTAMENTE ese valor en matched_court_key (solo el contenido, sin el prefijo key= ni comillas adicionales).
2. Razona por geografía: estado primero; dentro del estado, la corte de la ciudad/área metropolitana más cercana a la dirección. Para estados con varias cortes (CA, TX, NY, FL), escoge por proximidad de ciudad.
3. Prefiere cortes del docket NON-DETAINED. Solo sugiere una corte marcada [DETAINED] si es claramente la única opción razonable para esa área.
4. Si la dirección es ambigua, está incompleta, o ninguna corte del catálogo cubre con claridad esa zona, NO adivines: responde con matched_court_key=null y confidence="baja".
5. Asigna confidence:
   - "alta": el estado tiene una sola corte que claramente cubre el área, o la ciudad coincide con una corte del catálogo.
   - "media": estado con varias cortes y elegiste por proximidad razonable.
   - "baja": dudoso, incompleto o sin cobertura clara.
6. reasoning: 1-2 frases en español explicando la elección (qué ciudad/estado y por qué esa corte).

FORMATO DE SALIDA: responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown:
{"matched_court_key": "<key exacta del catálogo o null>", "confidence": "alta|media|baja", "reasoning": "<español>"}`

/**
 * Sugiere la nueva corte + su Chief Counsel a partir de la nueva dirección.
 * Devuelve siempre un objeto (confidence "baja" con campos vacíos si no hay match).
 */
export async function suggestCourtFromAddress(addr: NewAddressInput): Promise<CourtSuggestion> {
  const empty: CourtSuggestion = {
    new_court_name: '', new_court_street: '', new_court_city_state_zip: '',
    new_court_chief_counsel_address: '', confidence: 'baja', matched_court_key: null,
    reasoning: '',
  }

  const addrText = [addr.street, addr.city, addr.state, addr.zip].map((s) => (s ?? '').trim()).filter(Boolean).join(', ')
  if (!addrText) {
    return { ...empty, reasoning: 'No se proporcionó una nueva dirección.' }
  }

  // El catálogo completo va como segundo bloque de system (cacheable).
  const catalog = `CATÁLOGO DE CORTES EOIR (fuente autoritativa):\n${serializeCourtsForPrompt(EOIR_COURTS)}`

  let raw: string
  try {
    raw = await generateText({
      system: SYSTEM_PROMPT,
      extraSystem: catalog,
      user: `Nueva dirección del cliente:\n${addrText}\n\nDevuelve el JSON con la corte EOIR correspondiente.`,
      maxTokens: 600,
      logLabel: 'suggest-court',
    })
  } catch (err) {
    log.error('claude error', { err: err instanceof Error ? err.message : err })
    throw new Error('No se pudo consultar la sugerencia de corte')
  }

  // Parseo robusto: Claude debería devolver JSON puro, pero saneamos por si trae
  // texto/markdown alrededor.
  let parsed: { matched_court_key?: string | null; confidence?: string; reasoning?: string }
  try {
    const jsonSlice = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
    parsed = JSON.parse(jsonrepair(jsonSlice || raw))
  } catch {
    log.warn('failed to parse suggestion json', { raw: raw.slice(0, 200) })
    return { ...empty, reasoning: 'No se pudo interpretar la sugerencia. Ingresa la corte manualmente.' }
  }

  const key = parsed.matched_court_key
  const confidence = (['alta', 'media', 'baja'] as const).includes(parsed.confidence as 'alta' | 'media' | 'baja')
    ? (parsed.confidence as 'alta' | 'media' | 'baja')
    : 'baja'
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : ''

  if (!key) {
    return { ...empty, confidence, reasoning: reasoning || 'No se identificó una corte con seguridad.' }
  }

  // Las direcciones SIEMPRE vienen del catálogo (verdad), no del modelo.
  const court: EoirCourt | undefined = EOIR_COURTS.find((c) => c.key === key)
  if (!court) {
    log.warn('claude returned unknown court key', { key })
    return { ...empty, confidence: 'baja', reasoning: reasoning || 'La corte sugerida no está en el catálogo.' }
  }

  return {
    new_court_name: court.name,
    new_court_street: court.courtStreet,
    new_court_city_state_zip: court.courtCityStateZip,
    new_court_chief_counsel_address: court.chiefCounselAddress,
    confidence,
    reasoning,
    matched_court_key: court.key,
    note: court.note,
  }
}

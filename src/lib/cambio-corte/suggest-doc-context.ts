// Asistencia IA para el párrafo de "contexto documental" de la moción de Cambio
// de Corte. Lee los documentos que el cliente subió (estados de cuenta, contrato
// de alquiler, recibos, constancia de trabajo, etc.), y redacta un párrafo en
// inglés legal que los referencie explícitamente como prueba de la nueva
// residencia — cubriendo casos como el del contrato de alquiler a nombre del
// cónyuge ("Elio").
//
// Reusa el motor de extracción existente (extractDocumentsForCase → Gemini Vision
// cachea documents.extracted_text). El texto resultante lo edita el staff antes
// de generar el PDF; se guarda en CartaCambioCorteData.additional_context.

import { generateText } from '@/lib/ai/anthropic-client'
import { extractDocumentsForCase } from '@/lib/ai/extract-documents'
import { createServiceClient } from '@/lib/supabase/service'
import type { NewAddressInput } from './suggest-court'
import { createLogger } from '@/lib/logger'

const log = createLogger('suggest-doc-context')

const PER_DOC_CHARS = 1500

export interface DocContextInput {
  caseId: string
  /** Nueva dirección, para que el párrafo la mencione con precisión. */
  newAddress?: NewAddressInput
  /** Nota/borrador que el staff ya escribió (la IA la mejora en vez de ignorarla). */
  staffNote?: string
}

export interface DocContextResult {
  text: string
  /** Nombres de los documentos que se consideraron. */
  documentsUsed: string[]
}

const SYSTEM_PROMPT = `Eres un asistente legal que redacta una "Motion to Change Venue" ante una Corte de Inmigración de EE. UU. (EOIR), en nombre del respondent (primera persona, en INGLÉS legal formal).

TAREA: redacta UN solo párrafo (2 a 4 oraciones) que referencie los DOCUMENTOS ADJUNTOS del expediente como prueba de la nueva residencia del respondent.

REGLAS:
- Básate ÚNICAMENTE en los documentos provistos y en la nueva dirección dada. No inventes documentos, nombres, montos ni fechas que no aparezcan.
- Si un comprobante está a nombre de un tercero (p. ej. el cónyuge), EXPLÍCALO con naturalidad ("the attached lease agreement, executed in the name of my spouse, NAME, with whom I reside, ...").
- Menciona los documentos por su tipo (lease agreement, utility bill, pay stub, employment verification letter, bank statement, etc.).
- Tono: formal, sobrio, primera persona ("I", "my"). Sin encabezados, sin viñetas, sin comillas alrededor del párrafo.
- Si el staff incluyó un borrador, mejóralo y complétalo sin contradecir los documentos.
- Devuelve SOLO el texto del párrafo en inglés, nada más.`

export async function suggestDocContext(input: DocContextInput): Promise<DocContextResult> {
  const { caseId } = input
  const service = createServiceClient()

  // Asegura que los documentos del cliente tengan texto extraído (cacheado).
  try {
    await extractDocumentsForCase(caseId)
  } catch (err) {
    log.warn('extraction step failed (continuing with whatever is cached)', { caseId, err: err instanceof Error ? err.message : err })
  }

  const { data: docs } = await service
    .from('documents')
    .select('name, document_key, extracted_text')
    .eq('case_id', caseId)
    .eq('direction', 'client_to_admin')

  const usable = (docs ?? []).filter(
    (d) => typeof d.extracted_text === 'string' && d.extracted_text.trim() && !d.extracted_text.startsWith('[Error'),
  ) as Array<{ name: string; document_key: string; extracted_text: string }>

  if (usable.length === 0) {
    return {
      text: '',
      documentsUsed: [],
    }
  }

  const addrText = [input.newAddress?.street, input.newAddress?.city, input.newAddress?.state, input.newAddress?.zip]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ')

  const docsBlock = usable
    .map((d, i) => `Documento ${i + 1} — ${d.name} (tipo: ${d.document_key}):\n${d.extracted_text.slice(0, PER_DOC_CHARS)}`)
    .join('\n\n---\n\n')

  const userText = [
    addrText ? `Nueva dirección del respondent: ${addrText}` : 'Nueva dirección: (no especificada)',
    input.staffNote?.trim() ? `Borrador del equipo legal (mejóralo):\n${input.staffNote.trim()}` : '',
    `Documentos adjuntos del expediente:\n\n${docsBlock}`,
    'Redacta el párrafo en inglés legal.',
  ]
    .filter(Boolean)
    .join('\n\n')

  let text: string
  try {
    text = await generateText({
      system: SYSTEM_PROMPT,
      user: userText,
      maxTokens: 900,
      logLabel: 'suggest-doc-context',
    })
  } catch (err) {
    log.error('claude error', { caseId, err: err instanceof Error ? err.message : err })
    throw new Error('No se pudo generar el contexto documental')
  }

  return {
    text: text.trim(),
    documentsUsed: usable.map((d) => d.name),
  }
}

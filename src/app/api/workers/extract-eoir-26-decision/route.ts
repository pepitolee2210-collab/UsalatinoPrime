import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash/client'
import { createServiceClient } from '@/lib/supabase/service'
import { extractEoir26DecisionFromDoc } from '@/lib/ai/extract-eoir-26-decision'
import { createLogger } from '@/lib/logger'

const log = createLogger('worker:extract-eoir-26-decision')

/**
 * Worker async para extraer `decision_date` del "Auto de Denegación del Juez"
 * subido por el cliente y guardarla en `documents.ai_extracted_data` para que
 * el prefill del EOIR-26 la consuma.
 *
 * Trigger: QStash invoca este endpoint desde `upload-confirm/route.ts` cuando
 * el cliente sube un documento con `document_key='apelacion_denegacion_juez'`.
 *
 * Diseño:
 *   - Verifica firma QStash en producción (sin la verificación, cualquiera
 *     podría invocar el endpoint y gastar cuota de Gemini).
 *   - Marca status='processing' → llama Gemini → persiste ai_extracted_data y
 *     status='completed' o 'failed'.
 *   - Devuelve 200 en error de aplicación para que QStash NO reintente (los
 *     reintentos solo aplican a errores de transporte).
 */
export const maxDuration = 60

interface WorkerPayload {
  documentId: string
  caseId: string
}

export async function POST(request: NextRequest) {
  const raw = await request.text()
  const signature = request.headers.get('upstash-signature')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const selfUrl = `${proto}://${host}${request.nextUrl.pathname}`

  const valid = await verifyQStashSignature({ signature, body: raw, url: selfUrl })
  if (!valid && process.env.NODE_ENV === 'production') {
    log.warn('invalid qstash signature')
    return new NextResponse('Forbidden', { status: 403 })
  }

  let payload: WorkerPayload
  try {
    payload = JSON.parse(raw) as WorkerPayload
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const { documentId, caseId } = payload
  if (!documentId || !caseId) {
    return new NextResponse('Bad Request: documentId y caseId requeridos', { status: 400 })
  }

  const service = createServiceClient()

  await service
    .from('documents')
    .update({ ai_extraction_status: 'processing' })
    .eq('id', documentId)

  try {
    const extracted = await extractEoir26DecisionFromDoc(documentId, service)

    const { error: updErr } = await service
      .from('documents')
      .update({
        ai_extracted_data: { eoir_26: extracted },
        ai_extraction_status: 'completed',
        ai_extracted_at: new Date().toISOString(),
        ai_extraction_error: null,
      })
      .eq('id', documentId)

    if (updErr) {
      log.error('error guardando ai_extracted_data', { documentId, updErr })
      return new NextResponse('DB Update Error', { status: 500 })
    }

    log.info('decision_date extraída y guardada', {
      documentId,
      caseId,
      decision_date: extracted.decision_date,
    })
    return NextResponse.json({ ok: true, documentId, ...extracted })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    log.error('extracción falló', { documentId, caseId, err: errorMessage })

    await service
      .from('documents')
      .update({
        ai_extraction_status: 'failed',
        ai_extraction_error: errorMessage.slice(0, 2000),
      })
      .eq('id', documentId)

    // 200 — error de aplicación, no de transporte. QStash NO debe reintentar.
    return NextResponse.json({ ok: false, documentId, error: errorMessage }, { status: 200 })
  }
}

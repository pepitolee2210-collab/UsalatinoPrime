import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash/client'
import { createServiceClient } from '@/lib/supabase/service'
import {
  generateAppealLetter,
  MissingClientDocumentError,
} from '@/lib/ai/generate-appeal-letter'
import { createLogger } from '@/lib/logger'

const log = createLogger('worker:appeal-letter')

/**
 * `maxDuration` máximo en serverless functions de Vercel para nuestro plan.
 * El worker NO es invocado por el usuario directo — QStash lo invoca async,
 * pero igual está limitado por el runtime de Vercel. 300s = 5 minutos, espacio
 * suficiente para 4 PDFs + Opus 4.7 con thinking adaptive.
 *
 * Si el plan de Vercel no soporta 300s, baja a 120-180s y el endpoint debe
 * detectar timeout próximo (AbortSignal) y persistir error_message claro.
 */
export const maxDuration = 300

interface WorkerPayload {
  draftId: string
  caseId: string
  userId: string
}

/**
 * Worker async para generar la Carta de Apelación con Claude.
 *
 * Flujo:
 *  1. QStash invoca este endpoint con firma criptográfica.
 *  2. Verificamos la firma — sin esta validación cualquiera podría invocar
 *     el endpoint y gastar nuestra cuota de Anthropic.
 *  3. Actualizamos el draft a status='generating' (job_started_at).
 *  4. Llamamos a generateAppealLetter() — esto carga 3 PDFs del cliente +
 *     template, llama a Claude con thinking adaptive, parsea markdown.
 *  5. Persistimos result (body_md, tokens, latency) y status='ready'.
 *  6. Si algo falla, status='failed' con error_message para que la UI lo muestre.
 */
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

  const { draftId, caseId } = payload
  if (!draftId || !caseId) {
    return new NextResponse('Bad Request: draftId y caseId requeridos', { status: 400 })
  }

  const service = createServiceClient()

  // Marcar como generating con timestamp
  await service
    .from('case_appeal_letter_drafts')
    .update({ status: 'generating', job_started_at: new Date().toISOString() })
    .eq('id', draftId)

  try {
    const result = await generateAppealLetter({ caseId, service })

    const { error: updErr } = await service
      .from('case_appeal_letter_drafts')
      .update({
        body_md: result.bodyMarkdown,
        status: 'ready',
        model_used: result.modelUsed,
        prompt_version: result.promptVersion,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        cache_read_tokens: result.usage.cacheReadTokens,
        cache_creation_tokens: result.usage.cacheCreationTokens,
        generation_seconds: result.generationSeconds,
        job_finished_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', draftId)

    if (updErr) {
      log.error('error guardando resultado', { draftId, updErr })
      return new NextResponse('DB Update Error', { status: 500 })
    }

    log.info('appeal letter generado y guardado', {
      draftId,
      caseId,
      seconds: result.generationSeconds,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
    })

    return NextResponse.json({ ok: true, draftId })
  } catch (err) {
    const errorMessage = err instanceof MissingClientDocumentError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err)

    log.error('error generando carta', { draftId, caseId, err: errorMessage })

    await service
      .from('case_appeal_letter_drafts')
      .update({
        status: 'failed',
        error_message: errorMessage.slice(0, 2000),
        job_finished_at: new Date().toISOString(),
      })
      .eq('id', draftId)

    // Devolvemos 200 para que QStash NO reintente automáticamente — el error
    // fue de aplicación (no de transporte). Si fuera 500, QStash reintenta
    // hasta 3 veces y gastaríamos 3x el costo de Claude.
    return NextResponse.json({ ok: false, draftId, error: errorMessage }, { status: 200 })
  }
}

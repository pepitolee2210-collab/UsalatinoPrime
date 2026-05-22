import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash/client'
import { createServiceClient } from '@/lib/supabase/service'
import {
  generateEoir26aLetter,
  MissingEoir26aInputError,
} from '@/lib/ai/generate-eoir26a-letter'
import { createLogger } from '@/lib/logger'

const log = createLogger('worker:eoir26a-letter')

/**
 * `maxDuration` para esta serverless function. La carta de exoneración es
 * mucho más corta que el appeal brief (~30-60s vs 60-150s), así que 180s es
 * holgado pero no excesivo (el plan de Vercel cobra por segundo).
 */
export const maxDuration = 180

interface WorkerPayload {
  draftId: string
  caseId: string
  userId: string
}

/**
 * Worker async para generar la Carta de Exoneración con Claude.
 *
 * Flujo:
 *  1. QStash invoca con firma criptográfica.
 *  2. Verificamos la firma — sin esto, cualquiera podría triggerar gastos
 *     en Anthropic.
 *  3. status='generating' (job_started_at).
 *  4. generateEoir26aLetter() — carga PDFs, form data, llama a Claude.
 *  5. Persistimos body_md + usage + status='ready'.
 *  6. Si falla, status='failed' con error_message visible en la UI.
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

  await service
    .from('case_eoir26a_letter_drafts')
    .update({ status: 'generating', job_started_at: new Date().toISOString() })
    .eq('id', draftId)

  try {
    const result = await generateEoir26aLetter({ caseId, service })

    const { error: updErr } = await service
      .from('case_eoir26a_letter_drafts')
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

    log.info('eoir26a letter generado y guardado', {
      draftId,
      caseId,
      seconds: result.generationSeconds,
      formCompleted: result.formCompleted,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
    })

    return NextResponse.json({ ok: true, draftId })
  } catch (err) {
    const errorMessage = err instanceof MissingEoir26aInputError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err)

    log.error('error generando carta', { draftId, caseId, err: errorMessage })

    await service
      .from('case_eoir26a_letter_drafts')
      .update({
        status: 'failed',
        error_message: errorMessage.slice(0, 2000),
        job_finished_at: new Date().toISOString(),
      })
      .eq('id', draftId)

    // 200 para que QStash NO reintente: si fuera 500, reintenta 3 veces y
    // gastaríamos 3x el costo de Claude por un error de aplicación.
    return NextResponse.json({ ok: false, draftId, error: errorMessage }, { status: 200 })
  }
}

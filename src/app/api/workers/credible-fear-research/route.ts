import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature, enqueueJob } from '@/lib/qstash/client'
import { createServiceClient } from '@/lib/supabase/service'
import { runResearchPhase, runDraftPhase1, runDraftPhase2 } from '@/lib/ai/credible-fear-pipeline'
import { createLogger } from '@/lib/logger'

const log = createLogger('worker:credible-fear-research')

// Worker A del Miedo Creíble v7: análisis E1-E8 + jurisprudencia (web_search) +
// noticias verificadas. Al terminar (status DRAFTING) encola el Worker B1.
export const maxDuration = 800

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

  let payload: { caseId?: string; draftId?: string }
  try {
    payload = JSON.parse(raw)
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }
  const { caseId, draftId } = payload
  if (!caseId || !draftId) return new NextResponse('Bad Request: caseId/draftId requerido', { status: 400 })

  const service = createServiceClient()
  const startMs = Date.now()
  log.info('research worker started', { caseId, draftId })

  const r = await runResearchPhase({ caseId, draftId, service })

  if (r.status === 'DRAFTING') {
    let enqueued = false
    if (host && process.env.QSTASH_TOKEN) {
      try {
        await enqueueJob({
          endpoint: `${proto}://${host}/api/workers/credible-fear-draft`,
          body: { caseId, draftId },
          retries: 0,
          deduplicationId: `cf-v7-draft:${draftId}`,
        })
        enqueued = true
      } catch (err) {
        log.error('enqueue draft worker failed', { draftId, err: String(err) })
      }
    }
    if (!enqueued) {
      // No se pudo encolar el Worker B. Si la fase research fue rápida y queda
      // presupuesto de tiempo en esta función, corremos el draft inline; si no,
      // marcamos FAILED para no dejar el draft atascado en DRAFTING ni arriesgar
      // un corte de Vercel a mitad del documento.
      const elapsedMs = Date.now() - startMs
      const SAFE_INLINE_BUDGET_MS = 400_000
      if (elapsedMs < SAFE_INLINE_BUDGET_MS) {
        const d1 = await runDraftPhase1({ caseId, draftId, service })
        if (d1.status === 'DRAFTING') await runDraftPhase2({ caseId, draftId, service })
      } else {
        await service
          .from('case_credible_fear_drafts')
          .update({ status: 'FAILED', generation_error: 'No se pudo encolar la fase de redacción; reintenta la generación.' })
          .eq('id', draftId)
        log.error('draft no encolado y sin presupuesto inline — marcado FAILED', { draftId, elapsedMs })
      }
    }
  }

  log.info('research worker finished', { caseId, draftId, status: r.status, elapsedMs: Date.now() - startMs })
  return NextResponse.json({ ok: true, caseId, draftId, status: r.status })
}

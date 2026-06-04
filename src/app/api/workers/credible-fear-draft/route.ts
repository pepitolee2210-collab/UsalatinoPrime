import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature, enqueueJob } from '@/lib/qstash/client'
import { createServiceClient } from '@/lib/supabase/service'
import { runDraftPhase1, runDraftPhase2 } from '@/lib/ai/credible-fear-pipeline'
import { createLogger } from '@/lib/logger'

const log = createLogger('worker:credible-fear-draft')

// Worker B1 del Miedo Creíble v7: redacta las secciones I.1-I.3 del brief + la
// tabla cronológica, persiste parcial y encola el Worker B2 (I.4-I.5 + ensamblaje).
// El split + redacción en Sonnet mantiene cada worker por debajo del límite.
// 300s = máximo del plan Vercel (Pro); un valor mayor rompe el deploy.
export const maxDuration = 300

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
  log.info('draft B1 worker started', { caseId, draftId })

  const r = await runDraftPhase1({ caseId, draftId, service })

  if (r.status === 'DRAFTING') {
    let enqueued = false
    if (host && process.env.QSTASH_TOKEN) {
      try {
        await enqueueJob({
          endpoint: `${proto}://${host}/api/workers/credible-fear-draft2`,
          body: { caseId, draftId },
          retries: 0,
          deduplicationId: `cf-v7-draft2:${draftId}`,
        })
        enqueued = true
      } catch (err) {
        log.error('enqueue draft2 failed', { draftId, err: String(err) })
      }
    }
    if (!enqueued) {
      // Sin QStash (dev) o falló el encolado: corre la fase 2 inline.
      await runDraftPhase2({ caseId, draftId, service })
    }
  }

  log.info('draft B1 worker finished', { caseId, draftId, status: r.status, elapsedMs: Date.now() - startMs })
  return NextResponse.json({ ok: true, caseId, draftId, status: r.status })
}

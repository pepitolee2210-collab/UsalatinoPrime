import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature, enqueueJob } from '@/lib/qstash/client'
import { createServiceClient } from '@/lib/supabase/service'
import { runDraftGroup, runAllDraftGroups } from '@/lib/ai/credible-fear-pipeline'
import { createLogger } from '@/lib/logger'

const log = createLogger('worker:credible-fear-draft')

// Worker de redacción del Miedo Creíble v7.1, RE-ENCOLABLE (self-chaining).
// Procesa un grupo de secciones (SECTION_GROUPS[groupIndex]), persiste el
// parcial y, si quedan grupos, se re-encola a sí mismo con el siguiente índice.
// El último grupo ensambla el documento. El split en grupos pequeños + Sonnet
// mantienen cada invocación bien por debajo del límite de tiempo de Vercel.
// 300s = máximo del plan Hobby; con Pro hay más margen. Un valor mayor al que el
// plan permite hace que Vercel RECHACE el deploy completo.
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

  let payload: { caseId?: string; draftId?: string; groupIndex?: number }
  try {
    payload = JSON.parse(raw)
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }
  const { caseId, draftId } = payload
  const groupIndex = payload.groupIndex ?? 0
  if (!caseId || !draftId) return new NextResponse('Bad Request: caseId/draftId requerido', { status: 400 })

  const service = createServiceClient()
  const startMs = Date.now()
  log.info('draft worker started', { caseId, draftId, groupIndex })

  const r = await runDraftGroup({ caseId, draftId, groupIndex, service })

  // Quedan grupos por redactar → re-encolar el siguiente (self-chaining).
  if (r.status === 'DRAFTING' && r.nextGroup !== null) {
    let enqueued = false
    if (host && process.env.QSTASH_TOKEN) {
      try {
        await enqueueJob({
          endpoint: `${proto}://${host}/api/workers/credible-fear-draft`,
          body: { caseId, draftId, groupIndex: r.nextGroup },
          retries: 0,
          deduplicationId: `cf-v7-draft:${draftId}:g${r.nextGroup}`,
        })
        enqueued = true
      } catch (err) {
        log.error('enqueue next draft group failed', { draftId, nextGroup: r.nextGroup, err: String(err) })
      }
    }
    if (!enqueued) {
      // Sin QStash (dev) o falló el encolado: corre los grupos restantes inline.
      await runAllDraftGroups({ caseId, draftId, service, startIndex: r.nextGroup })
    }
  }

  log.info('draft worker finished', { caseId, draftId, groupIndex, status: r.status, elapsedMs: Date.now() - startMs })
  return NextResponse.json({ ok: true, caseId, draftId, groupIndex, status: r.status, nextGroup: r.nextGroup })
}

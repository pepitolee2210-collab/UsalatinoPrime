import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash/client'
import { createServiceClient } from '@/lib/supabase/service'
import { runDraftPhase } from '@/lib/ai/credible-fear-pipeline'
import { createLogger } from '@/lib/logger'

const log = createLogger('worker:credible-fear-draft')

// Worker B del Miedo Creíble v7: redacta el Legal Brief seccionado + tabla
// cronológica y ensambla el documento final (~20 págs) en body_md.
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
  log.info('draft worker started', { caseId, draftId })

  const r = await runDraftPhase({ caseId, draftId, service })

  log.info('draft worker finished', { caseId, draftId, status: r.status, elapsedMs: Date.now() - startMs })
  return NextResponse.json({ ok: true, caseId, draftId, status: r.status })
}

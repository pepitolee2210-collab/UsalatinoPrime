import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash/client'
import { runJurisdictionResearchSync } from '@/lib/legal/trigger-research-async'
import { createLogger } from '@/lib/logger'

const log = createLogger('jurisdiction-worker')

interface JobPayload {
  caseId: string
}

/**
 * Worker QStash para investigación de jurisdicción SIJS.
 *
 * Disparado por triggerJurisdictionResearchAsync(). Tiene maxDuration=300s
 * (5 min) que es suficiente para 15 web_searches + Claude Opus + persistencia.
 * El handler que lo encola responde en <2s al usuario; este worker corre en
 * background bajo la infraestructura de QStash.
 *
 * QStash reintenta 3 veces si devolvemos 5xx. La función es idempotente:
 * si la fila ya está `completed` no rehace nada.
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

  let payload: JobPayload
  try {
    payload = JSON.parse(raw) as JobPayload
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  if (!payload.caseId) {
    return new NextResponse('caseId required', { status: 400 })
  }

  try {
    await runJurisdictionResearchSync(payload.caseId)
    return NextResponse.json({ ok: true, caseId: payload.caseId })
  } catch (err) {
    log.error('worker error', { caseId: payload.caseId, err: err instanceof Error ? err.message : err })
    // 5xx → QStash reintenta. La función ya persistió `failed` con el error,
    // así que el reintento solo añade ruido — pero no es destructivo.
    return new NextResponse('Server Error', { status: 500 })
  }
}

export const maxDuration = 300 // 5 min — research con 15 web_searches + Claude Opus

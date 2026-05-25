import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash/client'
import { runJurisdictionResearchSync } from '@/lib/legal/trigger-research-async'
import { createLogger } from '@/lib/logger'

const log = createLogger('worker:research-jurisdiction')

/**
 * `maxDuration` máximo en serverless functions de Vercel (Pro). Patrón
 * espejo de `generate-appeal-letter`. El worker NO es invocado por el
 * usuario directo — QStash lo invoca async, por eso sobrevive a que Diana
 * cierre la pestaña.
 */
export const maxDuration = 300

interface WorkerPayload {
  caseId: string
}

/**
 * Worker async para investigar la jurisdicción de un caso (corte, forms,
 * filing channel, intake packet).
 *
 * Flujo:
 *  1. QStash invoca este endpoint con firma criptográfica.
 *  2. Verificamos la firma — sin esta validación cualquiera podría invocar
 *     el endpoint y gastar nuestra cuota de Anthropic/Tavily.
 *  3. `runJurisdictionResearchSync(caseId)` ya gestiona persistencia de
 *     estado en `case_jurisdictions` (pending → completed/failed/incomplete).
 *  4. El frontend pollea cada 5s vía jurisdiction-panel mientras `pending`.
 *
 * Devolvemos 200 siempre que la lógica corrió hasta el final (incluso si
 * fue `failed`) para que QStash NO reintente — el research_status='failed'
 * persistido ya comunica el error al frontend.
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

  const { caseId } = payload
  if (!caseId) {
    return new NextResponse('Bad Request: caseId requerido', { status: 400 })
  }

  const startMs = Date.now()
  log.info('research started via QStash', { caseId })

  try {
    await runJurisdictionResearchSync(caseId)
    log.info('research finished', { caseId, elapsedMs: Date.now() - startMs })
    return NextResponse.json({ ok: true, caseId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('research threw unexpected', { caseId, err: message, elapsedMs: Date.now() - startMs })
    return NextResponse.json({ ok: false, caseId, error: message }, { status: 200 })
  }
}

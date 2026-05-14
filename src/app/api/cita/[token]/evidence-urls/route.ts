import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkUrlReachable } from '@/lib/legal/verify-url-reachability'
import { createLogger } from '@/lib/logger'

const log = createLogger('evidence-urls')

/**
 * Endpoints del cliente para gestionar URLs de evidencia (Asilo Político Fase 2).
 *
 *   GET    /api/cita/[token]/evidence-urls      → listar URLs del caso
 *   POST   /api/cita/[token]/evidence-urls      → agregar URL
 *
 * El DELETE individual está en `[id]/route.ts`.
 *
 * Autenticación: `appointment_tokens.token` activo + caso del token.
 * Rate limit: máximo 20 URLs por caso (config `MAX_URLS_PER_CASE`).
 */

const MAX_URLS_PER_CASE = 20

async function resolveCaseFromToken(token: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('appointment_tokens')
    .select('case_id, is_active')
    .eq('token', token)
    .single()
  if (!data?.is_active) return null
  return { caseId: data.case_id as string, supabase }
}

function deriveDomain(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const ctx = await resolveCaseFromToken(token)
  if (!ctx) return NextResponse.json({ error: 'Token inválido' }, { status: 403 })

  const { data, error } = await ctx.supabase
    .from('case_evidence_urls')
    .select('id, url, title, source_domain, description, reachable, reachable_checked_at, added_at')
    .eq('case_id', ctx.caseId)
    .order('added_at', { ascending: false })

  if (error) {
    log.error('error listando evidence urls', { caseId: ctx.caseId, error })
    return NextResponse.json({ error: 'Error al listar URLs' }, { status: 500 })
  }
  return NextResponse.json({ urls: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const ctx = await resolveCaseFromToken(token)
  if (!ctx) return NextResponse.json({ error: 'Token inválido' }, { status: 403 })

  let body: { url?: string; title?: string; description?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const url = String(body.url ?? '').trim()
  if (!url) return NextResponse.json({ error: 'url requerida' }, { status: 400 })
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'URL debe empezar con http:// o https://' }, { status: 400 })
  }

  // Rate limit por caso
  const { count } = await ctx.supabase
    .from('case_evidence_urls')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', ctx.caseId)
  if ((count ?? 0) >= MAX_URLS_PER_CASE) {
    return NextResponse.json(
      { error: `Máximo ${MAX_URLS_PER_CASE} URLs por caso` },
      { status: 429 },
    )
  }

  // Verificación de reachability (best-effort, no bloqueante)
  let reachable: boolean | null = null
  try {
    const check = await checkUrlReachable(url)
    reachable = check.reachable
  } catch {
    reachable = null
  }

  const { data, error } = await ctx.supabase
    .from('case_evidence_urls')
    .insert({
      case_id: ctx.caseId,
      url,
      title: body.title?.trim() || null,
      description: body.description?.trim() || null,
      source_domain: deriveDomain(url),
      reachable,
      reachable_checked_at: new Date().toISOString(),
    })
    .select('id, url, title, source_domain, description, reachable, added_at')
    .single()

  if (error) {
    log.error('error insertando evidence url', { caseId: ctx.caseId, error })
    return NextResponse.json({ error: 'Error al guardar URL' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, evidence: data })
}

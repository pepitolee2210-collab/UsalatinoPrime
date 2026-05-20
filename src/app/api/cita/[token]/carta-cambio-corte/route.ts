// Endpoint cliente para la Carta de Cambio de Corte (6 págs).
//
// Espejo de /api/admin/cases/[id]/carta-cambio-corte pero autenticando por
// appointment_token (no por sesión Supabase). Cliente y admin escriben/leen
// LA MISMA fila case_form_instances → bidireccional.
//
// El cliente NO puede generar el PDF (POST) — eso queda solo para
// Diana/Henry desde el dashboard. Solo GET y PUT.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { CartaCambioCorteData } from '@/lib/cambio-corte/letter-generator'
import {
  ensureCartaInstance,
  buildCartaPrefill,
  saveCartaValues,
} from '@/lib/cambio-corte/persistence'

async function resolveTokenToCase(token: string) {
  const service = createServiceClient()
  const { data: tokenData } = await service
    .from('appointment_tokens')
    .select('case_id, client_id, is_active')
    .eq('token', token)
    .single()
  if (!tokenData?.is_active) return null
  return { caseId: tokenData.case_id as string, clientId: tokenData.client_id as string, service }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const resolved = await resolveTokenToCase(token)
  if (!resolved) return NextResponse.json({ error: 'Token inválido' }, { status: 403 })

  let instance
  try {
    instance = await ensureCartaInstance(resolved.caseId, resolved.service)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }

  if (instance.locked_for_client) {
    return NextResponse.json({
      locked: true,
      instance_id: instance.id,
      status: instance.status,
      updated_at: instance.updated_at,
      prefill: await buildCartaPrefill(resolved.caseId, resolved.service),
      saved: (instance.filled_values ?? {}) as Partial<CartaCambioCorteData>,
    })
  }

  const prefill = await buildCartaPrefill(resolved.caseId, resolved.service)
  const saved = (instance.filled_values ?? {}) as Partial<CartaCambioCorteData>

  return NextResponse.json({
    locked: false,
    instance_id: instance.id,
    status: instance.status,
    updated_at: instance.updated_at,
    client_last_edit_at: instance.client_last_edit_at,
    client_submitted_at: instance.client_submitted_at,
    prefill,
    saved,
  })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const resolved = await resolveTokenToCase(token)
  if (!resolved) return NextResponse.json({ error: 'Token inválido' }, { status: 403 })

  let body: { values?: Partial<CartaCambioCorteData> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  if (!body.values || typeof body.values !== 'object') {
    return NextResponse.json({ error: 'values requerido' }, { status: 400 })
  }

  let instance
  try {
    instance = await ensureCartaInstance(resolved.caseId, resolved.service)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
  if (instance.locked_for_client) {
    return NextResponse.json({ error: 'El formulario está bloqueado por tu equipo legal' }, { status: 403 })
  }

  try {
    const { updated_at } = await saveCartaValues(resolved.caseId, body.values, resolved.service, 'client')
    return NextResponse.json({ ok: true, updated_at })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

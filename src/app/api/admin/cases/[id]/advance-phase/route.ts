import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { CasePhase } from '@/types/database'

const VALID_PHASES: CasePhase[] = ['custodia', 'i360', 'i485', 'completado']

const PHASE_ORDER: Record<CasePhase, number> = {
  custodia: 0,
  i360: 1,
  i485: 2,
  completado: 3,
}

/**
 * POST /api/admin/cases/[id]/advance-phase
 *
 * Diana avanza el caso de fase. Requiere razón obligatoria. Inserta en
 * case_phase_history y actualiza cases.current_phase. Por defecto solo
 * permite avanzar (no retroceder) — para retroceder pasar `force=true`.
 *
 * Body: { toPhase: CasePhase, reason: string, force?: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  }

  // Body
  let body: { toPhase?: string; reason?: string; force?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const toPhase = body.toPhase as CasePhase | undefined
  const reason = (body.reason ?? '').trim()
  const force = body.force === true

  if (!toPhase || !VALID_PHASES.includes(toPhase)) {
    return NextResponse.json({ error: 'toPhase inválido' }, { status: 400 })
  }
  if (!reason || reason.length < 5) {
    return NextResponse.json({ error: 'Razón obligatoria (mínimo 5 caracteres)' }, { status: 400 })
  }

  // Validar caso existe + fase actual
  const { data: caseRow } = await service
    .from('cases')
    .select('id, case_number, current_phase')
    .eq('id', id)
    .single()
  if (!caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  const fromPhase = (caseRow.current_phase as CasePhase | null) ?? null

  if (fromPhase === toPhase) {
    return NextResponse.json({ error: 'El caso ya está en esa fase' }, { status: 400 })
  }

  // Por defecto bloquear retrocesos accidentales
  if (fromPhase && PHASE_ORDER[toPhase] < PHASE_ORDER[fromPhase] && !force) {
    return NextResponse.json(
      { error: `Estás retrocediendo de ${fromPhase} a ${toPhase}. Reenvía con force=true si es intencional.` },
      { status: 400 },
    )
  }

  // Insertar en historial
  const { error: histErr } = await service
    .from('case_phase_history')
    .insert({
      case_id: id,
      from_phase: fromPhase,
      to_phase: toPhase,
      changed_by: user.id,
      reason,
    })
  if (histErr) {
    return NextResponse.json({ error: 'Error al registrar historial' }, { status: 500 })
  }

  // Actualizar caso
  const { error: upErr } = await service
    .from('cases')
    .update({ current_phase: toPhase })
    .eq('id', id)
  if (upErr) {
    return NextResponse.json({ error: 'Error al actualizar fase' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    case_number: caseRow.case_number,
    from_phase: fromPhase,
    to_phase: toPhase,
  })
}

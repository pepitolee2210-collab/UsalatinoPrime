import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'
import { getServiceRegistry, getPhaseOrder, getPhaseDef } from '@/lib/services/registry'
import type { CasePhase } from '@/types/database'

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

  // Auth — admin o paralegal pueden avanzar fases (Diana no debe depender de Henry).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'
  const isParalegal = profile?.role === 'employee' && profile?.employee_type === 'paralegal'
  if (!isAdmin && !isParalegal) {
    return NextResponse.json({ error: 'Solo administradores y paralegals' }, { status: 403 })
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

  if (!toPhase) {
    return NextResponse.json({ error: 'toPhase inválido' }, { status: 400 })
  }
  if (!reason || reason.length < 5) {
    return NextResponse.json({ error: 'Razón obligatoria (mínimo 5 caracteres)' }, { status: 400 })
  }

  // Validar caso existe + fase actual + servicio
  const { data: caseRow } = await service
    .from('cases')
    .select('id, case_number, current_phase, service:service_catalog(slug)')
    .eq('id', id)
    .single<{
      id: string
      case_number: string
      current_phase: CasePhase | null
      service: { slug: string } | { slug: string }[] | null
    }>()
  if (!caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  const fromPhase = (caseRow.current_phase as CasePhase | null) ?? null
  const serviceSlug = Array.isArray(caseRow.service)
    ? caseRow.service[0]?.slug ?? null
    : caseRow.service?.slug ?? null

  const registry = getServiceRegistry(serviceSlug)
  if (!registry) {
    return NextResponse.json(
      { error: `El servicio "${serviceSlug}" no tiene fases configuradas` },
      { status: 400 },
    )
  }

  // toPhase debe ser válida para ESTE servicio (no para cualquier servicio fasado).
  if (!getPhaseDef(serviceSlug, toPhase)) {
    return NextResponse.json(
      { error: `toPhase "${toPhase}" no aplica al servicio ${serviceSlug}` },
      { status: 400 },
    )
  }

  if (fromPhase === toPhase) {
    return NextResponse.json({ error: 'El caso ya está en esa fase' }, { status: 400 })
  }

  // Por defecto bloquear retrocesos accidentales
  if (fromPhase && getPhaseOrder(serviceSlug, toPhase) < getPhaseOrder(serviceSlug, fromPhase) && !force) {
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

  // Bitácora: espejo de case_phase_history para feed único.
  await logActivity({
    caseId: id,
    category: 'case',
    subcategory: SUBCATEGORIES.CASE_PHASE_CHANGED,
    description: fromPhase
      ? `Cambio de fase: ${fromPhase} → ${toPhase}`
      : `Asignación inicial de fase: ${toPhase}`,
    metadata: { from_phase: fromPhase, to_phase: toPhase, reason },
    visibleToClient: false,
    actor: { kind: 'session', supabase },
    client: service,
  })

  return NextResponse.json({
    ok: true,
    case_number: caseRow.case_number,
    from_phase: fromPhase,
    to_phase: toPhase,
  })
}

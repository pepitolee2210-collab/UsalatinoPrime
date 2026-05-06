import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * PATCH /api/admin/contracts/[id]/minors
 *
 * Edita campos de un minor existente del contrato. Solo correcciones —
 * NO permite agregar/quitar minors. Si quieren un hijo nuevo, deben crear
 * un contrato nuevo.
 *
 * Body:
 *   {
 *     index: number,           // posición 0-based en contracts.minors
 *     patch: {
 *       fullName?: string,
 *       dob?: string,
 *       passport?: string,
 *       birthplace?: string
 *     }
 *   }
 *
 * Cascade: si el patch cambia `fullName`, actualiza también el snapshot
 * `documents.minor_label` de los docs ya subidos para ese hijo.
 */

interface MinorRecord {
  fullName?: string
  dob?: string
  passport?: string
  birthplace?: string
}

const MUTABLE_FIELDS = ['fullName', 'dob', 'passport', 'birthplace'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: contractId } = await params

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isContractsManager =
    profile?.role === 'employee' && profile?.employee_type === 'contracts_manager'
  if (!isAdmin && !isContractsManager) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: { index?: number; patch?: Partial<MinorRecord> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const index = body.index
  const patch = body.patch
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: 'index inválido' }, { status: 400 })
  }
  if (!patch || typeof patch !== 'object') {
    return NextResponse.json({ error: 'patch requerido' }, { status: 400 })
  }

  const sanitized: Partial<MinorRecord> = {}
  for (const k of MUTABLE_FIELDS) {
    const v = patch[k]
    if (v === undefined) continue
    if (typeof v !== 'string') {
      return NextResponse.json(
        { error: `Campo ${k} debe ser string` },
        { status: 400 },
      )
    }
    sanitized[k] = v.trim().slice(0, 200)
  }
  if (Object.keys(sanitized).length === 0) {
    return NextResponse.json({ error: 'No hay cambios en el patch' }, { status: 400 })
  }

  // Cargar contrato.
  const { data: contract, error: cErr } = await service
    .from('contracts')
    .select('id, case_id, minors')
    .eq('id', contractId)
    .single()

  if (cErr || !contract) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
  }

  const minors = (Array.isArray(contract.minors) ? contract.minors : []) as MinorRecord[]
  if (index >= minors.length) {
    return NextResponse.json(
      {
        error:
          'Índice fuera de rango. No se puede agregar un menor desde aquí — se requiere contrato nuevo.',
      },
      { status: 400 },
    )
  }

  const updatedMinor: MinorRecord = { ...minors[index], ...sanitized }
  const newMinors = [...minors]
  newMinors[index] = updatedMinor

  const { error: uErr } = await service
    .from('contracts')
    .update({ minors: newMinors, updated_at: new Date().toISOString() })
    .eq('id', contractId)

  if (uErr) {
    console.error('[admin/contracts/minors] update error:', uErr)
    return NextResponse.json(
      { error: 'Error al actualizar el contrato' },
      { status: 500 },
    )
  }

  // Cascade: si cambió fullName, refrescar minor_label de los docs.
  if (sanitized.fullName && contract.case_id) {
    await service
      .from('documents')
      .update({ minor_label: sanitized.fullName })
      .eq('case_id', contract.case_id)
      .eq('minor_index', index)
  }

  return NextResponse.json({ minor: updatedMinor })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  WITNESS_FORM_SLUG,
  isWitnessComplete,
  readWitnesses,
} from '@/lib/legal/asilo-testigos-form-schema'
import { isAsylumService } from '@/lib/services/asylum'

/**
 * POST /api/cita/[token]/asilo-testigos/submit
 *
 * Marca el formulario de testigos como enviado a la firma. No genera las
 * cartas — eso lo dispara Diana / Henry desde /admin/cases/[id]. Requiere al
 * menos un testigo con los campos obligatorios completos.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, is_active')
    .eq('token', token)
    .single()
  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, service:service_catalog(slug)')
    .eq('id', tokenData.case_id)
    .single<{ id: string; service: { slug: string } | { slug: string }[] | null }>()

  const serviceSlug = Array.isArray(caseRow?.service)
    ? caseRow?.service[0]?.slug
    : caseRow?.service?.slug
  if (!isAsylumService(serviceSlug)) {
    return NextResponse.json({ error: 'Caso no aplica' }, { status: 400 })
  }

  const { data: instance } = await supabase
    .from('case_form_instances')
    .select('id, filled_values, locked_for_client')
    .eq('case_id', tokenData.case_id)
    .eq('form_name', WITNESS_FORM_SLUG)
    .maybeSingle()
  if (!instance) {
    return NextResponse.json({ error: 'Formulario no iniciado' }, { status: 404 })
  }
  if (instance.locked_for_client) {
    return NextResponse.json(
      { error: 'El formulario está bloqueado por tu equipo legal.' },
      { status: 423 },
    )
  }

  const witnesses = readWitnesses(instance.filled_values)
  if (witnesses.length === 0 || !witnesses.some(isWitnessComplete)) {
    return NextResponse.json(
      { error: 'Agrega al menos un testigo con su nombre, nacionalidad, relación, desde cuándo lo conoce y qué presenció.' },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('case_form_instances')
    .update({
      // CHECK constraint: pending|detecting|ready|partial|complete|downloaded|failed
      status: 'complete',
      client_submitted_at: now,
      updated_at: now,
    })
    .eq('id', instance.id)
  if (error) {
    return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

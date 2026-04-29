import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AUTOMATED_FORMS } from '@/lib/legal/automated-forms-registry'

/**
 * POST /api/cita/[token]/forms/[slug]/submit
 *
 * Marca el formulario como enviado a revisión por Diana.
 * Cambia status='complete' (lista para imprimir) y setea client_submitted_at.
 * NO bloquea automáticamente — Diana decide cuándo lockear.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; slug: string }> },
) {
  const { token, slug } = await params
  const def = AUTOMATED_FORMS[slug]
  if (!def) {
    return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
  }

  const supabase = createServiceClient()
  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, is_active')
    .eq('token', token)
    .single()
  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { data: instance } = await supabase
    .from('case_form_instances')
    .select('id, locked_for_client')
    .eq('case_id', tokenData.case_id)
    .eq('form_name', def.formName)
    .maybeSingle()

  if (!instance) {
    return NextResponse.json({ error: 'Aún no has empezado este formulario' }, { status: 400 })
  }
  if (instance.locked_for_client) {
    return NextResponse.json({ error: 'Formulario bloqueado' }, { status: 423 })
  }

  await supabase
    .from('case_form_instances')
    .update({
      status: 'complete',
      client_submitted_at: new Date().toISOString(),
    })
    .eq('id', instance.id)

  return NextResponse.json({ ok: true, instance_status: 'complete' })
}

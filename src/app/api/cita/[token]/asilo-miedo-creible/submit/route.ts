import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  CREDIBLE_FEAR_QUESTIONNAIRE_SLUG,
  calculateProgress,
  type CFAnswers,
} from '@/lib/legal/asilo-miedo-creible-form-schema'
import { isAsylumService } from '@/lib/services/asylum'

/**
 * POST /api/cita/[token]/asilo-miedo-creible/submit
 *
 * Marca el cuestionario como enviado a la firma. No genera el Miedo Creíble
 * automáticamente — eso lo dispara Diana / Henry desde /admin/cases/[id].
 * Valida que las preguntas obligatorias visibles estén respondidas (el
 * wizard también lo valida, pero el server reverifica).
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
    .eq('form_name', CREDIBLE_FEAR_QUESTIONNAIRE_SLUG)
    .maybeSingle()
  if (!instance) {
    return NextResponse.json({ error: 'Cuestionario no iniciado' }, { status: 404 })
  }
  if (instance.locked_for_client) {
    return NextResponse.json(
      { error: 'El cuestionario está bloqueado por tu equipo legal.' },
      { status: 423 },
    )
  }

  const answers = (instance.filled_values as CFAnswers) ?? {}
  const progress = calculateProgress(answers)
  if (progress.pct < 100) {
    return NextResponse.json(
      {
        error: 'Aún faltan preguntas obligatorias por responder.',
        progress,
      },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('case_form_instances')
    .update({
      status: 'submitted',
      client_submitted_at: now,
      updated_at: now,
    })
    .eq('id', instance.id)
  if (error) {
    return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

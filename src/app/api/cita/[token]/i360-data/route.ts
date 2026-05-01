import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/cita/[token]/i360-data
 *
 * Carga el form_data del I-360 SIJS del caso asociado al token. El cliente
 * lo usa al abrir el wizard para precargar el progreso guardado. Los
 * guardados van por POST /api/client-story con form_type='i360_sijs'.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, client_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { data: submission } = await supabase
    .from('case_form_submissions')
    .select('form_data, status, updated_at, submitted_at, admin_notes')
    .eq('case_id', tokenData.case_id)
    .eq('form_type', 'i360_sijs')
    .eq('minor_index', 0)
    .maybeSingle()

  // Cargar contexto adicional para pre-llenado: tutor/menor/historia.
  const { data: prefillSources } = await supabase
    .from('case_form_submissions')
    .select('form_type, form_data')
    .eq('case_id', tokenData.case_id)
    .in('form_type', ['tutor_guardian', 'client_story', 'client_absent_parent'])
    .eq('minor_index', 0)

  const prefillByType: Record<string, Record<string, unknown>> = {}
  for (const s of prefillSources ?? []) {
    prefillByType[s.form_type] = (s.form_data as Record<string, unknown>) ?? {}
  }

  return NextResponse.json({
    case_id: tokenData.case_id,
    form_data: (submission?.form_data as Record<string, unknown> | null) ?? {},
    status: submission?.status ?? null,
    updated_at: submission?.updated_at ?? null,
    submitted_at: submission?.submitted_at ?? null,
    admin_notes: submission?.admin_notes ?? null,
    prefill_sources: prefillByType,
  })
}

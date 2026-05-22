import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateCaseBeforeGeneration } from '@/lib/asylum/validate-case-before-generation'
import { isAsylumService } from '@/lib/services/asylum'

/**
 * GET /api/cita/[token]/asilo-miedo-creible/validation
 *
 * Devuelve el resultado de validación pre-generación que la ReforzarScreen
 * muestra al cliente: qué falta para que la firma pueda generar el Miedo
 * Creíble.
 */
export async function GET(
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

  const result = await validateCaseBeforeGeneration(supabase, tokenData.case_id)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=5' } })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runLegalReview } from '@/lib/ai/legal-review-client'
import { getPlaybookForService, getPlaybookName } from '@/lib/ai/legal-playbooks'
import { createLogger } from '@/lib/logger'

const log = createLogger('legal-review')

async function ensureAdminOrEmployee() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { service: null as ReturnType<typeof createServiceClient> | null, userId: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return { service: null, userId: null }
  }
  return { service: createServiceClient(), userId: user.id }
}

/**
 * GET /api/admin/legal-review?case_id=X
 * Returns the review history for a case, newest first.
 */
export async function GET(request: NextRequest) {
  const { service } = await ensureAdminOrEmployee()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const caseId = request.nextUrl.searchParams.get('case_id')
  if (!caseId) return NextResponse.json({ error: 'case_id requerido' }, { status: 400 })

  const { data: reviews, error } = await service
    .from('legal_reviews')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    log.error('fetch reviews failed', error)
    return NextResponse.json({ error: 'Error al cargar revisiones' }, { status: 500 })
  }

  return NextResponse.json({ reviews: reviews || [] })
}

/**
 * POST /api/admin/legal-review
 * Body: { case_id }
 * Runs a fresh legal review with Claude Opus 4.7 and persists it.
 */
export async function POST(request: NextRequest) {
  const { service, userId } = await ensureAdminOrEmployee()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await request.json()
  const caseId = body.case_id
  if (!caseId) return NextResponse.json({ error: 'case_id requerido' }, { status: 400 })

  // 1. Load case + client + service
  const { data: caseRow, error: caseErr } = await service
    .from('cases')
    .select(`
      id, case_number, created_at, intake_status,
      service:service_catalog(slug, name),
      client:profiles(first_name, last_name, email, phone, date_of_birth, country_of_birth, nationality)
    `)
    .eq('id', caseId)
    .single()

  if (caseErr || !caseRow) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  // 2. Load generated declarations (latest saved set for this case)
  const { data: savedDecls } = await service
    .from('case_form_submissions')
    .select('form_data, updated_at')
    .eq('case_id', caseId)
    .eq('form_type', 'generated_declarations')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Load tutor + minor + supplementary forms for case data summary
  const { data: formSubmissions } = await service
    .from('case_form_submissions')
    .select('form_type, form_data')
    .eq('case_id', caseId)
    .in('form_type', ['tutor_guardian', 'client_story', 'admin_supplementary', 'parental_consent'])

  // 4. Build documents array from saved declarations
  type Declaration = { type: string; index: number; label: string; content: string; contentES?: string }
  const declarations: Declaration[] = Array.isArray(savedDecls?.form_data?.declarations)
    ? (savedDecls.form_data.declarations as Declaration[])
    : []

  const documents: Array<{ name: string; type: string; content: string }> = []
  for (const d of declarations) {
    if (d.content) {
      documents.push({ name: `${d.label} (EN)`, type: d.type, content: d.content })
    }
    if (d.contentES) {
      documents.push({ name: `${d.label} (ES)`, type: d.type, content: d.contentES })
    }
  }

  if (documents.length === 0) {
    return NextResponse.json(
      { error: 'Este caso no tiene declaraciones generadas aún. Genera los documentos primero en la pestaña Declaraciones.' },
      { status: 400 },
    )
  }

  // 5. Build case summary for cross-reference
  const client = Array.isArray(caseRow.client) ? caseRow.client[0] : caseRow.client
  const serviceInfo = Array.isArray(caseRow.service) ? caseRow.service[0] : caseRow.service

  const forms = (formSubmissions || []).reduce<Record<string, Record<string, unknown>>>(
    (acc, s) => {
      acc[s.form_type as string] = (s.form_data || {}) as Record<string, unknown>
      return acc
    },
    {},
  )

  const summary = [
    `Caso: ${caseRow.case_number || caseRow.id}`,
    `Servicio: ${serviceInfo?.name || 'Desconocido'} (slug: ${serviceInfo?.slug || 'n/a'})`,
    `Cliente: ${client?.first_name || ''} ${client?.last_name || ''}`.trim(),
    client?.date_of_birth ? `Fecha nacimiento cliente: ${client.date_of_birth}` : null,
    client?.country_of_birth ? `País origen cliente: ${client.country_of_birth}` : null,
    client?.nationality ? `Nacionalidad: ${client.nationality}` : null,
    client?.phone ? `Teléfono: ${client.phone}` : null,
    forms.tutor_guardian ? `\n--- Datos del tutor/guardián ---\n${JSON.stringify(forms.tutor_guardian)}` : null,
    forms.client_story ? `\n--- Historia del menor ---\n${JSON.stringify(forms.client_story)}` : null,
    forms.admin_supplementary ? `\n--- Datos suplementarios ---\n${JSON.stringify(forms.admin_supplementary)}` : null,
  ].filter(Boolean).join('\n')

  // 6. Run the review
  const playbook = getPlaybookForService(serviceInfo?.slug)
  const playbookName = getPlaybookName(serviceInfo?.slug)

  let review
  try {
    review = await runLegalReview({
      playbook,
      documents,
      caseSummary: summary,
      signal: request.signal,
    })
  } catch (err) {
    log.error('review failed', err)
    const message = err instanceof Error ? err.message : 'Error al ejecutar la revisión'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 7. Persist the result
  const { data: saved, error: insertErr } = await service
    .from('legal_reviews')
    .insert({
      case_id: caseId,
      service_slug: serviceInfo?.slug || null,
      playbook_name: playbookName,
      reviewer_model: 'gemini-3.1-pro-preview',
      score: review.score,
      ready_to_file: review.ready_to_file,
      summary: review.summary,
      findings: review.findings,
      strengths: review.strengths,
      documents_reviewed: documents.map(d => ({ name: d.name, type: d.type })),
      reviewed_by: userId,
    })
    .select()
    .single()

  if (insertErr) {
    log.error('persist failed', insertErr)
    return NextResponse.json({ error: 'Revisión completada pero no se pudo guardar' }, { status: 500 })
  }

  return NextResponse.json({ review: saved })
}

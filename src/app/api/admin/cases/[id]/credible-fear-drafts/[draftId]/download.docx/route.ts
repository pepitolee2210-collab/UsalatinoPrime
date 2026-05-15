import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildCredibleFearDocx } from '@/lib/legal/credible-fear-docx'

/**
 * GET /api/admin/cases/[id]/credible-fear-drafts/[draftId]/download.docx
 *
 * Genera un archivo Word (.docx) del Miedo Creíble guardado en
 * `case_credible_fear_drafts.body_md`. Diana lo descarga para imprimirlo,
 * editarlo o anexarlo al I-589.
 *
 * Solo admin o paralegal pueden invocarlo.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  const { id, draftId } = await params

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
    return NextResponse.json({ error: 'Solo admin o paralegal' }, { status: 403 })
  }

  const { data: draft } = await service
    .from('case_credible_fear_drafts')
    .select('body_md, sources')
    .eq('id', draftId)
    .eq('case_id', id)
    .single<{ body_md: string; sources: Array<{ url: string; title: string }> | null }>()

  if (!draft) {
    return NextResponse.json({ error: 'Draft no encontrado' }, { status: 404 })
  }

  const { data: caseRow } = await service
    .from('cases')
    .select(`
      case_number,
      profile:profiles!cases_client_id_fkey(first_name, last_name)
    `)
    .eq('id', id)
    .single<{
      case_number: string
      profile: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null
    }>()

  const profileData = Array.isArray(caseRow?.profile) ? caseRow.profile[0] : caseRow?.profile
  const applicantName =
    `${profileData?.first_name ?? ''} ${profileData?.last_name ?? ''}`.trim() || 'Solicitante'

  const docxBytes = await buildCredibleFearDocx({
    applicantName,
    caseNumber: caseRow?.case_number ?? id,
    bodyMarkdown: draft.body_md,
    sources: draft.sources ?? [],
  })

  // Envolver en Blob para evitar el clash de tipos Uint8Array/SharedArrayBuffer
  // en NextResponse — Blob siempre es válido como BodyInit.
  const blob = new Blob([new Uint8Array(docxBytes)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Miedo-Creible-${caseRow?.case_number ?? id}.docx"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

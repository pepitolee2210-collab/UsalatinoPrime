import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/internal-documents/list?status=pending_review&case_id=X&client_id=X
 *
 * Lista documentos internos con filtros opcionales.
 * - Admin ve TODO.
 * - Employee ve los que él subió + los que estén pendientes/aprobados de
 *   cualquier caso al que tenga acceso (employee_case_assignments). Para
 *   simplificar la primera versión: employee ve TODO también, pero con
 *   filtro implícito por uploaded_by=self en su lado de la UI.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const status = req.nextUrl.searchParams.get('status')
  const caseId = req.nextUrl.searchParams.get('case_id')
  const clientId = req.nextUrl.searchParams.get('client_id')
  const uploadedBy = req.nextUrl.searchParams.get('uploaded_by') // 'me' o uuid
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 200), 500)

  const service = createServiceClient()
  let query = service
    .from('internal_documents')
    .select(`
      id, case_id, client_id, uploaded_by, reviewed_by,
      category, file_name, file_path, file_size, file_mime,
      status, upload_notes, review_comment, version, parent_document_id,
      reviewed_at, published_at, published_document_id, created_at, updated_at,
      client:profiles!internal_documents_client_id_fkey(first_name, last_name),
      uploader:profiles!internal_documents_uploaded_by_fkey(first_name, last_name),
      reviewer:profiles!internal_documents_reviewed_by_fkey(first_name, last_name),
      case:cases(case_number, service:service_catalog(name))
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (caseId) query = query.eq('case_id', caseId)
  if (clientId) query = query.eq('client_id', clientId)
  if (uploadedBy === 'me') query = query.eq('uploaded_by', user.id)
  else if (uploadedBy) query = query.eq('uploaded_by', uploadedBy)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Counts globales para badges
  const counts = {
    pending_review: 0, approved: 0, rejected: 0, published: 0,
  }
  if (!status) {
    for (const r of data || []) {
      counts[r.status as keyof typeof counts] = (counts[r.status as keyof typeof counts] || 0) + 1
    }
  }

  return NextResponse.json({ documents: data || [], counts })
}

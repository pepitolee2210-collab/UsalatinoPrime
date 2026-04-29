import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { CasePhase } from '@/types/database'

/**
 * GET /api/cita/[token]/approved-documents
 *
 * Devuelve los documentos del cliente con status='approved'. Útil para
 * la sección "Expedientes" en pestaña Más, donde el cliente ve su
 * archivo histórico read-only.
 */

interface ApprovedDoc {
  id: string
  name: string
  file_type: string | null
  file_size: number | null
  uploaded_at: string
  document_type_name_es: string | null
  category_name_es: string | null
  phase_when_uploaded: CasePhase | null
}

export async function GET(
  request: NextRequest,
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

  const { data: rows } = await supabase
    .from('documents')
    .select('id, name, file_type, file_size, created_at, phase_when_uploaded, document_type:document_types(name_es, category_name_es)')
    .eq('case_id', tokenData.case_id)
    .eq('status', 'approved')
    .or('direction.eq.client_to_admin,direction.is.null')
    .order('created_at', { ascending: false })

  const docs: ApprovedDoc[] = (rows ?? []).map((r) => {
    const dt = r.document_type as { name_es: string; category_name_es: string } | { name_es: string; category_name_es: string }[] | null
    const dtObj = Array.isArray(dt) ? dt[0] ?? null : dt
    return {
      id: r.id,
      name: r.name,
      file_type: r.file_type,
      file_size: r.file_size,
      uploaded_at: r.created_at,
      document_type_name_es: dtObj?.name_es ?? null,
      category_name_es: dtObj?.category_name_es ?? null,
      phase_when_uploaded: r.phase_when_uploaded as CasePhase | null,
    }
  })

  return NextResponse.json({ docs })
}

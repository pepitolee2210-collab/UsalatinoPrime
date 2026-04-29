import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { CasePhase } from '@/types/database'

interface DocumentEntry {
  id: string
  name: string
  file_type: string | null
  file_size: number | null
  status: string
  uploaded_at: string
  document_type_name_es: string | null
  category_name_es: string | null
  slot_label: string | null
}

interface FormEntry {
  id: string
  form_name: string
  status: string
  client_submitted_at: string | null
  filled_pdf_path: string | null
  filled_pdf_generated_at: string | null
  total_filled_keys: number
}

/**
 * GET /api/admin/cases/[id]/historical-documents?phase=custodia
 *
 * Devuelve los documentos subidos y los formularios completados durante
 * una fase específica. Útil para que Diana vea el archivo histórico al
 * cambiar al cliente de fase.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const phase = request.nextUrl.searchParams.get('phase') as CasePhase | null

  if (!phase) {
    return NextResponse.json({ error: 'Falta query param phase' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'Solo staff' }, { status: 403 })
  }

  // Documentos subidos en esa fase (snapshot por phase_when_uploaded)
  const { data: docs } = await service
    .from('documents')
    .select('id, name, file_type, file_size, status, created_at, slot_label, document_type:document_types(name_es, category_name_es)')
    .eq('case_id', id)
    .eq('phase_when_uploaded', phase)
    .or('direction.eq.client_to_admin,direction.is.null')
    .order('created_at', { ascending: false })

  const documents: DocumentEntry[] = (docs ?? []).map((d) => {
    const dt = d.document_type as { name_es: string; category_name_es: string } | { name_es: string; category_name_es: string }[] | null
    const dtObj = Array.isArray(dt) ? dt[0] ?? null : dt
    return {
      id: d.id,
      name: d.name,
      file_type: d.file_type,
      file_size: d.file_size,
      status: d.status,
      uploaded_at: d.created_at,
      document_type_name_es: dtObj?.name_es ?? null,
      category_name_es: dtObj?.category_name_es ?? null,
      slot_label: d.slot_label,
    }
  })

  // Formularios completados — case_form_instances no tiene snapshot directo
  // de phase, pero filtramos por client_submitted_at en la ventana de fechas
  // entre el cambio de entrada y salida de esta fase. Para simplicidad inicial,
  // devolvemos todos los instances (Diana ya tiene contexto en la timeline).
  const { data: instances } = await service
    .from('case_form_instances')
    .select('id, form_name, status, client_submitted_at, filled_pdf_path, filled_pdf_generated_at, filled_values')
    .eq('case_id', id)

  const forms: FormEntry[] = (instances ?? []).map((i) => ({
    id: i.id,
    form_name: i.form_name,
    status: i.status,
    client_submitted_at: i.client_submitted_at,
    filled_pdf_path: i.filled_pdf_path,
    filled_pdf_generated_at: i.filled_pdf_generated_at,
    total_filled_keys: countFilled(i.filled_values),
  }))

  return NextResponse.json({ phase, documents, forms })
}

function countFilled(filled: unknown): number {
  if (!filled || typeof filled !== 'object') return 0
  let n = 0
  for (const v of Object.values(filled as Record<string, unknown>)) {
    if (v != null && (typeof v !== 'string' || v.trim() !== '')) n++
  }
  return n
}

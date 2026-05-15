import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateI589PartBPdf } from '@/lib/pdf/i589-official/generate-i589-part-b'
import { parseStructuredI589 } from '@/lib/pdf/i589-official/parse-structured'

/**
 * GET /api/admin/cases/[id]/i589-part-b/download
 *
 * Descarga el PDF I-589 oficial Parte B/C/D (páginas 5-12) rellenado con
 * el JSON estructurado del Miedo Creíble (prompt v3+). Si no hay draft
 * `is_current=true`, retorna 404.
 *
 * Solo admin o paralegal (Diana).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

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
    .select('body_md')
    .eq('case_id', id)
    .eq('is_current', true)
    .maybeSingle<{ body_md: string }>()

  if (!draft) {
    return NextResponse.json(
      { error: 'No hay Miedo Creíble generado para este caso. Genéralo primero.' },
      { status: 404 },
    )
  }

  const structured = parseStructuredI589(draft.body_md)
  const pdfBytes = await generateI589PartBPdf(structured)

  const { data: caseRow } = await service
    .from('cases')
    .select('case_number')
    .eq('id', id)
    .single<{ case_number: string }>()

  const filename = `I-589-Parte-B-${caseRow?.case_number ?? id}.pdf`
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })

  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

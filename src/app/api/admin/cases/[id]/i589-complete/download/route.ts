import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateI589CompletePdf } from '@/lib/pdf/i589-official/generate-i589-complete'
import { parseStructuredI589 } from '@/lib/pdf/i589-official/parse-structured'

/**
 * GET /api/admin/cases/[id]/i589-complete/download
 *
 * Descarga el PDF I-589 oficial COMPLETO (páginas 1-12): Parte A con
 * datos del wizard + Parte B/C/D con Miedo Creíble structured. Si falta
 * draft, llena solo Parte A; si faltan submissions, llena solo B/C.
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

  // Cargar wizard submissions + draft current en paralelo
  const [{ data: subs }, { data: draft }, { data: caseRow }] = await Promise.all([
    service
      .from('case_form_submissions')
      .select('form_type, form_data')
      .eq('case_id', id)
      .in('form_type', ['i589_part_a1', 'i589_part_a2', 'i589_part_a3', 'i589_part_a4']),
    service
      .from('case_credible_fear_drafts')
      .select('body_md')
      .eq('case_id', id)
      .eq('is_current', true)
      .maybeSingle<{ body_md: string }>(),
    service
      .from('cases')
      .select('case_number')
      .eq('id', id)
      .single<{ case_number: string }>(),
  ])

  const partsMap = new Map<string, Record<string, unknown>>()
  for (const s of subs ?? []) {
    partsMap.set(
      s.form_type as string,
      (s.form_data ?? {}) as Record<string, unknown>,
    )
  }

  const structured = parseStructuredI589(draft?.body_md ?? null)

  const pdfBytes = await generateI589CompletePdf(
    {
      a1: partsMap.get('i589_part_a1') ?? {},
      a2: partsMap.get('i589_part_a2') ?? {},
      a3: partsMap.get('i589_part_a3') ?? {},
      a4: partsMap.get('i589_part_a4') ?? {},
    },
    structured,
  )

  const filename = `I-589-Completo-${caseRow?.case_number ?? id}.pdf`
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })

  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateI589CompletePdf } from '@/lib/pdf/i589-official/generate-i589-complete'
import { loadStructured, type I589FieldValuesV5 } from '@/lib/pdf/i589-official/parse-structured'
import type { SupplementBEntry } from '@/lib/pdf/i589-official/generate-i589-part-b'

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

  // Cargar wizard submissions + draft current + caso (con perfil para Part D)
  const [{ data: subs }, { data: draft }, { data: caseRow }] = await Promise.all([
    service
      .from('case_form_submissions')
      .select('form_type, form_data')
      .eq('case_id', id)
      .in('form_type', ['i589_part_a1', 'i589_part_a2', 'i589_part_a3', 'i589_part_a4']),
    service
      .from('case_credible_fear_drafts')
      .select('body_md, i589_field_values_json, supplement_b_entries_json')
      .eq('case_id', id)
      .eq('is_current', true)
      .maybeSingle<{
        body_md: string | null
        i589_field_values_json: I589FieldValuesV5 | null
        supplement_b_entries_json: SupplementBEntry[] | null
      }>(),
    service
      .from('cases')
      .select(`
        case_number,
        client:profiles!cases_client_id_fkey(first_name, middle_name, last_name, phone)
      `)
      .eq('id', id)
      .single<{
        case_number: string
        client: {
          first_name: string | null
          middle_name: string | null
          last_name: string | null
          phone: string | null
        } | null
      }>(),
  ])

  const partsMap = new Map<string, Record<string, unknown>>()
  for (const s of subs ?? []) {
    partsMap.set(
      s.form_type as string,
      (s.form_data ?? {}) as Record<string, unknown>,
    )
  }

  // Prefiere v5 JSONB columnar; cae a body_md regex (drafts v4 legacy).
  const structured = loadStructured(
    draft?.i589_field_values_json ?? null,
    draft?.body_md ?? null,
  )
  const supplementBEntries = draft?.supplement_b_entries_json ?? []
  const applicantFullName = [
    caseRow?.client?.first_name,
    caseRow?.client?.middle_name,
    caseRow?.client?.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Solicitante'

  const pdfBytes = await generateI589CompletePdf({
    parts: {
      a1: partsMap.get('i589_part_a1') ?? {},
      a2: partsMap.get('i589_part_a2') ?? {},
      a3: partsMap.get('i589_part_a3') ?? {},
      a4: partsMap.get('i589_part_a4') ?? {},
    },
    structured,
    applicantFullName,
    applicantTelephone: caseRow?.client?.phone ?? null,
    supplementBEntries,
  })

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

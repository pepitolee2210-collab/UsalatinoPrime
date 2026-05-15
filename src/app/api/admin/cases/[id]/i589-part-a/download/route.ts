import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateI589PartAPdf } from '@/lib/pdf/i589-official/generate-i589-part-a'

/**
 * GET /api/admin/cases/[id]/i589-part-a/download
 *
 * Descarga el PDF I-589 oficial USCIS (páginas 1-4, Parte A) rellenado
 * con las respuestas que el cliente envió en el wizard de Fase 1
 * (`case_form_submissions` con form_type `i589_part_a1..a4`). El PDF
 * vuelve aplanado y recortado: Diana lo imprime o lo anexa al expediente.
 *
 * Solo admin o paralegal (Diana) pueden invocar. No requiere que las 4
 * partes estén submitted — si falta alguna, sus campos quedan en blanco.
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

  const { data: subs } = await service
    .from('case_form_submissions')
    .select('form_type, form_data')
    .eq('case_id', id)
    .in('form_type', ['i589_part_a1', 'i589_part_a2', 'i589_part_a3', 'i589_part_a4'])

  const partsMap = new Map<string, Record<string, unknown>>()
  for (const s of subs ?? []) {
    partsMap.set(
      s.form_type as string,
      (s.form_data ?? {}) as Record<string, unknown>,
    )
  }

  const pdfBytes = await generateI589PartAPdf({
    a1: partsMap.get('i589_part_a1') ?? {},
    a2: partsMap.get('i589_part_a2') ?? {},
    a3: partsMap.get('i589_part_a3') ?? {},
    a4: partsMap.get('i589_part_a4') ?? {},
  })

  const { data: caseRow } = await service
    .from('cases')
    .select('case_number')
    .eq('id', id)
    .single<{ case_number: string }>()

  const filename = `I-589-Parte-A-${caseRow?.case_number ?? id}.pdf`

  // Wrap en Blob para evitar el clash de tipos Uint8Array/SharedArrayBuffer
  // que NextResponse arroja cuando recibe Uint8Array directo en TS strict.
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })

  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

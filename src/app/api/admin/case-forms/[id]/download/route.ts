import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fillAcroForm, generateSupplementPdf, type DetectedField } from '@/lib/legal/acroform-service'
import { createLogger } from '@/lib/logger'

const log = createLogger('case-forms/download')

async function ensureAdminOrEmployee() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') return null
  return createServiceClient()
}

/**
 * GET /api/admin/case-forms/[id]/download
 * Genera el PDF rellenado on-the-fly:
 * - Si schema_source='acroform' → fillAcroForm (rellena el PDF oficial)
 * - Si schema_source='ocr_gemini' → generateSupplementPdf (PDF nuevo con la info estructurada, complementa al oficial)
 *
 * También guarda copia en Storage bajo case-documents/{caseId}/forms/{packet}/
 * y actualiza filled_pdf_path.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const service = await ensureAdminOrEmployee()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params

  const { data: instance, error } = await service
    .from('case_form_instances')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !instance) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (instance.schema_source === 'pending' || instance.schema_source === 'failed') {
    return NextResponse.json({ error: 'El schema aún no está disponible' }, { status: 400 })
  }

  const values = (instance.filled_values as Record<string, string | boolean | number | null | undefined>) || {}
  const schema = (instance.acroform_schema as DetectedField[]) || []

  let pdfBytes: Uint8Array
  try {
    if (instance.schema_source === 'acroform') {
      pdfBytes = await fillAcroForm(instance.form_url_official, values)
    } else {
      // OCR path → PDF suplementario
      const { data: caseRow } = await service
        .from('cases')
        .select('case_number, client:profiles!cases_client_id_fkey(first_name, last_name)')
        .eq('id', instance.case_id)
        .single()
      const clientRaw = caseRow?.client
      const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw
      pdfBytes = await generateSupplementPdf({
        formName: instance.form_name,
        officialUrl: instance.form_url_official,
        schema,
        values,
        caseNumber: caseRow?.case_number ?? null,
        clientName: client ? `${client.first_name} ${client.last_name}`.trim() : null,
      })
    }
  } catch (err) {
    log.error('fill/generate failed', { id, err })
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'No se pudo generar el PDF',
    }, { status: 500 })
  }

  // Guardar copia en Storage (fire-and-forget: si falla, igual servimos el PDF)
  try {
    const safeName = instance.form_name.replace(/[^a-zA-Z0-9_\- ]/g, '_').replace(/\s+/g, '_').slice(0, 80)
    const path = `${instance.case_id}/forms/${instance.packet_type}/${safeName}.pdf`
    await service.storage
      .from('case-documents')
      .upload(path, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    await service
      .from('case_form_instances')
      .update({
        filled_pdf_path: path,
        filled_pdf_generated_at: new Date().toISOString(),
        status: 'downloaded',
      })
      .eq('id', id)
  } catch (err) {
    log.warn('storage upload failed (continuing)', { err })
  }

  const downloadName = `${instance.form_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${downloadName}"`,
      'Cache-Control': 'private, no-cache',
    },
  })
}

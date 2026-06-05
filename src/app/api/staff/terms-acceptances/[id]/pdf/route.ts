import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStaffUser } from '@/lib/auth/require-staff'

/**
 * GET /api/staff/terms-acceptances/[id]/pdf
 *
 * Sirve (stream same-origin) el PDF firmado de una aceptación de T&C, para staff.
 * Lee el `pdf_path` almacenado en la aceptación y lo proxyea desde el bucket
 * privado `case-documents`.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getStaffUser()
  if (!auth.ok) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()

  const { data: acc } = await service
    .from('case_terms_acceptances')
    .select('pdf_path')
    .eq('id', id)
    .single()

  if (!acc?.pdf_path) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  const { data: fileData, error: dlErr } = await service.storage
    .from('case-documents')
    .download(acc.pdf_path)

  if (dlErr || !fileData) {
    return NextResponse.json({ error: 'Archivo no accesible' }, { status: 500 })
  }

  const arrayBuffer = await fileData.arrayBuffer()

  return new NextResponse(arrayBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="Terminos-y-Condiciones.pdf"',
      'Cache-Control': 'private, max-age=60',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self'",
    },
  })
}

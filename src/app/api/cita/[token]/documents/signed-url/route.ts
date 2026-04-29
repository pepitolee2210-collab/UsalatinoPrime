import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/cita/[token]/documents/signed-url
 *
 * Genera signed URL para subir directo a Supabase Storage (bypass del
 * límite 4.5MB de Vercel). Path: {client_id}/{case_id}/{doc_code}/{ts}-{name}
 *
 * Body: { document_type_id: number, file_name: string, file_size: number }
 */

const MAX_FILE_SIZE = 40 * 1024 * 1024 // 40MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  let body: { document_type_id?: number; file_name?: string; file_size?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { document_type_id, file_name, file_size } = body

  if (!document_type_id || !file_name) {
    return NextResponse.json({ error: 'document_type_id y file_name requeridos' }, { status: 400 })
  }

  if (file_size && file_size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'El archivo excede el límite de 40MB' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido o inactivo' }, { status: 403 })
  }

  const { data: docType } = await supabase
    .from('document_types')
    .select('code')
    .eq('id', document_type_id)
    .eq('is_active', true)
    .single()

  if (!docType) {
    return NextResponse.json({ error: 'document_type_id no válido' }, { status: 400 })
  }

  const timestamp = Date.now()
  const safeName = file_name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 80)
  const filePath = `${tokenData.client_id}/${tokenData.case_id}/${docType.code}/${timestamp}-${safeName}`

  const { data: signedData, error: signError } = await supabase.storage
    .from('case-documents')
    .createSignedUploadUrl(filePath)

  if (signError || !signedData) {
    return NextResponse.json({ error: 'Error al generar URL de subida' }, { status: 500 })
  }

  return NextResponse.json({
    signedUrl: signedData.signedUrl,
    token: signedData.token,
    path: signedData.path,
    filePath,
  })
}

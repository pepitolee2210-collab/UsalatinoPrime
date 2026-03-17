import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const token = formData.get('token') as string | null
  const file = formData.get('file') as File | null
  const declarationNumberRaw = formData.get('declaration_number') as string | null

  if (!token || !file || !declarationNumberRaw) {
    return NextResponse.json({ error: 'Token, archivo y declaration_number requeridos' }, { status: 400 })
  }

  const declarationNumber = parseInt(declarationNumberRaw, 10)
  if (![1, 2, 3, 4].includes(declarationNumber)) {
    return NextResponse.json({ error: 'declaration_number debe ser 1-4' }, { status: 400 })
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'El archivo excede 20MB' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData || !tokenData.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `${tokenData.client_id}/${tokenData.case_id}/dj${declarationNumber}/${timestamp}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('case-documents')
    .upload(filePath, await file.arrayBuffer(), { contentType: 'application/pdf', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }

  const { data: document, error: insertError } = await supabase
    .from('documents')
    .insert({
      case_id: tokenData.case_id,
      client_id: tokenData.client_id,
      document_key: `declaracion_jurada_${declarationNumber}`,
      name: file.name,
      file_path: filePath,
      file_type: 'application/pdf',
      file_size: file.size,
      status: 'uploaded',
      direction: 'client_to_admin',
      declaration_number: declarationNumber,
    })
    .select('id, name, file_size, declaration_number')
    .single()

  if (insertError) {
    return NextResponse.json({ error: 'Error al registrar documento' }, { status: 500 })
  }

  return NextResponse.json({ document })
}

export async function DELETE(request: NextRequest) {
  const { token, document_id } = await request.json()

  if (!token || !document_id) {
    return NextResponse.json({ error: 'Token y document_id requeridos' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData || !tokenData.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, file_path, client_id, case_id')
    .eq('id', document_id)
    .single()

  if (!doc || doc.client_id !== tokenData.client_id || doc.case_id !== tokenData.case_id) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  await supabase.storage.from('case-documents').remove([doc.file_path])
  await supabase.from('documents').delete().eq('id', document_id)

  return NextResponse.json({ success: true })
}

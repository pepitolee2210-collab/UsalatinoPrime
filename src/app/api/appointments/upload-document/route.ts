import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { APPOINTMENT_DOCUMENT_KEYS } from '@/lib/appointments/constants'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const token = formData.get('token') as string
  const documentKey = formData.get('document_key') as string
  const file = formData.get('file') as File | null

  if (!token || !documentKey || !file) {
    return NextResponse.json({ error: 'Token, document_key y archivo requeridos' }, { status: 400 })
  }

  // Validar document_key
  const validKey = APPOINTMENT_DOCUMENT_KEYS.find(d => d.key === documentKey)
  if (!validKey) {
    return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
  }

  // Validar tipo de archivo
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 })
  }

  // Validar tamaño
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'El archivo excede el límite de 10MB' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Validar token
  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData || !tokenData.is_active) {
    return NextResponse.json({ error: 'Token inválido o inactivo' }, { status: 403 })
  }

  // Subir archivo al storage
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `${tokenData.client_id}/${tokenData.case_id}/${documentKey}/${timestamp}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('case-documents')
    .upload(filePath, arrayBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }

  // Crear registro en documents
  const { data: document, error: insertError } = await supabase
    .from('documents')
    .insert({
      case_id: tokenData.case_id,
      client_id: tokenData.client_id,
      document_key: documentKey,
      name: file.name,
      file_path: filePath,
      file_type: 'application/pdf',
      file_size: file.size,
      status: 'uploaded',
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: 'Error al registrar documento' }, { status: 500 })
  }

  return NextResponse.json({ document })
}

export async function DELETE(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'Token invalido o inactivo' }, { status: 403 })
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

    return NextResponse.json({ message: 'Documento eliminado' })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

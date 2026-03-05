import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { APPOINTMENT_DOCUMENT_KEYS } from '@/lib/appointments/constants'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    // Verify admin auth
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

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }

    const formData = await request.formData()
    const caseId = formData.get('case_id') as string
    const clientId = formData.get('client_id') as string
    const documentKey = formData.get('document_key') as string
    const file = formData.get('file') as File | null

    if (!caseId || !clientId || !documentKey || !file) {
      return NextResponse.json({ error: 'case_id, client_id, document_key y archivo requeridos' }, { status: 400 })
    }

    const validKey = APPOINTMENT_DOCUMENT_KEYS.find(d => d.key === documentKey)
    if (!validKey) {
      return NextResponse.json({ error: 'Tipo de documento invalido' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'El archivo excede el limite de 10MB' }, { status: 400 })
    }

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${clientId}/${caseId}/${documentKey}/${timestamp}-${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await service.storage
      .from('case-documents')
      .upload(filePath, arrayBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
    }

    const { data: document, error: insertError } = await service
      .from('documents')
      .insert({
        case_id: caseId,
        client_id: clientId,
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
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Error al registrar documento' }, { status: 500 })
    }

    return NextResponse.json({ document })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return null
  return service
}

export async function DELETE(request: NextRequest) {
  try {
    const service = await verifyAdmin()
    if (!service) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { document_id } = await request.json()
    if (!document_id) {
      return NextResponse.json({ error: 'document_id requerido' }, { status: 400 })
    }

    const { data: doc } = await service
      .from('documents')
      .select('id, file_path')
      .eq('id', document_id)
      .single()

    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    await service.storage.from('case-documents').remove([doc.file_path])
    await service.from('documents').delete().eq('id', document_id)

    return NextResponse.json({ message: 'Documento eliminado' })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const service = await verifyAdmin()
    if (!service) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { document_id, name } = await request.json()
    if (!document_id || !name) {
      return NextResponse.json({ error: 'document_id y name requeridos' }, { status: 400 })
    }

    const { error } = await service
      .from('documents')
      .update({ name })
      .eq('id', document_id)

    if (error) {
      return NextResponse.json({ error: 'Error al renombrar' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Documento renombrado' })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

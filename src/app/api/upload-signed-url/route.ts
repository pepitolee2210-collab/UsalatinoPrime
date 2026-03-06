import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { APPOINTMENT_DOCUMENT_KEYS } from '@/lib/appointments/constants'

/**
 * Generates a signed upload URL for Supabase Storage.
 * Files go directly from the browser to Supabase, bypassing
 * the Vercel 4.5MB body limit.
 *
 * Supports two modes:
 * - Admin: authenticated via session cookie
 * - Client: authenticated via appointment token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { document_key, file_name, file_size, mode } = body
    if (!document_key || !file_name) {
      return NextResponse.json({ error: 'document_key y file_name requeridos' }, { status: 400 })
    }

    const validKey = APPOINTMENT_DOCUMENT_KEYS.find(d => d.key === document_key)
    if (!validKey) {
      return NextResponse.json({ error: 'Tipo de documento invalido' }, { status: 400 })
    }

    if (file_size && file_size > 40 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo excede el limite de 40MB' }, { status: 400 })
    }

    const service = createServiceClient()
    let clientId: string
    let caseId: string

    if (mode === 'client') {
      // Client mode: validate appointment token
      const { token } = body
      if (!token) {
        return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
      }

      const { data: tokenData } = await service
        .from('appointment_tokens')
        .select('client_id, case_id, is_active')
        .eq('token', token)
        .single()

      if (!tokenData || !tokenData.is_active) {
        return NextResponse.json({ error: 'Token invalido o inactivo' }, { status: 403 })
      }

      clientId = tokenData.client_id
      caseId = tokenData.case_id
    } else {
      // Admin mode: validate session
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }

      const { data: profile } = await service
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
      }

      const { case_id, client_id } = body
      if (!case_id || !client_id) {
        return NextResponse.json({ error: 'case_id y client_id requeridos' }, { status: 400 })
      }

      clientId = client_id
      caseId = case_id
    }

    // Generate file path
    const timestamp = Date.now()
    const safeName = file_name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${clientId}/${caseId}/${document_key}/${timestamp}-${safeName}`

    // Create signed upload URL (valid 2 minutes)
    const { data: signedData, error: signError } = await service.storage
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
      clientId,
      caseId,
    })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

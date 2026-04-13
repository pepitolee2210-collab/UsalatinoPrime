import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { APPOINTMENT_DOCUMENT_KEYS } from '@/lib/appointments/constants'

/**
 * Confirms a file upload and creates the DB record.
 * Called after the file was uploaded directly to Supabase Storage.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { document_key, file_name, file_size, file_path, client_id, case_id, mode } = body

    if (!document_key || !file_name || !file_path || !client_id || !case_id) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const validKey = APPOINTMENT_DOCUMENT_KEYS.find(d => d.key === document_key)
    if (!validKey) {
      return NextResponse.json({ error: 'Tipo de documento invalido' }, { status: 400 })
    }

    const service = createServiceClient()

    if (mode === 'client') {
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

      if (tokenData.client_id !== client_id || tokenData.case_id !== case_id) {
        return NextResponse.json({ error: 'Datos no coinciden con el token' }, { status: 403 })
      }
    } else {
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

      if (profile?.role !== 'admin' && profile?.role !== 'employee') {
        return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
      }
    }

    const { data: document, error: insertError } = await service
      .from('documents')
      .insert({
        case_id,
        client_id,
        document_key,
        name: file_name,
        file_path,
        file_type: 'application/pdf',
        file_size: file_size || 0,
        status: 'uploaded',
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Error al registrar documento' }, { status: 500 })
    }

    return NextResponse.json({ document })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

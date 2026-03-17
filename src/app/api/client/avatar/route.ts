import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const token = formData.get('token') as string | null

  if (!file || !token) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Solo se permiten imágenes' }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Imagen demasiado grande (máx. 5MB)' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData || !tokenData.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${tokenData.client_id}/avatar.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('profile-avatars')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('profile-avatars')
    .getPublicUrl(path)

  await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', tokenData.client_id)

  return NextResponse.json({ url: publicUrl })
}

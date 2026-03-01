import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { client_id, case_id } = await request.json()

  if (!client_id || !case_id) {
    return NextResponse.json({ error: 'client_id y case_id requeridos' }, { status: 400 })
  }

  // Verificar que el caso existe y pertenece al cliente
  const { data: caseData } = await supabase
    .from('cases')
    .select('id, client_id')
    .eq('id', case_id)
    .eq('client_id', client_id)
    .single()

  if (!caseData) {
    return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  }

  // Desactivar tokens anteriores para este caso
  await supabase
    .from('appointment_tokens')
    .update({ is_active: false })
    .eq('case_id', case_id)
    .eq('client_id', client_id)

  // Crear nuevo token
  const { data: tokenData, error } = await supabase
    .from('appointment_tokens')
    .insert({ client_id, case_id })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Error al generar link' }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usalatino-prime-ofew.vercel.app'
  const link = `${baseUrl}/cita/${tokenData.token}`

  return NextResponse.json({ token: tokenData.token, link })
}

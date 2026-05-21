// POST /api/cita/[token]/preferred-timezone
//
// El portal del cliente guarda aquí la TZ con la que prefiere ver sus
// citas. La cascada que decide qué mostrar por default vive en
// src/lib/appointments/resolve-tz.ts; este endpoint solo persiste la
// preferencia explícita cuando el cliente la cambia con el combobox.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isValidTimezone } from '@/lib/timezones/format'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  type Body = { timezone?: string | null }
  let payload: Body
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { timezone } = payload
  // Permitimos `null` para "olvidar la preferencia" y volver a cascada.
  if (timezone !== null && (!timezone || !isValidTimezone(timezone))) {
    return NextResponse.json({ error: 'Timezone IANA inválida' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('client_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData || !tokenData.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ preferred_timezone: timezone })
    .eq('id', tokenData.client_id)

  if (error) {
    return NextResponse.json({ error: 'Error al guardar preferencia' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, preferred_timezone: timezone })
}

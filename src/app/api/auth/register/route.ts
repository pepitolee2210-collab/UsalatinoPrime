import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { normalizePhone, isValidPhoneLength } from '@/lib/phone'

export async function POST(request: NextRequest) {
  const { email, password, first_name, last_name, phone } = await request.json()

  if (!email || !password || !first_name || !last_name) {
    return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Si el cliente ya tiene un profile con ese teléfono normalizado, NO crear
  // una cuenta paralela. Esto fue exactamente lo que creó el profile fantasma
  // de Jose Luis Criollo: el cliente entró a /register con el mismo teléfono
  // de su contrato y se duplicó la identidad. El UNIQUE INDEX en DB también
  // protege, pero validar acá da un mensaje accionable al usuario.
  if (phone) {
    const normalized = normalizePhone(phone)
    if (isValidPhoneLength(normalized)) {
      const { data: existing } = await supabaseAdmin.rpc('find_client_by_phone', {
        p_phone: phone,
      })
      if (Array.isArray(existing) && existing.length > 0) {
        return NextResponse.json(
          {
            error:
              'Ya existe una cuenta con este teléfono. Para acceder, entra a app.usalatinoprime.com/cita con tu número.',
            code: 'phone_already_registered',
          },
          { status: 409 },
        )
      }
    }
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name,
      last_name,
      phone,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ user: data.user })
}

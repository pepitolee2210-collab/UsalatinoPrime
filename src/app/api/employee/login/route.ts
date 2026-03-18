import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { phone, password } = await request.json()

  if (!phone || !password) {
    return NextResponse.json({ error: 'Teléfono y contraseña requeridos' }, { status: 400 })
  }

  // Use service role to look up employee by phone (no auth needed)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('phone', phone)
    .eq('role', 'employee')
    .single()

  if (!profile?.email) {
    return NextResponse.json({ error: 'No se encontró una cuenta de empleado con este teléfono' }, { status: 401 })
  }

  // Sign in with the found email + provided password
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  })

  if (error) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}

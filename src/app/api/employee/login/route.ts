import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_AUTH_PASSWORD || 'emp_ULP_2026_internal'

export async function POST(request: NextRequest) {
  const { phone } = await request.json()

  if (!phone) {
    return NextResponse.json({ error: 'Número de teléfono requerido' }, { status: 400 })
  }

  // Use service role to look up employee by phone
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
    return NextResponse.json({ error: 'No se encontró una cuenta con este número' }, { status: 401 })
  }

  // Sign in using the internal password
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: EMPLOYEE_PASSWORD,
  })

  if (error) {
    return NextResponse.json({ error: 'Error de autenticación' }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}

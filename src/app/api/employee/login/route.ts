import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_AUTH_PASSWORD || 'emp_ULP_2026_internal'

export async function POST(request: NextRequest) {
  const { phone } = await request.json()

  if (!phone) {
    return NextResponse.json({ error: 'Número de teléfono requerido' }, { status: 400 })
  }

  // Use service role for everything
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Look up employee by phone
  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('phone', phone)
    .eq('role', 'employee')
    .single()

  if (!profile?.email) {
    return NextResponse.json({ error: 'No se encontró una cuenta con este número' }, { status: 401 })
  }

  // Sign in to get session tokens
  const { data, error } = await admin.auth.signInWithPassword({
    email: profile.email,
    password: EMPLOYEE_PASSWORD,
  })

  if (error || !data.session) {
    return NextResponse.json({ error: 'Error de autenticación' }, { status: 401 })
  }

  // Return session tokens — client will call setSession()
  return NextResponse.json({
    success: true,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}

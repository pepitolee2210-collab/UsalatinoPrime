import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // API routes - skip auth
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  // Public routes (no auth required)
  if (pathname.startsWith('/miedo-creible') || pathname.startsWith('/visa-juvenil-form') || pathname.startsWith('/asilo-form') || pathname.startsWith('/ajuste-form') || pathname.startsWith('/renuncia-form') || pathname.startsWith('/offline') || pathname.startsWith('/contrato') || pathname.startsWith('/cita') || pathname.startsWith('/consulta')) {
    return supabaseResponse
  }

  // Auth pages
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    if (user) {
      // Redirect logged in users
      const { data: role } = await supabase.rpc('get_user_role', { user_id: user.id })

      const redirectUrl = role === 'admin'
        ? '/admin/dashboard'
        : role === 'employee'
          ? '/employee/contracts'
          : '/comunidad'
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }
    return supabaseResponse
  }

  // Protected routes
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based routing
  const { data: role } = await supabase.rpc('get_user_role', { user_id: user.id })

  // Root path - redirect based on role
  if (pathname === '/') {
    const dest = role === 'admin'
      ? '/admin/dashboard'
      : role === 'employee'
        ? '/employee/contracts'
        : '/comunidad'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  if (pathname.startsWith('/admin') && role !== 'admin') {
    const dest = role === 'employee' ? '/employee/contracts' : '/comunidad'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  if (pathname.startsWith('/employee') && role !== 'employee') {
    const dest = role === 'admin' ? '/admin/dashboard' : '/comunidad'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  if ((pathname.startsWith('/portal') || pathname.startsWith('/comunidad')) && role !== 'client') {
    const dest = role === 'admin' ? '/admin/dashboard' : '/employee/contracts'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return supabaseResponse
}

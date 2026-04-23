import { NextResponse } from 'next/server'

// Endpoint deprecated. Los empleados ahora ingresan por /login con email +
// contraseña individual. Este endpoint se mantiene únicamente para devolver
// un 410 Gone a clientes antiguos (app móvil cacheada, links compartidos).
export async function POST() {
  return NextResponse.json(
    {
      error: 'Este método de inicio de sesión ya no está disponible. Por favor ingresa con tu correo y contraseña en /login.',
      migrated: true,
    },
    { status: 410 },
  )
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/voice-token
 *
 * Devuelve la API key de Gemini al cliente para que pueda conectar el
 * agente de voz Lex directamente al endpoint Live de Google.
 *
 * Seguridad:
 * - Solo autenticados con role autorizado (admin / contracts_manager /
 *   senior_consultant). Cualquier otro role → 403.
 * - No hay ephemeral tokens disponibles para gemini-3.1-flash-live-preview
 *   todavía; cuando los haya, migrar a auth tokens server-side.
 *
 * Para mitigar abuso de la key expuesta: el endpoint solo responde a
 * usuarios logueados con employee_type correcto, NO público.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const service = createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('role, employee_type')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'
    const isEmployee = profile?.role === 'employee'
    const employeeType = profile?.employee_type
    const allowedEmployeeTypes = ['contracts_manager', 'senior_consultant']

    if (!isAdmin && (!isEmployee || !employeeType || !allowedEmployeeTypes.includes(employeeType))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('[voice-token] GEMINI_API_KEY no configurada')
      return NextResponse.json(
        { error: 'Servidor mal configurado: falta GEMINI_API_KEY' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      apiKey,
      model: 'gemini-3.1-flash-live-preview',
    })
  } catch (err) {
    console.error('[voice-token] error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

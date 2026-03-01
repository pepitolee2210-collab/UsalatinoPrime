import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const phone = body?.phone?.trim()

  if (!phone || phone.length < 7) {
    return NextResponse.json({ error: 'Número de teléfono requerido' }, { status: 400 })
  }

  const normalized = normalizePhone(phone)
  if (normalized.length < 7 || normalized.length > 15) {
    return NextResponse.json({ error: 'Número de teléfono inválido' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Search by normalized phone (strip non-digits from DB too)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone')
    .eq('role', 'client')

  const matchedProfile = (profiles || []).find(p => {
    if (!p.phone) return false
    return normalizePhone(p.phone) === normalized
  })

  if (!matchedProfile) {
    return NextResponse.json({ found: false, reason: 'not_found' })
  }

  // Get all cases for this client (no payment check — open access)
  const { data: cases } = await supabase
    .from('cases')
    .select('id, case_number, service:service_catalog(name)')
    .eq('client_id', matchedProfile.id)

  if (!cases || cases.length === 0) {
    return NextResponse.json({ found: false, reason: 'no_cases' })
  }

  // For each case, generate or reuse active token
  const casesWithTokens = await Promise.all(
    cases.map(async (c) => {
      // Check for existing active token
      const { data: existingToken } = await supabase
        .from('appointment_tokens')
        .select('token')
        .eq('client_id', matchedProfile.id)
        .eq('case_id', c.id)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (existingToken) {
        return { ...c, token: existingToken.token }
      }

      // Create new token
      const { data: newToken } = await supabase
        .from('appointment_tokens')
        .insert({ client_id: matchedProfile.id, case_id: c.id })
        .select('token')
        .single()

      return { ...c, token: newToken?.token || null }
    })
  )

  const validCases = casesWithTokens.filter(c => c.token)

  const serviceForCase = (c: typeof validCases[number]) => {
    const svc = c.service as unknown
    if (Array.isArray(svc)) return (svc[0] as { name: string })?.name || 'Servicio'
    return (svc as { name: string } | null)?.name || 'Servicio'
  }

  return NextResponse.json({
    found: true,
    clientName: `${matchedProfile.first_name} ${matchedProfile.last_name}`,
    cases: validCases.map(c => ({
      id: c.id,
      case_number: c.case_number,
      service_name: serviceForCase(c),
      token: c.token,
    })),
  })
}

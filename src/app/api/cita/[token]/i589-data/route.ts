import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/cita/[token]/i589-data
 *
 * Carga las 4 partes (a1, a2, a3, a4) del I-589 Parte A guardadas en
 * `case_form_submissions` para el caso del token. Cada parte tiene su
 * propio `status`, `updated_at` y `submitted_at`.
 *
 * Devuelve también `prefill_sources` con datos del cliente y contrato para
 * que el wizard pueda pre-llenar campos triviales (nombre, dirección,
 * cónyuge, hijos) sin que el cliente los tenga que repetir.
 *
 * Los guardados van por POST /api/client-story con form_type='i589_part_aN'.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, client_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  }

  const PART_TYPES = ['i589_part_a1', 'i589_part_a2', 'i589_part_a3', 'i589_part_a4'] as const

  type SubmissionRow = {
    form_type: string
    form_data: Record<string, unknown> | null
    status: string | null
    updated_at: string | null
    submitted_at: string | null
    admin_notes: string | null
  }

  const { data: subs } = await supabase
    .from('case_form_submissions')
    .select('form_type, form_data, status, updated_at, submitted_at, admin_notes')
    .eq('case_id', tokenData.case_id)
    .in('form_type', PART_TYPES as unknown as string[])
    .eq('minor_index', 0)
    .returns<SubmissionRow[]>()

  const subsByType = new Map<string, SubmissionRow>()
  for (const s of subs ?? []) {
    subsByType.set(s.form_type, s)
  }

  function partOut(formType: string) {
    const s = subsByType.get(formType)
    return {
      form_data: s?.form_data ?? {},
      status: s?.status ?? null,
      updated_at: s?.updated_at ?? null,
      submitted_at: s?.submitted_at ?? null,
      admin_notes: s?.admin_notes ?? null,
    }
  }

  // Prefill sources: profile del cliente + contrato (cónyuge, minors).
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone, email, date_of_birth, country_of_birth, nationality, address_street, address_city, address_state, address_zip')
    .eq('id', tokenData.client_id)
    .maybeSingle()

  const { data: contractRow } = await supabase
    .from('contracts')
    .select('client_full_name, spouse, minors, asylum_family_type')
    .eq('case_id', tokenData.case_id)
    .maybeSingle()

  return NextResponse.json({
    case_id: tokenData.case_id,
    parts: {
      a1: partOut('i589_part_a1'),
      a2: partOut('i589_part_a2'),
      a3: partOut('i589_part_a3'),
      a4: partOut('i589_part_a4'),
    },
    prefill_sources: {
      profile: profile ?? null,
      contract: contractRow ?? null,
    },
  })
}

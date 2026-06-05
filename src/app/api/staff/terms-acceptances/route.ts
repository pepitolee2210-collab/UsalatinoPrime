import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStaffUser } from '@/lib/auth/require-staff'

/**
 * GET /api/staff/terms-acceptances
 *
 * Registro central de TODAS las aceptaciones de Términos y Condiciones firmadas,
 * para la administración (Henry, Diana, Vanessa). Verifica rol staff y devuelve la
 * lista con nombre de cliente, servicio, número de caso, fecha, versión y el id del
 * documento PDF.
 *
 * Hacemos el "join" manualmente (batch por IDs) para no depender de la resolución
 * de relaciones de PostgREST.
 */
export async function GET() {
  const auth = await getStaffUser()
  if (!auth.ok) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: auth.status })
  }

  const service = createServiceClient()

  const { data: accs, error } = await service
    .from('case_terms_acceptances')
    .select('id, accepted_at, terms_version, document_id, case_id, client_id')
    .order('accepted_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Error al cargar las aceptaciones' }, { status: 500 })
  }

  const rows = accs ?? []
  const caseIds = [...new Set(rows.map((r) => r.case_id))]
  const clientIds = [...new Set(rows.map((r) => r.client_id))]

  const [casesRes, profilesRes] = await Promise.all([
    caseIds.length
      ? service.from('cases').select('id, case_number, service:service_catalog(name)').in('id', caseIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    clientIds.length
      ? service.from('profiles').select('id, first_name, middle_name, last_name').in('id', clientIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  const caseMap = new Map((casesRes.data ?? []).map((c) => [c.id as string, c]))
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id as string, p]))

  const acceptances = rows.map((r) => {
    const c = caseMap.get(r.case_id) as { case_number?: string; service?: unknown } | undefined
    const svcRaw = c?.service
    const svc = Array.isArray(svcRaw) ? svcRaw[0] : svcRaw
    const p = profileMap.get(r.client_id) as
      | { first_name?: string; middle_name?: string; last_name?: string }
      | undefined
    return {
      id: r.id,
      accepted_at: r.accepted_at,
      terms_version: r.terms_version,
      document_id: r.document_id,
      case_id: r.case_id,
      case_number: c?.case_number ?? '—',
      service_name: (svc as { name?: string } | null)?.name ?? '—',
      client_name:
        [p?.first_name, p?.middle_name, p?.last_name].filter(Boolean).join(' ').trim() || '—',
    }
  })

  return NextResponse.json({ acceptances })
}

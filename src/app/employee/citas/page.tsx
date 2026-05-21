import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { EmployeeCitasView } from './employee-citas-view'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STATUS_MANAGERS = new Set(['senior_consultant', 'paralegal'])
const BOOK_MANAGERS = new Set(['senior_consultant', 'contracts_manager'])

export default async function EmployeeCitasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'employee') redirect('/login')

  const canManageStatus = STATUS_MANAGERS.has(profile.employee_type ?? '')
  const canBook = BOOK_MANAGERS.has(profile.employee_type ?? '')

  // Para `activeCases` necesitamos service client (bypasa RLS): Vanessa y
  // Andrium agendan a cualquier cliente, no solo a los que tienen asignados
  // (las policies de `cases` restringen employees a `employee_case_assignments`,
  // que es lo correcto para casework pero limita el booking). Las APIs siguen
  // re-verificando el rol antes de mutar, así que es seguro.
  const service = canBook ? createServiceClient() : null
  const [{ data: appointments, error: aptErr }, casesRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('*, guest_name, employee_notes, client_id, case_id, session_number, objective_completed, client:profiles!appointments_client_id_fkey(first_name, last_name, email, phone), case:cases(case_number, service:service_catalog(name))')
      .order('scheduled_at', { ascending: false })
      .limit(100),
    service
      ? service
          .from('cases')
          .select('id, case_number, client_id, client:profiles(first_name, last_name, phone), service:service_catalog(name)')
          .not('intake_status', 'eq', 'archived')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null, error: null }),
  ])

  if (aptErr) console.error('[employee/citas] fetch error', aptErr)

  // Normalize joined relations (Supabase devuelve arrays para FKs)
  // El cast a any es deliberado: el shape post-normalize encaja con el tipo
  // Appointment del client component.
  const normalized = ((appointments as unknown[]) || []).map((row) => {
    const a = row as Record<string, unknown>
    const client = a.client
    const caseRel = a.case
    const caseObj = caseRel
      ? Array.isArray(caseRel)
        ? caseRel[0]
        : caseRel
      : null
    const caseService = caseObj && typeof caseObj === 'object' && 'service' in caseObj
      ? (caseObj as { service: unknown }).service
      : null
    return {
      ...a,
      client: Array.isArray(client) ? client[0] : client,
      case: caseObj
        ? {
            ...(caseObj as object),
            service: caseService
              ? Array.isArray(caseService)
                ? caseService[0]
                : caseService
              : null,
          }
        : null,
    } as unknown as Parameters<typeof EmployeeCitasView>[0]['appointments'][number]
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Citas</h1>
      <p className="text-sm text-gray-500">
        {canManageStatus
          ? 'Cierra citas con su objetivo (logrado o pendiente) para que el contador avance correctamente.'
          : 'Vista de solo lectura — contacta a Henry o a una paralegal para cambios.'}
      </p>
      <EmployeeCitasView
        appointments={normalized}
        canManageStatus={canManageStatus}
        canBook={canBook}
        activeCases={canBook ? (casesRes.data ?? []) : []}
      />
    </div>
  )
}

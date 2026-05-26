import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { EmployeeCasosView } from './employee-casos-view'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

/**
 * Listado abierto de casos para paralegals. Permite a Diana acceder al panel
 * de Radicación · PDFs (jurisdicción + formularios SIJS Fase 1) sin que
 * Henry tenga que crear una asignación explícita por cada caso.
 *
 * Solo paralegals lo ven en el sidebar — consultoras senior y contracts
 * managers tienen otros flujos. La página llama directamente al case
 * detail page (/employee/cases/[id]) que ya soporta acceso de paralegal
 * sin assignment.
 */
export default async function EmployeeCasosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/employee')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, employee_type')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'employee' || profile.employee_type !== 'paralegal') {
    redirect('/employee/dashboard')
  }

  const service = createServiceClient()

  const { data: rawCases } = await service
    .from('cases')
    .select(`
      id, case_number, current_phase, intake_status, immigration_status,
      state_us, created_at, updated_at,
      service:service_catalog(name, slug),
      client:profiles(first_name, last_name, email)
    `)
    .order('updated_at', { ascending: false })
    .limit(500)

  type RawCaseRow = {
    id: string
    case_number: string | null
    current_phase: string | null
    intake_status: string | null
    immigration_status: string | null
    state_us: string | null
    created_at: string
    updated_at: string
    service: { name: string | null; slug: string | null } | { name: string | null; slug: string | null }[] | null
    client: { first_name: string | null; last_name: string | null; email: string | null }
      | { first_name: string | null; last_name: string | null; email: string | null }[]
      | null
  }
  const cases = ((rawCases ?? []) as RawCaseRow[]).map(c => ({
    id: c.id,
    case_number: c.case_number,
    current_phase: c.current_phase,
    intake_status: c.intake_status,
    immigration_status: c.immigration_status,
    state_us: c.state_us,
    created_at: c.created_at,
    updated_at: c.updated_at,
    service: Array.isArray(c.service) ? c.service[0] : c.service,
    client: Array.isArray(c.client) ? c.client[0] : c.client,
  }))

  const sijsCount = cases.filter((c) => c.service?.slug === 'visa-juvenil').length
  const activeCount = cases.filter((c) => {
    const s = c.intake_status
    return s !== 'completed' && s !== 'archived'
  }).length

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Paralegal · Casos"
        title="Casos"
        accentDot
        description="Vista directa para paralegals — abre cualquier caso para revisar Radicación · PDFs y demás secciones, sin esperar asignación de Henry."
        telemetry={[
          { label: 'Total', value: cases.length.toLocaleString() },
          { label: 'Activos', value: activeCount.toLocaleString() },
          { label: 'SIJS', value: sijsCount.toLocaleString() },
        ]}
      />
      <EmployeeCasosView cases={cases} />
    </div>
  )
}

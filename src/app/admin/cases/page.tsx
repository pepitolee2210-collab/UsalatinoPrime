import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CasesView } from '@/components/admin/CasesView'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

const MAX_CASES = 1000

export default async function AdminCasesPage() {
  const supabase = await createClient()
  const service = createServiceClient()

  const [
    { data: cases, count: totalCases },
    { data: documents },
    { data: submissions },
  ] = await Promise.all([
    supabase
      .from('cases')
      .select('*, service:service_catalog(name), client:profiles(first_name, last_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(MAX_CASES),
    service.from('documents').select('case_id'),
    service.from('case_form_submissions').select('case_id, status').neq('status', 'draft'),
  ])

  const docCounts = new Map<string, number>()
  for (const d of documents || []) {
    docCounts.set(d.case_id, (docCounts.get(d.case_id) || 0) + 1)
  }

  const submissionMap = new Map<string, { total: number; submitted: number }>()
  for (const s of submissions || []) {
    const current = submissionMap.get(s.case_id) || { total: 0, submitted: 0 }
    current.total++
    if (s.status === 'submitted' || s.status === 'approved') current.submitted++
    submissionMap.set(s.case_id, current)
  }

  const enrichedCases = (cases || []).map((c: Record<string, unknown>) => ({
    ...c,
    doc_count: docCounts.get(c.id as string) || 0,
    submission_total: submissionMap.get(c.id as string)?.total || 0,
    submission_done: submissionMap.get(c.id as string)?.submitted || 0,
  }))

  const loaded = enrichedCases.length
  const total = totalCases ?? loaded
  const truncated = total > loaded

  // Telemetry — calcular activos / completados
  const activos = enrichedCases.filter((c) => {
    const status = (c as Record<string, unknown>).intake_status
    return status !== 'completed' && status !== 'archived'
  }).length

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Operación · Casos"
        title="Casos"
        accentDot
        description="Lista completa de expedientes activos. Búsqueda por nombre, servicio o número de caso."
        telemetry={[
          { label: 'Total', value: total.toLocaleString() },
          { label: 'Activos', value: activos.toLocaleString() },
          { label: 'Servicios', value: new Set(enrichedCases.map((c) => (c as Record<string, unknown>).service_id)).size.toString() },
        ]}
      />

      {truncated && (
        <div
          className="rounded-xl px-4 py-3 text-sm flex items-center gap-3"
          style={{
            background: 'rgba(250,204,21,0.06)',
            border: '0.5px solid rgba(250,204,21,0.2)',
            color: '#FDE68A',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, letterSpacing: '0.18em', fontWeight: 700 }}>⚠ TRUNCATED</span>
          <span>Mostrando {loaded.toLocaleString()} de {total.toLocaleString()} casos. Usa la búsqueda para encontrar uno específico.</span>
        </div>
      )}

      <CasesView cases={enrichedCases} />
    </div>
  )
}

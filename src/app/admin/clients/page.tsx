import { createClient } from '@/lib/supabase/server'
import { ClientsList } from './clients-list'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

const MAX_CLIENTS = 1000

export default async function AdminClientsPage() {
  const supabase = await createClient()

  const { data, count: totalClients } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, created_at, cases(count)', { count: 'exact' })
    .eq('role', 'client')
    .order('created_at', { ascending: false })
    .limit(MAX_CLIENTS)

  const clients = (data || []).map((c: Record<string, unknown>) => {
    const cases = c.cases as Array<{ count?: number }> | undefined
    return {
      id: c.id as string,
      first_name: c.first_name as string,
      last_name: c.last_name as string,
      email: c.email as string,
      phone: (c.phone as string) || '',
      created_at: c.created_at as string,
      case_count: cases?.[0]?.count ?? 0,
    }
  })

  const loaded = clients.length
  const total = totalClients ?? loaded
  const truncated = total > loaded
  const withCases = clients.filter((c) => c.case_count > 0).length

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Operación · Clientes"
        title="Clientes"
        accentDot
        description="Base de clientes registrados. Busca, filtra y abre el detalle para ver historial completo."
        telemetry={[
          { label: 'Total', value: total.toLocaleString() },
          { label: 'Con casos', value: withCases.toLocaleString() },
          { label: 'Recientes', value: loaded.toLocaleString() },
        ]}
      />

      {truncated && (
        <div
          className="rounded-xl px-4 py-3 text-sm flex items-center gap-3"
          style={{
            background: 'rgba(250,204,21,0.06)',
            border: '0.5px solid rgba(250,204,21,0.2)',
            color: 'var(--admin-gold)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, letterSpacing: '0.18em', fontWeight: 700 }}>⚠ TRUNCATED</span>
          <span>Mostrando {loaded.toLocaleString()} de {total.toLocaleString()} clientes. Usa la búsqueda para encontrar uno específico.</span>
        </div>
      )}

      <ClientsList initialClients={clients} />
    </div>
  )
}

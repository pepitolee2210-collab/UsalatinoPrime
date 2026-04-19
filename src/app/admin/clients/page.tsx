import { createClient } from '@/lib/supabase/server'
import { ClientsList } from './clients-list'

// Same defensive cap pattern as cases: load up to MAX and surface a banner if
// the real count exceeds it. In practice Henry has ~100 clients today.
const MAX_CLIENTS = 1000

export default async function AdminClientsPage() {
  const supabase = await createClient()

  const { data, count: totalClients } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, created_at, cases(count)', { count: 'exact' })
    .eq('role', 'client')
    .order('created_at', { ascending: false })
    .limit(MAX_CLIENTS)

  const clients = (data || []).map((c: any) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    phone: c.phone || '',
    created_at: c.created_at,
    case_count: c.cases?.[0]?.count ?? 0,
  }))

  const loaded = clients.length
  const total = totalClients ?? loaded
  const truncated = total > loaded

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <span className="text-sm text-gray-500">
          {truncated ? `${loaded} de ${total}` : `${total} registrados`}
        </span>
      </div>
      {truncated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Mostrando {loaded.toLocaleString()} de {total.toLocaleString()} clientes (los más recientes).
          Usa la búsqueda para encontrar a un cliente específico.
        </div>
      )}
      <ClientsList initialClients={clients} />
    </div>
  )
}

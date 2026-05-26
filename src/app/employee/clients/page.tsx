import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

export default async function EmployeeClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, created_at')
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  const rows = clients ?? []

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="CLIENTES · LISTADO"
        title="Clientes"
        accentDot
        description="Listado tabular de clientes registrados."
        telemetry={[{ label: 'Total', value: rows.length.toString() }]}
      />

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border)',
          boxShadow: 'var(--admin-shadow, 0 4px 16px rgba(11,31,58,0.06))',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--admin-bg-deep)' }}>
                {['Nombre', 'Email', 'Teléfono', 'Registrado'].map((label) => (
                  <th
                    key={label}
                    style={{
                      color: 'var(--admin-fg-subtle)',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.14em',
                      fontFamily: 'var(--font-mono-tech)',
                      padding: '12px 16px',
                      textAlign: 'left',
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: '0.5px solid var(--admin-border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--admin-bg-elev-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 16px', color: 'var(--admin-fg)', fontWeight: 500 }}>
                    {c.first_name} {c.last_name}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--admin-fg-muted)' }}>{c.email}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--admin-fg-muted)' }}>{c.phone}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--admin-fg-subtle)', fontSize: 13 }}>
                    {format(new Date(c.created_at), 'd MMM yyyy', { locale: es })}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: 'center',
                      padding: '32px 16px',
                      color: 'var(--admin-fg-subtle)',
                    }}
                  >
                    No hay clientes registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

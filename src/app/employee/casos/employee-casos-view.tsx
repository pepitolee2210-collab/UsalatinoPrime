'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Briefcase, ArrowRight, Filter } from 'lucide-react'

interface CaseRow {
  id: string
  case_number: string | null
  current_phase: string | null
  intake_status: string | null
  immigration_status: string | null
  state_us: string | null
  created_at: string
  updated_at: string
  service: { name: string | null; slug: string | null } | null
  client: { first_name: string | null; last_name: string | null; email: string | null } | null
}

const SERVICE_FILTERS = ['Todos', 'Visa Juvenil (SIJS)', 'Otros']

export function EmployeeCasosView({ cases }: { cases: CaseRow[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof SERVICE_FILTERS)[number]>('Visa Juvenil (SIJS)')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cases.filter(c => {
      const serviceName = c.service?.name ?? ''
      if (filter === 'Visa Juvenil (SIJS)' && c.service?.slug !== 'visa-juvenil') return false
      if (filter === 'Otros' && c.service?.slug === 'visa-juvenil') return false

      if (!q) return true
      const fullName = `${c.client?.first_name ?? ''} ${c.client?.last_name ?? ''}`.toLowerCase()
      return (
        fullName.includes(q) ||
        (c.case_number ?? '').toLowerCase().includes(q) ||
        (c.client?.email ?? '').toLowerCase().includes(q) ||
        serviceName.toLowerCase().includes(q)
      )
    })
  }, [cases, query, filter])

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--admin-fg-subtle)' }}
          />
          <input
            type="search"
            placeholder="Buscar por nombre, # caso o servicio…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl focus:outline-none transition-colors"
            style={{
              background: 'var(--admin-bg-elev)',
              border: '0.5px solid var(--admin-border-strong)',
              color: 'var(--admin-fg)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--admin-accent)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--admin-border-strong)' }}
          />
        </div>
        <div
          className="flex items-center gap-1 rounded-xl p-1"
          style={{
            background: 'var(--admin-bg-deep)',
            border: '0.5px solid var(--admin-border)',
          }}
        >
          <Filter className="w-3.5 h-3.5 ml-2" style={{ color: 'var(--admin-fg-subtle)' }} />
          {SERVICE_FILTERS.map(f => {
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: active ? 'var(--admin-bg-elev)' : 'transparent',
                  color: active ? 'var(--admin-accent)' : 'var(--admin-fg-muted)',
                  border: active ? '0.5px solid var(--admin-border-strong)' : '0.5px solid transparent',
                  boxShadow: active ? 'var(--admin-shadow)' : 'none',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {f}
              </button>
            )
          })}
        </div>
      </div>

      <p
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--admin-fg-subtle)',
        }}
      >
        {filtered.length} CASO{filtered.length === 1 ? '' : 'S'} COINCIDEN
      </p>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{
              background: 'var(--admin-panel-grad)',
              border: '0.5px dashed var(--admin-border-strong)',
            }}
          >
            <p style={{ color: 'var(--admin-fg-muted)', fontSize: 14 }}>Sin resultados.</p>
          </div>
        ) : filtered.map(c => {
          const fullName = `${c.client?.first_name ?? ''} ${c.client?.last_name ?? ''}`.trim() || 'Sin nombre'
          const serviceName = c.service?.name ?? 'Servicio desconocido'
          return (
            <Link
              key={c.id}
              href={`/employee/cases/${c.id}`}
              className="flex items-center gap-3 p-4 rounded-xl transition-all"
              style={{
                background: 'var(--admin-panel-grad)',
                border: '0.5px solid var(--admin-border-strong)',
                boxShadow: 'var(--admin-shadow)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--admin-gold-border, var(--admin-gold))'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--admin-border-strong)'
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'var(--admin-accent-soft)',
                  border: '0.5px solid var(--admin-border-strong)',
                }}
              >
                <Briefcase className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className="truncate"
                    style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-fg)' }}
                  >
                    {fullName}
                  </p>
                  {c.case_number && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full"
                      style={{
                        background: 'var(--admin-accent-soft)',
                        color: 'var(--admin-accent)',
                        border: '0.5px solid var(--admin-border-strong)',
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 10,
                        letterSpacing: '0.05em',
                      }}
                    >
                      #{c.case_number}
                    </span>
                  )}
                  {c.state_us && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full"
                      style={{
                        background: 'var(--admin-blue-soft)',
                        color: 'var(--admin-blue)',
                        border: '0.5px solid var(--admin-border-strong)',
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 10,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {c.state_us}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', marginTop: 2 }}>
                  {serviceName}
                  {c.current_phase && <> · Fase {c.current_phase}</>}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--admin-fg-subtle)' }} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

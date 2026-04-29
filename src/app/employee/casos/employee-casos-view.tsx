'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Briefcase, ArrowRight, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Buscar por nombre, # caso o servicio…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002855]/20 focus:border-[#002855]"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <Filter className="w-3.5 h-3.5 text-gray-400 ml-2" />
          {SERVICE_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filter === f ? 'bg-white text-[#002855] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500">{filtered.length} caso(s) coinciden.</p>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">Sin resultados.</p>
        ) : filtered.map(c => {
          const fullName = `${c.client?.first_name ?? ''} ${c.client?.last_name ?? ''}`.trim() || 'Sin nombre'
          const serviceName = c.service?.name ?? 'Servicio desconocido'
          return (
            <Link
              key={c.id}
              href={`/employee/cases/${c.id}`}
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-[#F2A900] hover:shadow-sm transition"
            >
              <div className="w-10 h-10 rounded-lg bg-[#002855]/5 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5 text-[#002855]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 truncate">{fullName}</p>
                  {c.case_number && (
                    <Badge variant="secondary" className="text-[10px] font-mono">#{c.case_number}</Badge>
                  )}
                  {c.state_us && (
                    <Badge variant="secondary" className="text-[10px]">{c.state_us}</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {serviceName}
                  {c.current_phase && <> · Fase {c.current_phase}</>}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

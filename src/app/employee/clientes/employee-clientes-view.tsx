'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Phone, Mail, Search, ChevronRight, Users, Filter } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Client {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  created_at: string
  case_count: number
  services: string[]
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const SERVICE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Visa Juvenil': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  'Asilo Afirmativo': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  'Asilo Defensivo': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-400' },
  'Ajuste de Estatus': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
}

function getServiceStyle(name: string) {
  return SERVICE_COLORS[name] || { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400' }
}

export function EmployeeClientesView({ clients }: { clients: Client[] }) {
  const [search, setSearch] = useState('')
  const [letterFilter, setLetterFilter] = useState<string | null>(null)
  const [serviceFilter, setServiceFilter] = useState<string | null>(null)

  const allServices = useMemo(() => {
    const set = new Set<string>()
    clients.forEach(c => c.services.forEach(s => set.add(s)))
    return Array.from(set).sort()
  }, [clients])

  const usedLetters = useMemo(() => {
    const set = new Set<string>()
    clients.forEach(c => {
      const letter = (c.last_name || c.first_name || '')[0]?.toUpperCase()
      if (letter) set.add(letter)
    })
    return set
  }, [clients])

  const filtered = useMemo(() => {
    return clients.filter(c => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const match = `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone || '').includes(q)
        if (!match) return false
      }
      if (letterFilter) {
        const letter = (c.last_name || c.first_name || '')[0]?.toUpperCase()
        if (letter !== letterFilter) return false
      }
      if (serviceFilter) {
        if (!c.services.includes(serviceFilter)) return false
      }
      return true
    })
  }, [clients, search, letterFilter, serviceFilter])

  // Group by service
  const grouped = useMemo(() => {
    if (serviceFilter) return null // Don't group when filtered by service
    const map = new Map<string, Client[]>()
    filtered.forEach(c => {
      if (c.services.length === 0) {
        const arr = map.get('Sin servicio') || []
        arr.push(c)
        map.set('Sin servicio', arr)
      } else {
        c.services.forEach(s => {
          const arr = map.get(s) || []
          arr.push(c)
          map.set(s, arr)
        })
      }
    })
    return map
  }, [filtered, serviceFilter])

  const hasActiveFilters = letterFilter || serviceFilter

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono..."
          className="w-full pl-10 pr-4 h-11 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/40 focus:border-[#F2A900]" />
      </div>

      {/* Service filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setServiceFilter(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            !serviceFilter ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}>
          <Users className="w-3 h-3" /> Todos ({clients.length})
        </button>
        {allServices.map(s => {
          const style = getServiceStyle(s)
          const count = clients.filter(c => c.services.includes(s)).length
          return (
            <button key={s} onClick={() => setServiceFilter(serviceFilter === s ? null : s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                serviceFilter === s ? `border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]` : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              {s} ({count})
            </button>
          )
        })}
      </div>

      {/* Alphabet filter */}
      <div className="flex flex-wrap gap-1">
        {ALPHABET.map(letter => {
          const hasClients = usedLetters.has(letter)
          return (
            <button key={letter}
              disabled={!hasClients}
              onClick={() => setLetterFilter(letterFilter === letter ? null : letter)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                letterFilter === letter
                  ? 'bg-[#002855] text-white'
                  : hasClients
                    ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    : 'bg-gray-50 text-gray-300 cursor-not-allowed'
              }`}>
              {letter}
            </button>
          )
        })}
        {hasActiveFilters && (
          <button onClick={() => { setLetterFilter(null); setServiceFilter(null) }}
            className="px-3 h-8 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400">
        {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
        {hasActiveFilters ? ' (filtrado)' : ''}
      </p>

      {/* Client list */}
      {serviceFilter || !grouped ? (
        // Flat list when filtered by service
        <div className="space-y-2">
          {filtered.length === 0 && <p className="text-center text-gray-400 py-8">No se encontraron clientes.</p>}
          {filtered.map(c => <ClientCard key={c.id} client={c} />)}
        </div>
      ) : (
        // Grouped by service
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([service, serviceClients]) => {
            const style = getServiceStyle(service)
            return (
              <div key={service}>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${style.bg} mb-2`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                  <span className={`text-sm font-bold ${style.text}`}>{service}</span>
                  <span className={`text-xs ${style.text} opacity-70`}>({serviceClients.length})</span>
                </div>
                <div className="space-y-2">
                  {serviceClients.map(c => <ClientCard key={`${service}-${c.id}`} client={c} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ClientCard({ client: c }: { client: Client }) {
  return (
    <Link href={`/employee/clientes/${c.id}`}>
      <div className="bg-white rounded-xl border p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#002855] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {c.first_name[0]}{c.last_name[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{c.first_name} {c.last_name}</p>
              <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                <span>{c.case_count} caso{c.case_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {c.services.map(s => {
                const style = getServiceStyle(s)
                return <span key={s} className={`w-2 h-2 rounded-full ${style.dot}`} title={s} />
              })}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </div>
      </div>
    </Link>
  )
}

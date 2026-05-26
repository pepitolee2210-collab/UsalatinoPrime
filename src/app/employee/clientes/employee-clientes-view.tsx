'use client'

import { useState, useMemo } from 'react'
import { Phone, Search, ChevronRight, Users } from 'lucide-react'
import Link from 'next/link'

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

// Mapa de servicios a colores semánticos del sistema admin.
const SERVICE_COLORS: Record<string, { kind: 'green' | 'blue' | 'gold' | 'red' | 'accent' }> = {
  'Visa Juvenil': { kind: 'green' },
  'Asilo Afirmativo': { kind: 'blue' },
  'Asilo Defensivo': { kind: 'accent' },
  'Ajuste de Estatus': { kind: 'gold' },
}

function getServiceTokens(name: string) {
  const kind = SERVICE_COLORS[name]?.kind ?? 'accent'
  const map = {
    green:  { bg: 'var(--admin-green-soft)', text: 'var(--admin-green)', dot: 'var(--admin-green)' },
    blue:   { bg: 'var(--admin-blue-soft)',  text: 'var(--admin-blue)',  dot: 'var(--admin-blue)' },
    gold:   { bg: 'var(--admin-gold-soft)',  text: 'var(--admin-gold)',  dot: 'var(--admin-gold)' },
    red:    { bg: 'var(--admin-red-soft)',   text: 'var(--admin-red)',   dot: 'var(--admin-red)' },
    accent: { bg: 'var(--admin-accent-soft)', text: 'var(--admin-fg-muted)', dot: 'var(--admin-fg-subtle)' },
  }
  return map[kind]
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
    // Vanessa escribe "Alvarez" pero el cliente está guardado como "Álvarez".
    // El .includes() es sensible a tildes; normalizamos quitándolas en ambos
    // lados para que coincida sin importar acentos.
    const stripAccents = (s: string) =>
      s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    return clients.filter(c => {
      if (search.trim()) {
        const q = stripAccents(search)
        const haystack = stripAccents(`${c.first_name} ${c.last_name}`)
        const match = haystack.includes(q) ||
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
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: 'var(--admin-fg-subtle)' }}
        />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono..."
          className="w-full pl-10 pr-4 h-11 rounded-xl text-sm focus:outline-none transition-shadow"
          style={{
            background: 'var(--admin-bg-elev)',
            border: '0.5px solid var(--admin-border)',
            color: 'var(--admin-fg)',
            boxShadow: 'var(--admin-shadow, 0 1px 2px rgba(11,31,58,0.04))',
          }}
        />
      </div>

      {/* Service filter */}
      <div className="flex gap-2 flex-wrap">
        <FilterChip
          active={!serviceFilter}
          onClick={() => setServiceFilter(null)}
          label={`Todos (${clients.length})`}
          icon={<Users className="w-3 h-3" />}
        />
        {allServices.map(s => {
          const tokens = getServiceTokens(s)
          const count = clients.filter(c => c.services.includes(s)).length
          return (
            <FilterChip
              key={s}
              active={serviceFilter === s}
              onClick={() => setServiceFilter(serviceFilter === s ? null : s)}
              label={`${s} (${count})`}
              icon={<span className="w-2 h-2 rounded-full" style={{ background: tokens.dot }} />}
            />
          )
        })}
      </div>

      {/* Alphabet filter */}
      <div className="flex flex-wrap gap-1">
        {ALPHABET.map(letter => {
          const hasClients = usedLetters.has(letter)
          const isActive = letterFilter === letter
          return (
            <button
              key={letter}
              disabled={!hasClients}
              onClick={() => setLetterFilter(letterFilter === letter ? null : letter)}
              className="w-8 h-8 rounded-lg text-xs font-bold transition-colors"
              style={
                isActive
                  ? {
                      background: 'var(--admin-accent)',
                      color: 'var(--admin-bg-elev)',
                      border: '0.5px solid var(--admin-accent)',
                    }
                  : hasClients
                    ? {
                        background: 'var(--admin-bg-elev)',
                        color: 'var(--admin-fg-muted)',
                        border: '0.5px solid var(--admin-border)',
                      }
                    : {
                        background: 'var(--admin-bg-elev-2)',
                        color: 'var(--admin-fg-faint)',
                        border: '0.5px solid var(--admin-border)',
                        cursor: 'not-allowed',
                      }
              }
            >
              {letter}
            </button>
          )
        })}
        {hasActiveFilters && (
          <button
            onClick={() => { setLetterFilter(null); setServiceFilter(null) }}
            className="px-3 h-8 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: 'var(--admin-red-soft)',
              color: 'var(--admin-red)',
              border: '0.5px solid var(--admin-red)',
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Results count */}
      <p
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.14em',
          color: 'var(--admin-fg-subtle)',
          textTransform: 'uppercase',
        }}
      >
        {filtered.length} CLIENTE{filtered.length !== 1 ? 'S' : ''}
        {hasActiveFilters ? ' · FILTRADO' : ''}
      </p>

      {/* Client list */}
      {serviceFilter || !grouped ? (
        // Flat list when filtered by service
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-center py-8" style={{ color: 'var(--admin-fg-subtle)' }}>
              No se encontraron clientes.
            </p>
          )}
          {filtered.map(c => <ClientCard key={c.id} client={c} />)}
        </div>
      ) : (
        // Grouped by service
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([service, serviceClients]) => {
            const tokens = getServiceTokens(service)
            return (
              <div key={service}>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2"
                  style={{
                    background: tokens.bg,
                    border: '0.5px solid var(--admin-border)',
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: tokens.dot }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: tokens.text }}>{service}</span>
                  <span style={{ fontSize: 11, color: tokens.text, opacity: 0.7 }}>
                    ({serviceClients.length})
                  </span>
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

function FilterChip({
  active, onClick, label, icon,
}: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={
        active
          ? {
              background: 'var(--admin-accent-soft)',
              color: 'var(--admin-accent)',
              border: '0.5px solid var(--admin-accent)',
            }
          : {
              background: 'var(--admin-bg-elev)',
              color: 'var(--admin-fg-muted)',
              border: '0.5px solid var(--admin-border)',
            }
      }
    >
      {icon}
      {label}
    </button>
  )
}

function ClientCard({ client: c }: { client: Client }) {
  return (
    <Link href={`/employee/clientes/${c.id}`}>
      <div
        className="rounded-xl p-4 transition-all cursor-pointer hover:shadow-lg"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border)',
          boxShadow: 'var(--admin-shadow, 0 1px 3px rgba(11,31,58,0.04))',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
                color: '#FFFFFF',
              }}
            >
              {c.first_name[0]}{c.last_name[0]}
            </div>
            <div className="min-w-0">
              <p
                className="truncate"
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-fg)' }}
              >
                {c.first_name} {c.last_name}
              </p>
              <div
                className="flex items-center gap-3 mt-0.5"
                style={{ fontSize: 11, color: 'var(--admin-fg-subtle)' }}
              >
                {c.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {c.phone}
                  </span>
                )}
                <span>{c.case_count} caso{c.case_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex gap-1">
              {c.services.map(s => {
                const tokens = getServiceTokens(s)
                return (
                  <span
                    key={s}
                    className="w-2 h-2 rounded-full"
                    style={{ background: tokens.dot }}
                    title={s}
                  />
                )
              })}
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--admin-fg-subtle)' }} />
          </div>
        </div>
      </div>
    </Link>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { LayoutGrid, Table as TableIcon, Search, X } from 'lucide-react'
import { CasesTable } from './CasesTable'
import { CaseKanban } from './CaseKanban'

type ViewMode = 'table' | 'kanban'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

interface CasesViewProps {
  cases: any[]
}

function getClientName(c: any): string {
  const client = c.client as { first_name?: string; last_name?: string } | null
  return `${client?.first_name || ''} ${client?.last_name || ''}`.trim()
}

export function CasesView({ cases }: CasesViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [activeLetter, setActiveLetter] = useState<string | null>(null)
  const [activeService, setActiveService] = useState<string | null>(null)

  const services = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of cases) {
            const name = (c.service as any)?.name || 'Sin servicio'
      map.set(name, (map.get(name) || 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [cases])

  useEffect(() => {
    const saved = localStorage.getItem('henryflow-cases-view')
    if (saved === 'table' || saved === 'kanban') {
      setViewMode(saved)
    }
  }, [])

  function handleViewChange(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem('henryflow-cases-view', mode)
  }

  const availableLetters = useMemo(() => {
    const letters = new Set<string>()
    for (const c of cases) {
      const name = getClientName(c)
      if (name) {
        const first = name[0].toUpperCase()
        if (ALPHABET.includes(first)) letters.add(first)
      }
    }
    return letters
  }, [cases])

  const filteredCases = useMemo(() => {
    let result = cases

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((c) => {
        const name = getClientName(c).toLowerCase()
        const caseNumber = ((c.case_number as string) || '').toLowerCase()
                const email = ((c.client as any)?.email || '').toLowerCase()
                const service = ((c.service as any)?.name || '').toLowerCase()
        return name.includes(q) || caseNumber.includes(q) || email.includes(q) || service.includes(q)
      })
    }

    if (activeLetter) {
      result = result.filter((c) => {
        const name = getClientName(c)
        return name && name[0].toUpperCase() === activeLetter
      })
    }

    if (activeService) {
      result = result.filter((c) => {
                const name = (c.service as any)?.name || 'Sin servicio'
        return name === activeService
      })
    }

    return result
  }, [cases, search, activeLetter, activeService])

  function clearFilters() {
    setSearch('')
    setActiveLetter(null)
    setActiveService(null)
  }

  const hasFilters = search.trim() || activeLetter || activeService

  return (
    <div className="space-y-4">
      {/* Search + View toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--admin-fg-subtle)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, caso, email o servicio…"
            className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/25"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '0.5px solid var(--admin-border-strong)',
              color: 'var(--admin-fg)',
              fontSize: 13,
              letterSpacing: '-0.005em',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-80"
              style={{ color: 'var(--admin-fg-muted)' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div
          className="inline-flex items-center gap-1 p-1 rounded-xl shrink-0"
          style={{
            background: 'var(--admin-accent-soft)',
            border: '0.5px solid var(--admin-border)',
          }}
        >
          <ToggleBtn active={viewMode === 'table'} onClick={() => handleViewChange('table')} icon={<TableIcon className="w-3.5 h-3.5" />}>
            Tabla
          </ToggleBtn>
          <ToggleBtn active={viewMode === 'kanban'} onClick={() => handleViewChange('kanban')} icon={<LayoutGrid className="w-3.5 h-3.5" />}>
            Kanban
          </ToggleBtn>
        </div>
      </div>

      {/* Service filter pills */}
      <div className="flex flex-wrap gap-2">
        {services.map(([name, count]) => {
          const isActive = activeService === name
          return (
            <button
              key={name}
              onClick={() => setActiveService(isActive ? null : name)}
              className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300"
              style={{
                background: isActive ? '#FFFFFF' : 'var(--admin-accent-soft)',
                border: isActive ? '0.5px solid #FFFFFF' : '0.5px solid var(--admin-border-strong)',
                color: isActive ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
                fontSize: 12,
                letterSpacing: '-0.005em',
                boxShadow: isActive ? '0 0 16px rgba(255,255,255,0.18)' : 'none',
              }}
            >
              {name}
              <span
                className="inline-flex items-center justify-center px-1.5 rounded-full"
                style={{
                  background: isActive ? 'rgba(0,0,0,0.15)' : 'var(--admin-border)',
                  color: isActive ? 'var(--admin-bg-deep)' : 'var(--admin-fg-subtle)',
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 700,
                  minWidth: 18,
                  height: 16,
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Alphabet filter */}
      <div className="flex flex-wrap gap-1">
        {ALPHABET.map((letter) => {
          const hasCase = availableLetters.has(letter)
          const isActive = activeLetter === letter
          return (
            <button
              key={letter}
              onClick={() => setActiveLetter(isActive ? null : letter)}
              disabled={!hasCase && !isActive}
              className="w-8 h-8 rounded-lg transition-all duration-300"
              style={{
                background: isActive ? '#FFFFFF' : hasCase ? 'rgba(255,255,255,0.03)' : 'transparent',
                border: isActive ? '0.5px solid #FFFFFF' : hasCase ? '0.5px solid var(--admin-border)' : '0.5px solid transparent',
                color: isActive ? 'var(--admin-bg-deep)' : hasCase ? 'var(--admin-fg)' : 'var(--admin-fg-faint)',
                fontSize: 11,
                fontWeight: 600,
                cursor: hasCase || isActive ? 'pointer' : 'not-allowed',
                boxShadow: isActive ? '0 0 16px rgba(255,255,255,0.2)' : 'none',
                fontFamily: 'var(--font-mono-tech)',
                letterSpacing: '0.02em',
              }}
            >
              {letter}
            </button>
          )
        })}
      </div>

      {/* Active filters summary */}
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--admin-fg-subtle)' }}>
            {filteredCases.length} DE {cases.length} CASOS
          </span>
          {activeLetter && <FilterChip label={activeLetter} onRemove={() => setActiveLetter(null)} />}
          {activeService && <FilterChip label={activeService} onRemove={() => setActiveService(null)} />}
          {search.trim() && <FilterChip label={`"${search}"`} onRemove={() => setSearch('')} />}
          <button
            onClick={clearFilters}
            style={{
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: '#FCA5A5',
              marginLeft: 4,
            }}
          >
            LIMPIAR
          </button>
        </div>
      )}

      {/* Content */}
      {viewMode === 'table' ? <CasesTable cases={filteredCases} /> : <CaseKanban cases={filteredCases} />}
    </div>
  )
}

function ToggleBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-300"
      style={{
        background: active ? '#FFFFFF' : 'transparent',
        color: active ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '-0.005em',
        boxShadow: active ? '0 0 12px rgba(255,255,255,0.15)' : 'none',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{
        background: 'var(--admin-accent-soft)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 10,
        fontWeight: 700,
        color: '#FFFFFF',
        letterSpacing: '0.05em',
      }}
    >
      {label}
      <button onClick={onRemove} className="transition-opacity hover:opacity-60" style={{ color: '#FFFFFF' }}>
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

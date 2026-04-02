'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
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

  // Get unique services from cases
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

  // Letters that have at least one case
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

  // Filtered cases
  const filteredCases = useMemo(() => {
    let result = cases

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(c => {
        const name = getClientName(c).toLowerCase()
        const caseNumber = ((c.case_number as string) || '').toLowerCase()
        const email = ((c.client as any)?.email || '').toLowerCase()
        const service = ((c.service as any)?.name || '').toLowerCase()
        return name.includes(q) || caseNumber.includes(q) || email.includes(q) || service.includes(q)
      })
    }

    if (activeLetter) {
      result = result.filter(c => {
        const name = getClientName(c)
        return name && name[0].toUpperCase() === activeLetter
      })
    }

    if (activeService) {
      result = result.filter(c => {
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, caso, email o servicio..."
            className="w-full pl-9 pr-9 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/40 focus:border-[#F2A900]/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => handleViewChange('table')}>
            <TableIcon className="w-4 h-4 mr-1" /> Tabla
          </Button>
          <Button variant={viewMode === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => handleViewChange('kanban')}>
            <LayoutGrid className="w-4 h-4 mr-1" /> Kanban
          </Button>
        </div>
      </div>

      {/* Service filter */}
      <div className="flex flex-wrap gap-2">
        {services.map(([name, count]) => {
          const isActive = activeService === name
          return (
            <button key={name} onClick={() => setActiveService(isActive ? null : name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#F2A900] text-[#001020] shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-[#F2A900] hover:text-[#9a6500]'
              }`}>
              {name}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-[#001020]/20 text-[#001020]' : 'bg-gray-100 text-gray-500'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Alphabet filter */}
      <div className="flex flex-wrap gap-1">
        {ALPHABET.map(letter => {
          const hasCase = availableLetters.has(letter)
          const isActive = activeLetter === letter
          return (
            <button
              key={letter}
              onClick={() => setActiveLetter(isActive ? null : letter)}
              disabled={!hasCase && !isActive}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#002855] text-white shadow-sm'
                  : hasCase
                  ? 'bg-white text-gray-700 border border-gray-200 hover:border-[#F2A900] hover:text-[#002855]'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed'
              }`}
            >
              {letter}
            </button>
          )
        })}
      </div>

      {/* Active filters summary */}
      {hasFilters && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">
            {filteredCases.length} de {cases.length} casos
          </span>
          {activeLetter && (
            <Badge letter={activeLetter} onRemove={() => setActiveLetter(null)} />
          )}
          {activeService && (
            <Badge letter={activeService} onRemove={() => setActiveService(null)} />
          )}
          {search.trim() && (
            <Badge letter={`"${search}"`} onRemove={() => setSearch('')} />
          )}
          <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 ml-1">
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Content */}
      {viewMode === 'table' ? (
        <CasesTable cases={filteredCases} />
      ) : (
        <CaseKanban cases={filteredCases} />
      )}
    </div>
  )
}

function Badge({ letter, onRemove }: { letter: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#002855]/10 text-[#002855] rounded-md text-xs font-medium">
      {letter}
      <button onClick={onRemove} className="hover:text-red-500">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

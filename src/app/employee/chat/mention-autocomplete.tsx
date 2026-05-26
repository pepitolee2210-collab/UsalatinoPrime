'use client'

import { useEffect, useState } from 'react'
import { User, Briefcase, Loader2 } from 'lucide-react'
import type { ChatMention } from './types'

interface SearchResults {
  clients: Array<{ id: string; first_name: string; last_name: string; email: string }>
  cases: Array<{ id: string; case_number: string; service: { name: string } | null }>
}

interface Props {
  /** El carácter que disparó el autocomplete: '@' o '#' */
  trigger: '@' | '#'
  /** Texto buscado (sin el trigger) */
  query: string
  /** Cuando elige una opción */
  onSelect: (mention: ChatMention) => void
}

/**
 * Dropdown de autocomplete para mentions.
 * Reutiliza /api/employee/search para no duplicar lógica.
 */
export function MentionAutocomplete({ trigger, query, onSelect }: Props) {
  const [results, setResults] = useState<SearchResults>({ clients: [], cases: [] })
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults({ clients: [], cases: [] })
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/employee/search?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal, credentials: 'same-origin' }
        )
        if (res.ok) {
          const data = await res.json()
          setResults({ clients: data.clients || [], cases: data.cases || [] })
          setSelectedIdx(0)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }, 180)
    return () => {
      ctrl.abort()
      clearTimeout(t)
    }
  }, [query])

  const visibleItems: ChatMention[] =
    trigger === '@'
      ? results.clients.slice(0, 6).map((c) => ({
          type: 'client' as const,
          id: c.id,
          label: `${c.first_name} ${c.last_name}`.trim() || c.email,
        }))
      : results.cases.slice(0, 6).map((cs) => ({
          type: 'case' as const,
          id: cs.id,
          label: cs.case_number,
        }))

  // Permite navegación con flechas desde el textarea padre
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (visibleItems.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, visibleItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const item = visibleItems[selectedIdx]
        if (item) onSelect(item)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visibleItems, selectedIdx, onSelect])

  if (query.trim().length === 0 && visibleItems.length === 0 && !loading) return null

  return (
    <div className="absolute bottom-full left-0 mb-2 w-full max-w-sm rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden z-20">
      <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {trigger === '@' ? 'Mencionar cliente' : 'Referenciar caso'}
        </p>
        {loading && <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />}
      </div>
      <div className="max-h-[200px] overflow-y-auto py-1">
        {visibleItems.length === 0 ? (
          <p className="px-3 py-2 text-[11px] text-gray-400">
            {query ? 'Sin resultados' : `Escribe para buscar ${trigger === '@' ? 'clientes' : 'casos'}...`}
          </p>
        ) : (
          visibleItems.map((item, i) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              onMouseEnter={() => setSelectedIdx(i)}
              onClick={() => onSelect(item)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                selectedIdx === i ? '' : 'hover:bg-gray-50'
              }`}
              style={selectedIdx === i ? { background: 'var(--admin-gold-soft)' } : undefined}
            >
              {item.type === 'client' ? (
                <User className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              ) : (
                <Briefcase className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              )}
              <span className="text-sm text-gray-900 truncate">
                {item.type === 'case' ? `#${item.label}` : item.label}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

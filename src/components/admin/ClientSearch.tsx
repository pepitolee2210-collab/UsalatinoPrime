'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SearchResult {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
}

export function ClientSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSearch(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const q = value.toLowerCase()

      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .eq('role', 'client')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8)

      setResults(data || [])
      setOpen(true)
      setLoading(false)
    }, 300)
  }

  function handleSelect(id: string) {
    setOpen(false)
    setQuery('')
    router.push(`/admin/clients/${id}`)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
          style={{ color: 'var(--admin-fg-subtle)' }}
        />
        <input
          type="text"
          placeholder="Buscar cliente…"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full pl-9 pr-3 h-9 rounded-lg text-sm outline-none transition-colors focus:border-white/25"
          style={{
            background: 'var(--admin-accent-soft)',
            border: '0.5px solid var(--admin-border-strong)',
            color: 'var(--admin-fg)',
            fontSize: 13,
            letterSpacing: '-0.005em',
          }}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin" style={{ color: 'var(--admin-fg-muted)' }} />
        )}
      </div>
      {open && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl z-50 max-h-64 overflow-y-auto admin-scroll"
          style={{
            background: 'linear-gradient(180deg, rgba(15,15,15,0.98), rgba(8,8,8,0.98))',
            border: '0.5px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 0.5px var(--admin-accent-soft) inset',
          }}
        >
          {results.map((r, idx) => (
            <button
              key={r.id}
              onClick={() => handleSelect(r.id)}
              className="w-full text-left px-3 py-2.5 transition-colors hover:bg-white/5"
              style={{
                borderBottom: idx < results.length - 1 ? '0.5px solid var(--admin-accent-soft)' : 'none',
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>
                {r.first_name} {r.last_name}
              </p>
              <p style={{ fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 1 }}>
                {r.email} {r.phone ? `· ${r.phone}` : ''}
              </p>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl z-50 p-4"
          style={{
            background: 'linear-gradient(180deg, rgba(15,15,15,0.98), rgba(8,8,8,0.98))',
            border: '0.5px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <p style={{ fontSize: 12, color: 'var(--admin-fg-subtle)', textAlign: 'center', letterSpacing: '0.05em' }}>
            Sin resultados
          </p>
        </div>
      )}
    </div>
  )
}

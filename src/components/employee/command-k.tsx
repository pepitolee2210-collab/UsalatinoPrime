'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, User, FileSignature, Briefcase, Loader2 } from 'lucide-react'

interface ClientHit {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
}
interface ContractHit {
  id: string
  client_full_name: string
  service_name: string
  status: string
  total_price: number
  signed_at: string | null
  client_id: string | null
}
interface CaseHit {
  id: string
  case_number: string
  client_id: string | null
  service: { name: string } | null
}
interface SearchResults {
  clients: ClientHit[]
  contracts: ContractHit[]
  cases: CaseHit[]
}

type Hit =
  | { kind: 'client'; href: string; primary: string; secondary: string }
  | { kind: 'contract'; href: string; primary: string; secondary: string }
  | { kind: 'case'; href: string; primary: string; secondary: string }

/**
 * Buscador global Cmd+K / Ctrl+K para el panel del empleado.
 * Busca clientes, contratos y casos. Resultados clickeables con navegación
 * por teclado (arriba/abajo/enter/escape).
 */
export function CommandK() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({ clients: [], contracts: [], cases: [] })
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Listener global Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const modifier = isMac ? e.metaKey : e.ctrlKey
      if (modifier && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Foco al abrir
  useEffect(() => {
    if (open) {
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults({ clients: [], contracts: [], cases: [] })
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!open) return
    if (query.trim().length < 2) {
      setResults({ clients: [], contracts: [], cases: [] })
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/employee/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
          credentials: 'same-origin',
        })
        if (res.ok) {
          const data = (await res.json()) as SearchResults
          setResults(data)
          setSelectedIdx(0)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => {
      ctrl.abort()
      clearTimeout(t)
    }
  }, [query, open])

  // Lista plana ordenada para navegación con flechas
  const hits = useMemo<Hit[]>(() => {
    const list: Hit[] = []
    for (const c of results.clients) {
      list.push({
        kind: 'client',
        href: `/employee/clientes/${c.id}`,
        primary: `${c.first_name} ${c.last_name}`.trim() || c.email,
        secondary: c.email,
      })
    }
    for (const ct of results.contracts) {
      list.push({
        kind: 'contract',
        href: ct.client_id
          ? `/employee/clientes/${ct.client_id}`
          : '/employee/contratos',
        primary: ct.client_full_name,
        secondary: `${ct.service_name} · $${Number(ct.total_price).toLocaleString()}`,
      })
    }
    for (const cs of results.cases) {
      list.push({
        kind: 'case',
        href: cs.client_id ? `/employee/clientes/${cs.client_id}` : '/employee/clientes',
        primary: `Caso ${cs.case_number}`,
        secondary: cs.service?.name || '—',
      })
    }
    return list
  }, [results])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = hits[selectedIdx]
      if (hit) go(hit.href)
    }
  }

  return (
    <>
      {/* Trigger sutil en la barra (botón pequeño con shortcut) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 rounded-full px-2.5 h-8 text-xs transition-opacity hover:opacity-80"
        style={{
          background: 'var(--admin-bg-elev)',
          color: 'var(--admin-fg-muted)',
          border: '0.5px solid var(--admin-border-strong)',
        }}
        title="Buscar (Cmd+K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Buscar</span>
        <kbd
          className="ml-1 hidden lg:inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px]"
          style={{
            background: 'var(--admin-bg-elev-2)',
            color: 'var(--admin-fg-subtle)',
            border: '0.5px solid var(--admin-border)',
            fontFamily: 'var(--font-mono-tech)',
          }}
        >
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[10vh]">
          <div
            className="absolute inset-0"
            style={{
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setOpen(false)}
          />
          <div
            className="relative w-full max-w-xl rounded-2xl overflow-hidden"
            style={{
              background: 'var(--admin-bg-elev)',
              border: '0.5px solid var(--admin-border-strong)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.30)',
            }}
          >
            <div
              className="flex items-center gap-2 px-4"
              style={{ borderBottom: '0.5px solid var(--admin-border)' }}
            >
              <Search
                className="w-4 h-4"
                style={{ color: 'var(--admin-fg-subtle)' }}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Buscar cliente, contrato, caso..."
                className="flex-1 h-12 bg-transparent text-sm outline-none"
                style={{ color: 'var(--admin-fg)' }}
              />
              {loading && (
                <Loader2
                  className="w-4 h-4 animate-spin"
                  style={{ color: 'var(--admin-fg-muted)' }}
                />
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-7 w-7 inline-flex items-center justify-center rounded transition-opacity hover:opacity-80"
                style={{ color: 'var(--admin-fg-subtle)' }}
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {query.trim().length < 2 ? (
                <p
                  className="px-4 py-6 text-center text-xs"
                  style={{ color: 'var(--admin-fg-subtle)' }}
                >
                  Escribe al menos 2 caracteres para buscar.
                </p>
              ) : hits.length === 0 && !loading ? (
                <p
                  className="px-4 py-6 text-center text-xs"
                  style={{ color: 'var(--admin-fg-subtle)' }}
                >
                  Sin resultados para &quot;{query}&quot;.
                </p>
              ) : (
                <div className="py-2">
                  {results.clients.length > 0 && (
                    <Section title="Clientes">
                      {results.clients.map((c, i) => (
                        <HitRow
                          key={c.id}
                          selected={selectedIdx === i}
                          onClick={() => go(`/employee/clientes/${c.id}`)}
                          onMouseEnter={() => setSelectedIdx(i)}
                          icon={<User className="w-4 h-4" style={{ color: 'var(--admin-blue)' }} />}
                          primary={`${c.first_name} ${c.last_name}`.trim() || c.email}
                          secondary={c.email}
                        />
                      ))}
                    </Section>
                  )}
                  {results.contracts.length > 0 && (
                    <Section title="Contratos">
                      {results.contracts.map((ct, j) => {
                        const idx = results.clients.length + j
                        return (
                          <HitRow
                            key={ct.id}
                            selected={selectedIdx === idx}
                            onClick={() =>
                              go(
                                ct.client_id
                                  ? `/employee/clientes/${ct.client_id}`
                                  : '/employee/contratos'
                              )
                            }
                            onMouseEnter={() => setSelectedIdx(idx)}
                            icon={
                              <FileSignature className="w-4 h-4" style={{ color: 'var(--admin-gold)' }} />
                            }
                            primary={ct.client_full_name}
                            secondary={`${ct.service_name} · $${Number(ct.total_price).toLocaleString()}`}
                          />
                        )
                      })}
                    </Section>
                  )}
                  {results.cases.length > 0 && (
                    <Section title="Casos">
                      {results.cases.map((cs, k) => {
                        const idx = results.clients.length + results.contracts.length + k
                        return (
                          <HitRow
                            key={cs.id}
                            selected={selectedIdx === idx}
                            onClick={() =>
                              go(
                                cs.client_id
                                  ? `/employee/clientes/${cs.client_id}`
                                  : '/employee/clientes'
                              )
                            }
                            onMouseEnter={() => setSelectedIdx(idx)}
                            icon={<Briefcase className="w-4 h-4" style={{ color: 'var(--admin-green)' }} />}
                            primary={`Caso ${cs.case_number}`}
                            secondary={cs.service?.name || '—'}
                          />
                        )
                      })}
                    </Section>
                  )}
                </div>
              )}
            </div>

            <div
              className="px-4 py-2 flex items-center gap-3 text-[10px]"
              style={{
                borderTop: '0.5px solid var(--admin-border)',
                color: 'var(--admin-fg-subtle)',
                background: 'var(--admin-bg-deep)',
              }}
            >
              <Hotkey label="↑↓" desc="Navegar" />
              <Hotkey label="↵" desc="Abrir" />
              <Hotkey label="Esc" desc="Cerrar" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-1 pb-2">
      <p
        className="px-3 py-1.5"
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: 'var(--admin-fg-subtle)',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </p>
      <div>{children}</div>
    </div>
  )
}

function HitRow({
  selected, onClick, onMouseEnter, icon, primary, secondary,
}: {
  selected: boolean
  onClick: () => void
  onMouseEnter: () => void
  icon: React.ReactNode
  primary: string
  secondary: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md transition-colors"
      style={
        selected
          ? { background: 'var(--admin-blue-soft)' }
          : undefined
      }
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-medium truncate"
          style={{ color: 'var(--admin-fg)' }}
        >
          {primary}
        </p>
        <p
          className="text-[11px] truncate"
          style={{ color: 'var(--admin-fg-muted)' }}
        >
          {secondary}
        </p>
      </div>
    </button>
  )
}

function Hotkey({ label, desc }: { label: string; desc: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd
        className="rounded px-1 py-0.5"
        style={{
          background: 'var(--admin-bg-elev)',
          border: '0.5px solid var(--admin-border-strong)',
          color: 'var(--admin-fg-muted)',
          fontFamily: 'var(--font-mono-tech)',
        }}
      >
        {label}
      </kbd>
      <span>{desc}</span>
    </span>
  )
}

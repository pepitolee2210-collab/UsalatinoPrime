'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Trash2, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'

interface Client {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  created_at: string
  case_count: number
}

interface ClientsListProps {
  initialClients: Client[]
}

export function ClientsList({ initialClients }: ClientsListProps) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = searchQuery.length < 2
    ? clients
    : clients.filter((c) => {
        const q = searchQuery.toLowerCase()
        return (
          c.first_name.toLowerCase().includes(q) ||
          c.last_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q))
        )
      })

  async function handleDelete(client: Client) {
    if (!confirm(`¿Eliminar a ${client.first_name} ${client.last_name} (${client.email})?\n\nEsto eliminará todos sus datos asociados (casos, pagos, notificaciones). Esta acción no se puede deshacer.`)) {
      return
    }
    setDeletingId(client.id)
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ clientId: client.id }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Error al eliminar')
        return
      }
      setClients((prev) => prev.filter((c) => c.id !== client.id))
      toast.success(`${client.first_name} ${client.last_name} eliminado`)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#525252' }} />
        <input
          type="text"
          placeholder="Buscar por nombre, email o teléfono…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/25"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            color: '#FAFAFA',
            fontSize: 13,
            letterSpacing: '-0.005em',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-80"
            style={{ color: '#A1A1A1' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
          border: '0.5px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                <Th>Nombre</Th>
                <Th>Email</Th>
                <Th>Teléfono</Th>
                <Th>Casos</Th>
                <Th>Registrado</Th>
                <Th className="w-[60px]"></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <p style={{ fontSize: 13, color: '#525252', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em' }}>
                      {searchQuery.length >= 2 ? 'SIN RESULTADOS' : 'NO HAY CLIENTES REGISTRADOS'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: idx < filtered.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Td>
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="transition-opacity hover:opacity-80"
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#FFFFFF',
                          letterSpacing: '-0.005em',
                        }}
                      >
                        {c.first_name} {c.last_name}
                      </Link>
                    </Td>
                    <Td>
                      <span style={{ fontSize: 12, color: '#A1A1A1' }}>{c.email}</span>
                    </Td>
                    <Td>
                      <span style={{ fontSize: 12, color: '#A1A1A1', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.02em' }}>
                        {c.phone || '—'}
                      </span>
                    </Td>
                    <Td>
                      {c.case_count > 0 ? (
                        <span
                          className="inline-flex items-center justify-center"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '0.5px solid rgba(255,255,255,0.12)',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontFamily: 'var(--font-mono-tech)',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#FFFFFF',
                          }}
                        >
                          {c.case_count}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#525252' }}>—</span>
                      )}
                    </Td>
                    <Td>
                      <span style={{ fontSize: 11, color: '#525252', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
                        {format(new Date(c.created_at), 'd MMM yyyy', { locale: es }).toUpperCase()}
                      </span>
                    </Td>
                    <Td>
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={deletingId === c.id}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-red-500/10"
                        style={{ color: deletingId === c.id ? '#525252' : '#FCA5A5' }}
                      >
                        {deletingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-left ${className || ''}`}
      style={{
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.18em',
        color: '#525252',
      }}
    >
      {typeof children === 'string' ? children.toUpperCase() : children}
    </th>
  )
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 ${className || ''}`} style={{ verticalAlign: 'middle' }}>
      {children}
    </td>
  )
}

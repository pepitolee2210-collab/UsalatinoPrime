'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileSignature, Search, ExternalLink, FileText } from 'lucide-react'

interface Acceptance {
  id: string
  accepted_at: string
  terms_version: string
  document_id: string | null
  case_id: string
  case_number: string
  service_name: string
  client_name: string
}

interface TermsAcceptancesRegistryProps {
  /** Superficie desde la que se monta — define a dónde apunta "Abrir expediente". */
  role: 'admin' | 'employee'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function TermsAcceptancesRegistry({ role }: TermsAcceptancesRegistryProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acceptances, setAcceptances] = useState<Acceptance[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/staff/terms-acceptances', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('No autorizado o error de servidor')
        return r.json()
      })
      .then((j) => setAcceptances(j.acceptances ?? []))
      .catch((e) => setError(e?.message ?? 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return acceptances
    return acceptances.filter(
      (a) =>
        a.client_name.toLowerCase().includes(q) ||
        a.case_number.toLowerCase().includes(q) ||
        a.service_name.toLowerCase().includes(q),
    )
  }, [acceptances, query])

  return (
    <div style={{ color: 'var(--admin-fg)' }}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--admin-accent-soft)', border: '0.5px solid var(--admin-border-strong)' }}
        >
          <FileSignature className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--admin-fg)', letterSpacing: '-0.02em' }}>
            Términos y Condiciones
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--admin-fg-muted)' }}>
            Registro de aceptaciones firmadas por los clientes.
          </p>
        </div>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4 max-w-md"
        style={{ background: 'var(--admin-bg-elev, rgba(255,255,255,0.04))', border: '0.5px solid var(--admin-border)' }}
      >
        <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--admin-fg-subtle)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cliente, caso o servicio..."
          className="bg-transparent outline-none w-full text-sm"
          style={{ color: 'var(--admin-fg)' }}
        />
      </div>

      {/* States */}
      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--admin-fg-muted)' }}>
          Cargando aceptaciones...
        </div>
      ) : error ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--admin-fg-muted)' }}>
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="py-14 text-center rounded-2xl"
          style={{ border: '1px dashed var(--admin-border-strong)', color: 'var(--admin-fg-muted)' }}
        >
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">
            {query ? 'Sin resultados para tu búsqueda.' : 'Aún no hay Términos y Condiciones firmados.'}
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '0.5px solid var(--admin-border)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: 'var(--admin-accent-soft)' }}>
                  {['Cliente', 'Servicio', 'Caso', 'Fecha', 'Versión', ''].map((h) => (
                    <th
                      key={h}
                      className="text-left font-semibold px-4 py-3 whitespace-nowrap"
                      style={{ color: 'var(--admin-fg-muted)', fontSize: 12, letterSpacing: '0.02em' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    style={{ borderTop: '0.5px solid var(--admin-border)' }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--admin-fg)' }}>
                      {a.client_name}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--admin-fg-muted)' }}>
                      {a.service_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--admin-fg-muted)' }}>
                      {a.case_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--admin-fg-muted)' }}>
                      {formatDate(a.accepted_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: 'var(--admin-accent-soft)',
                          color: 'var(--admin-accent)',
                          border: '0.5px solid var(--admin-accent-glow)',
                        }}
                      >
                        {a.terms_version}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <a
                          href={`/api/staff/terms-acceptances/${a.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: 'var(--admin-accent)', color: 'var(--admin-bg)' }}
                        >
                          <FileText className="w-3.5 h-3.5" /> Ver PDF
                        </a>
                        <Link
                          href={`/${role}/cases/${a.case_id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{
                            border: '0.5px solid var(--admin-border-strong)',
                            color: 'var(--admin-fg-muted)',
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Expediente
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

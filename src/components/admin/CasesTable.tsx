'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { statusLabels } from '@/lib/case-status'
import { Trash2, FileText, CheckCircle, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface CasesTableProps {
  cases: Array<Record<string, unknown>>
}

export function CasesTable({ cases }: CasesTableProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string, caseNumber: string) {
    const confirmed = confirm(`¿Estás seguro de eliminar el caso #${caseNumber}?\n\nEsto eliminará todos los documentos y formularios asociados. Esta acción no se puede deshacer.`)
    if (!confirmed) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/cases/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Error al eliminar')
        return
      }
      toast.success(`Caso #${caseNumber} eliminado`)
      router.refresh()
    } catch {
      toast.error('Error al eliminar caso')
    } finally {
      setDeleting(null)
    }
  }

  return (
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
            <tr
              style={{
                borderBottom: '0.5px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <Th>Caso</Th>
              <Th>Cliente</Th>
              <Th>Servicio</Th>
              <Th>Estado</Th>
              <Th>Progreso</Th>
              <Th>Fecha</Th>
              <Th className="w-10"></Th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c, idx) => {
              const status = statusLabels[(c.intake_status as string)] || statusLabels.in_progress
              const docCount = (c.doc_count as number) || 0
              const subTotal = (c.submission_total as number) || 0
              const subDone = (c.submission_done as number) || 0
              const client = c.client as { first_name?: string; last_name?: string; email?: string } | null
              const service = c.service as { name?: string } | null

              return (
                <tr
                  key={c.id as string}
                  className="transition-colors"
                  style={{
                    borderBottom: idx < cases.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Td>
                    <Link
                      href={`/admin/cases/${c.id}`}
                      className="font-mono transition-colors hover:opacity-80"
                      style={{
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#FFFFFF',
                        letterSpacing: '0.02em',
                      }}
                    >
                      #{c.case_number as string}
                    </Link>
                  </Td>
                  <Td>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }}>
                      {client?.first_name} {client?.last_name}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', marginTop: 1 }}>{client?.email}</p>
                  </Td>
                  <Td>
                    <span style={{ fontSize: 12, color: 'var(--admin-fg-muted)', letterSpacing: '-0.005em' }}>
                      {service?.name || '—'}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge label={status.label} variant={mapStatusVariant(c.intake_status as string)} />
                  </Td>
                  <Td>
                    <ProgressIndicator docCount={docCount} subTotal={subTotal} subDone={subDone} />
                  </Td>
                  <Td>
                    <span style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
                      {format(new Date(c.created_at as string), 'd MMM yyyy', { locale: es }).toUpperCase()}
                    </span>
                  </Td>
                  <Td>
                    <button
                      onClick={() => handleDelete(c.id as string, c.case_number as string)}
                      disabled={deleting === c.id}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-red-500/10"
                      style={{ color: deleting === c.id ? 'var(--admin-fg-subtle)' : '#FCA5A5' }}
                    >
                      {deleting === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </Td>
                </tr>
              )
            })}
            {cases.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <p style={{ fontSize: 13, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em' }}>
                    SIN CASOS REGISTRADOS
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
        color: 'var(--admin-fg-subtle)',
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

type StatusVariant = 'active' | 'pending' | 'completed' | 'paused' | 'neutral'

function mapStatusVariant(status: string): StatusVariant {
  if (status === 'completed' || status === 'sent') return 'completed'
  if (status === 'paused' || status === 'archived') return 'paused'
  if (status === 'pending' || status === 'awaiting') return 'pending'
  if (status === 'in_progress' || status === 'active') return 'active'
  return 'neutral'
}

const STATUS_STYLES: Record<StatusVariant, { bg: string; border: string; dot: string; text: string }> = {
  active:    { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.3)', dot: '#4ADE80', text: '#86EFAC' },
  pending:   { bg: 'rgba(250,204,21,0.10)', border: 'rgba(250,204,21,0.3)', dot: '#FACC15', text: '#FDE68A' },
  completed: { bg: 'var(--admin-border)', border: 'rgba(255,255,255,0.18)', dot: '#FFFFFF', text: '#FFFFFF' },
  paused:    { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.3)', dot: '#94A3B8', text: '#CBD5E1' },
  neutral:   { bg: 'var(--admin-accent-soft)', border: 'var(--admin-border-strong)', dot: 'var(--admin-fg-muted)', text: 'var(--admin-fg-muted)' },
}

function StatusBadge({ label, variant }: { label: string; variant: StatusVariant }) {
  const s = STATUS_STYLES[variant]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
      style={{
        background: s.bg,
        border: `0.5px solid ${s.border}`,
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: s.text,
      }}
    >
      <span className="rounded-full" style={{ width: 5, height: 5, background: s.dot }} />
      {label.toUpperCase()}
    </span>
  )
}

function ProgressIndicator({ docCount, subTotal, subDone }: { docCount: number; subTotal: number; subDone: number }) {
  const hasDocs = docCount > 0
  const hasSubmissions = subTotal > 0
  const allSubmitted = subTotal > 0 && subDone === subTotal

  if (!hasDocs && !hasSubmissions) {
    return <span style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>—</span>
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {hasDocs && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--admin-accent-soft)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 10,
            color: 'var(--admin-fg-muted)',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          <FileText className="w-2.5 h-2.5" />
          {docCount}
        </span>
      )}
      {hasSubmissions && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
          style={{
            background: allSubmitted ? 'rgba(34,197,94,0.12)' : 'rgba(250,204,21,0.10)',
            border: allSubmitted ? '0.5px solid rgba(34,197,94,0.3)' : '0.5px solid rgba(250,204,21,0.3)',
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 10,
            color: allSubmitted ? '#86EFAC' : '#FDE68A',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          {allSubmitted ? <CheckCircle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
          {subDone}/{subTotal}
        </span>
      )}
    </div>
  )
}

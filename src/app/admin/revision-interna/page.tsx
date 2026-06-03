'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Loader2, CheckCircle, XCircle, Clock, Send, RefreshCw, Eye, FileText,
  AlertCircle, Sparkles, User,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { INTERNAL_CATEGORY_LABELS } from '@/components/internal-docs/upload-modal'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

interface DocumentRow {
  id: string
  case_id: string
  client_id: string
  uploaded_by: string
  category: string
  file_name: string
  file_size: number | null
  status: 'pending_review' | 'approved' | 'rejected' | 'published'
  upload_notes: string | null
  review_comment: string | null
  reviewed_at: string | null
  published_at: string | null
  version: number
  created_at: string
  client?: { first_name: string; last_name: string }
  uploader?: { first_name: string; last_name: string }
  reviewer?: { first_name: string; last_name: string }
  case?: { case_number: string; service?: { name: string } | { name: string }[] | null }
}

type TabKey = 'pending_review' | 'approved' | 'rejected' | 'published' | 'all'

const BTN_GHOST =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ' +
  'hover:bg-white/10 active:scale-95 text-[11px] font-semibold tracking-tight ' +
  'bg-white/[0.04] border border-white/10 text-[color:var(--admin-fg)] disabled:opacity-50'

const BTN_SUCCESS =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ' +
  'hover:opacity-90 active:scale-95 text-[11px] font-semibold tracking-tight ' +
  'bg-[color:var(--admin-green-soft)] border border-[color:var(--admin-green)] text-[color:var(--admin-green-on)] disabled:opacity-50'

const BTN_DANGER =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ' +
  'hover:opacity-90 active:scale-95 text-[11px] font-semibold tracking-tight ' +
  'bg-[color:var(--admin-red-soft)] border border-[color:var(--admin-red)] text-[color:var(--admin-red-on)] disabled:opacity-50'

const BTN_DANGER_PRIMARY =
  'inline-flex items-center gap-1.5 px-4 py-2 rounded-full transition-all duration-200 ' +
  'hover:opacity-90 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-[color:var(--destructive)] text-white shadow-[var(--admin-shadow)] disabled:opacity-50'

export default function RevisionInternaAdminPage() {
  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('pending_review')
  const [acting, setActing] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<DocumentRow | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<DocumentRow | null>(null)
  const [rejectComment, setRejectComment] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/internal-documents/list?limit=300')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error')
      setDocs(json.documents || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar documentos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const id = setInterval(() => { void load() }, 15_000)
    return () => clearInterval(id)
  }, [load])

  const counts = useMemo(() => {
    const c = { pending_review: 0, approved: 0, rejected: 0, published: 0 }
    for (const d of docs) c[d.status]++
    return c
  }, [docs])

  const filtered = tab === 'all' ? docs : docs.filter(d => d.status === tab)

  const groupedByClient = useMemo(() => {
    const map = new Map<string, { client: DocumentRow['client']; case_number?: string; docs: DocumentRow[] }>()
    for (const d of filtered) {
      const key = d.client_id
      if (!map.has(key)) {
        map.set(key, { client: d.client, case_number: d.case?.case_number, docs: [] })
      }
      map.get(key)!.docs.push(d)
    }
    return Array.from(map.entries()).map(([client_id, v]) => ({ client_id, ...v }))
  }, [filtered])

  async function approve(d: DocumentRow) {
    setActing(d.id)
    try {
      const res = await fetch(`/api/internal-documents/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Error al aprobar'); return }
      toast.success('Documento aprobado')
      await load()
    } catch { toast.error('Error de conexión') }
    finally { setActing(null) }
  }

  async function reject() {
    if (!rejecting || !rejectComment.trim()) {
      toast.error('Escribe el motivo del rechazo')
      return
    }
    setActing(rejecting.id)
    try {
      const res = await fetch(`/api/internal-documents/${rejecting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', comment: rejectComment }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Error al rechazar'); return }
      toast.success('Documento rechazado')
      setRejecting(null); setRejectComment('')
      await load()
    } catch { toast.error('Error de conexión') }
    finally { setActing(null) }
  }

  async function openPreview(d: DocumentRow) {
    setPreviewing(d); setPreviewUrl(null)
    try {
      const res = await fetch(`/api/internal-documents/${d.id}`)
      const json = await res.json()
      if (res.ok) setPreviewUrl(json.signed_url)
    } catch {}
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Documentos · Revisión Interna"
        title="Revisión Interna"
        accentDot
        description="Documentos que el equipo (Diana, Andrium) sube para tu aprobación antes de entregarlos al cliente."
        action={
          <button onClick={() => load()} className={BTN_GHOST}>
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Clock className="w-4 h-4" />} label="Esperando revisión" value={counts.pending_review} tone="warning" active={tab === 'pending_review'} onClick={() => setTab('pending_review')} />
        <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Aprobados" value={counts.approved} hint="esperando publicar" tone="success" active={tab === 'approved'} onClick={() => setTab('approved')} />
        <StatCard icon={<XCircle className="w-4 h-4" />} label="Rechazados" value={counts.rejected} tone="danger" active={tab === 'rejected'} onClick={() => setTab('rejected')} />
        <StatCard icon={<Send className="w-4 h-4" />} label="Publicados" value={counts.published} tone="info" active={tab === 'published'} onClick={() => setTab('published')} />
      </div>

      <button
        onClick={() => setTab('all')}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all duration-200"
        style={{
          background: tab === 'all' ? 'var(--primary)' : 'var(--admin-accent-soft)',
          color: tab === 'all' ? 'var(--primary-foreground)' : 'var(--admin-fg-muted)',
          border: tab === 'all' ? '0.5px solid var(--primary)' : '0.5px solid var(--admin-border-strong)',
          fontSize: 11.5,
          fontWeight: tab === 'all' ? 700 : 500,
          letterSpacing: '-0.005em',
          boxShadow: tab === 'all' ? 'var(--admin-shadow)' : 'none',
        }}
      >
        Todos
        <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, opacity: 0.7 }}>({docs.length})</span>
      </button>

      {loading ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{
            background: 'var(--admin-panel-grad)',
            border: '0.5px solid var(--admin-border)',
          }}
        >
          <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--admin-fg-muted)' }} />
        </div>
      ) : groupedByClient.length === 0 ? (
        <div
          className="rounded-2xl py-16 text-center"
          style={{
            background: 'var(--admin-panel-grad)',
            border: '0.5px solid var(--admin-border)',
          }}
        >
          <Sparkles className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--admin-fg-subtle)' }} />
          <p style={{ fontSize: 13, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em' }}>
            {tab === 'pending_review' && 'SIN DOCUMENTOS PARA REVISAR'}
            {tab === 'approved' && 'SIN DOCUMENTOS APROBADOS PENDIENTES'}
            {tab === 'rejected' && 'SIN DOCUMENTOS RECHAZADOS'}
            {tab === 'published' && 'AÚN NADA PUBLICADO'}
            {tab === 'all' && 'EL EQUIPO AÚN NO HA SUBIDO DOCUMENTOS'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByClient.map(g => (
            <div
              key={g.client_id}
              className="relative rounded-2xl p-5 overflow-hidden"
              style={{
                background: 'var(--admin-panel-grad)',
                border: '0.5px solid var(--admin-border-strong)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '0.5px solid var(--admin-border)' }}>
                <User className="w-4 h-4" style={{ color: 'var(--admin-fg)' }} />
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>
                  {g.client ? `${g.client.first_name} ${g.client.last_name}` : 'Cliente sin nombre'}
                </p>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full"
                  style={{
                    background: 'var(--admin-accent-soft)',
                    border: '0.5px solid var(--admin-border-strong)',
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--admin-fg)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {g.case_number || '—'}
                </span>
                <span
                  className="ml-auto"
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 500,
                    letterSpacing: '0.15em',
                    color: 'var(--admin-fg-subtle)',
                  }}
                >
                  {g.docs.length} DOC{g.docs.length !== 1 ? 'S' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {g.docs.map(d => (
                  <DocRow
                    key={d.id}
                    doc={d}
                    acting={acting === d.id}
                    onPreview={() => openPreview(d)}
                    onApprove={() => approve(d)}
                    onReject={() => { setRejecting(d); setRejectComment('') }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewing && (
        <PreviewModal
          doc={previewing}
          url={previewUrl}
          onClose={() => { setPreviewing(null); setPreviewUrl(null) }}
        />
      )}

      {rejecting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
          onClick={() => { setRejecting(null); setRejectComment('') }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl p-6 space-y-3"
            style={{
              background: 'var(--admin-panel-grad)',
              border: '0.5px solid var(--admin-border-strong)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" style={{ color: 'var(--admin-red)' }} />
              <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.018em' }}>
                Rechazar documento
              </h3>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--admin-fg-muted)', lineHeight: 1.55 }}>
              Diana verá el motivo y podrá subir una versión corregida.
            </p>
            <textarea
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
              placeholder="Ej: faltan los nombres del padre ausente. Corregir y volver a enviar."
              rows={4}
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/30 resize-y"
              style={{
                background: 'var(--admin-accent-soft)',
                border: '0.5px solid var(--admin-border-strong)',
                color: 'var(--admin-fg)',
                fontSize: 13,
                letterSpacing: '-0.005em',
                minHeight: 100,
              }}
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => { setRejecting(null); setRejectComment('') }} className={BTN_GHOST}>
                Cancelar
              </button>
              <button onClick={reject} disabled={!rejectComment.trim() || acting === rejecting.id} className={BTN_DANGER_PRIMARY}>
                {acting === rejecting.id
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rechazando…</>
                  : <><XCircle className="w-3.5 h-3.5" /> Rechazar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// StatCard
// ════════════════════════════════════════════════════════════════════

type StatTone = 'warning' | 'success' | 'danger' | 'info'
const TONE_MAP: Record<StatTone, { bg: string; border: string; activeBorder: string; iconColor: string }> = {
  warning: { bg: 'var(--admin-gold-soft)', border: 'var(--admin-gold)', activeBorder: 'var(--admin-gold)', iconColor: 'var(--admin-gold)' },
  success: { bg: 'var(--admin-green-soft)',  border: 'var(--admin-green)',  activeBorder: 'var(--admin-green)', iconColor: 'var(--admin-green)' },
  danger:  { bg: 'var(--admin-red-soft)', border: 'var(--admin-red)', activeBorder: 'var(--admin-red)', iconColor: 'var(--admin-red)' },
  info:    { bg: 'var(--admin-blue-soft)', border: 'var(--admin-blue)', activeBorder: 'var(--admin-blue)', iconColor: 'var(--admin-blue)' },
}

function StatCard({
  icon, label, value, hint, tone, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: number
  hint?: string
  tone: StatTone
  active: boolean
  onClick: () => void
}) {
  const t = TONE_MAP[tone]
  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: active
          ? `linear-gradient(180deg, ${t.bg}, var(--admin-bg-elev))`
          : 'var(--admin-panel-grad)',
        border: active ? `0.5px solid ${t.activeBorder}` : `0.5px solid var(--admin-border-strong)`,
        boxShadow: active ? `0 0 24px ${t.bg}` : 'none',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg"
          style={{
            background: t.bg,
            border: `0.5px solid ${t.border}`,
            color: t.iconColor,
          }}
        >
          {icon}
        </span>
        <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-subtle)' }}>
          {label.toUpperCase()}
        </span>
      </div>
      <p style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--admin-fg)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {hint && (
        <p style={{ fontSize: 10, color: 'var(--admin-fg-subtle)', marginTop: 2, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
          {hint.toUpperCase()}
        </p>
      )}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════
// DocRow
// ════════════════════════════════════════════════════════════════════

const DOC_STATUS_STYLES = {
  pending_review: { bg: 'var(--admin-gold-soft)', border: 'var(--admin-gold)', text: 'var(--admin-gold-on)', dot: 'var(--admin-gold)', label: 'Esperando revisión' },
  approved:       { bg: 'var(--admin-green-soft)',  border: 'var(--admin-green)',  text: 'var(--admin-green-on)', dot: 'var(--admin-green)', label: 'Aprobado' },
  rejected:       { bg: 'var(--admin-red-soft)', border: 'var(--admin-red)', text: 'var(--admin-red-on)', dot: 'var(--admin-red)', label: 'Rechazado' },
  published:      { bg: 'var(--admin-blue-soft)', border: 'var(--admin-blue)', text: 'var(--admin-blue-on)', dot: 'var(--admin-blue)', label: 'Publicado' },
} as const

function DocRow({
  doc, acting, onPreview, onApprove, onReject,
}: {
  doc: DocumentRow
  acting: boolean
  onPreview: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const meta = DOC_STATUS_STYLES[doc.status]
  const uploaderName = doc.uploader ? `${doc.uploader.first_name} ${doc.uploader.last_name}` : 'Empleado'

  return (
    <div
      className="rounded-xl p-3.5 transition-colors"
      style={{
        background: 'var(--admin-veil-1)',
        border: '0.5px solid var(--admin-accent-soft)',
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }} className="truncate">
              {doc.file_name}
            </p>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
              style={{
                background: meta.bg,
                border: `0.5px solid ${meta.border}`,
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: meta.text,
              }}
            >
              <span className="rounded-full" style={{ width: 5, height: 5, background: meta.dot }} />
              {meta.label.toUpperCase()}
            </span>
            {doc.version > 1 && (
              <span
                style={{
                  background: 'var(--admin-accent-soft)',
                  border: '0.5px solid var(--admin-border-strong)',
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: 'var(--admin-fg-muted)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                V{doc.version}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--admin-fg-muted)' }}>
            {INTERNAL_CATEGORY_LABELS[doc.category] || doc.category} · {uploaderName}
            <span style={{ color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', fontSize: 10, marginLeft: 6, letterSpacing: '0.05em' }}>
              · {formatDistanceToNow(new Date(doc.created_at), { locale: es, addSuffix: true }).toUpperCase()}
            </span>
          </p>

          {doc.upload_notes && (
            <div
              className="mt-2 px-3 py-2 rounded-lg"
              style={{
                background: 'var(--admin-blue-soft)',
                border: '0.5px solid var(--admin-blue)',
              }}
            >
              <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--admin-blue-on)', marginBottom: 2 }}>
                NOTA
              </p>
              <p style={{ fontSize: 11.5, color: 'var(--admin-blue-on)', lineHeight: 1.5 }}>{doc.upload_notes}</p>
            </div>
          )}

          {doc.status === 'rejected' && doc.review_comment && (
            <div
              className="mt-2 px-3 py-2 rounded-lg"
              style={{
                background: 'var(--admin-red-soft)',
                border: '0.5px solid var(--admin-red)',
              }}
            >
              <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--admin-red-on)', marginBottom: 2 }}>
                MOTIVO
              </p>
              <p style={{ fontSize: 11.5, color: 'var(--admin-red-on)', lineHeight: 1.5 }}>{doc.review_comment}</p>
            </div>
          )}

          {doc.status === 'published' && doc.published_at && (
            <p style={{ fontSize: 11, color: 'var(--admin-blue-on)', marginTop: 6, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
              ENTREGADO · {uploaderName.toUpperCase()} · {format(new Date(doc.published_at), 'd MMM yyyy · HH:mm', { locale: es }).toUpperCase()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onPreview} className={BTN_GHOST}>
            <Eye className="w-3 h-3" /> Ver
          </button>
          {doc.status === 'pending_review' && (
            <>
              <button onClick={onApprove} disabled={acting} className={BTN_SUCCESS}>
                {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Aprobar
              </button>
              <button onClick={onReject} disabled={acting} className={BTN_DANGER}>
                <XCircle className="w-3 h-3" /> Rechazar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// PreviewModal
// ════════════════════════════════════════════════════════════════════

function PreviewModal({ doc, url, onClose }: { doc: DocumentRow; url: string | null; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        onClick={e => e.stopPropagation()}
        style={{ borderBottom: '0.5px solid var(--admin-border)' }}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-4">
          <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--admin-fg-muted)' }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }} className="truncate">
            {doc.file_name}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-fg)', border: '0.5px solid var(--admin-border-strong)' }}
        >
          ×
        </button>
      </div>
      <div className="flex-1 flex items-stretch justify-center p-4" onClick={e => e.stopPropagation()}>
        {url ? (
          <iframe src={url} className="w-full h-full rounded-xl bg-white" title={doc.file_name} />
        ) : (
          <div className="text-center" style={{ color: 'var(--admin-fg-muted)' }}>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p style={{ fontSize: 12, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em' }}>
              CARGANDO PREVIEW…
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

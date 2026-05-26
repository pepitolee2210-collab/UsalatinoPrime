'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Upload, Loader2, CheckCircle, XCircle, Clock, Send, RefreshCw, Eye,
  Trash2, FileText, AlertCircle, Sparkles, ArrowUp,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { UploadModal, INTERNAL_CATEGORY_LABELS } from '@/components/internal-docs/upload-modal'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

interface ClientOption {
  case_id: string
  client_id: string
  case_number: string
  client_name: string
  service_name: string | null
}

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
  parent_document_id: string | null
  created_at: string
  updated_at: string
  client?: { first_name: string; last_name: string }
  uploader?: { first_name: string; last_name: string }
  reviewer?: { first_name: string; last_name: string }
  case?: { case_number: string; service?: { name: string } | { name: string }[] | null }
}

type TabKey = 'pending_review' | 'approved' | 'rejected' | 'published' | 'all'

interface Props {
  currentUserId: string
}

// ─── Card base ─────────────────────────────────────────────────
function AdminCard({
  children, className = '',
}: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border)',
        boxShadow: 'var(--admin-shadow, 0 1px 3px rgba(11,31,58,0.04))',
      }}
    >
      {children}
    </div>
  )
}

function Pill({
  tone, children,
}: { tone: 'gold' | 'green' | 'red' | 'blue' | 'neutral'; children: React.ReactNode }) {
  const map = {
    gold:    { bg: 'var(--admin-gold-soft)',   text: 'var(--admin-gold)',   border: 'var(--admin-gold-border, var(--admin-gold))' },
    green:   { bg: 'var(--admin-green-soft)',  text: 'var(--admin-green)',  border: 'var(--admin-green)' },
    red:     { bg: 'var(--admin-red-soft)',    text: 'var(--admin-red)',    border: 'var(--admin-red)' },
    blue:    { bg: 'var(--admin-blue-soft)',   text: 'var(--admin-blue)',   border: 'var(--admin-blue)' },
    neutral: { bg: 'var(--admin-accent-soft)', text: 'var(--admin-fg-muted)', border: 'var(--admin-border-strong)' },
  }[tone]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
      style={{
        background: map.bg,
        color: map.text,
        border: `0.5px solid ${map.border}`,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  )
}

export function RevisionInternaClient({ currentUserId: _currentUserId }: Props) {
  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('pending_review')
  const [showUpload, setShowUpload] = useState(false)
  const [resubmitting, setResubmitting] = useState<DocumentRow | null>(null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [acting, setActing] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<DocumentRow | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/internal-documents/list?uploaded_by=me&limit=300')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error')
      setDocs(json.documents || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar documentos')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadClients = useCallback(async () => {
    try {
      const res = await fetch('/api/internal-documents/clients')
      const json = await res.json()
      if (res.ok) setClients(json.clients || [])
    } catch {}
  }, [])

  useEffect(() => {
    void load()
    void loadClients()
  }, [load, loadClients])

  // Polling cada 20s para ver si Henry aprobó/rechazó
  useEffect(() => {
    const id = setInterval(() => { void load() }, 20_000)
    return () => clearInterval(id)
  }, [load])

  const counts = useMemo(() => {
    const c = { pending_review: 0, approved: 0, rejected: 0, published: 0 }
    for (const d of docs) c[d.status]++
    return c
  }, [docs])

  const filtered = tab === 'all' ? docs : docs.filter(d => d.status === tab)

  async function publish(d: DocumentRow) {
    if (!confirm(`¿Publicar "${d.file_name}" al cliente? Esto lo enviará al portal de ${d.client?.first_name} ${d.client?.last_name}.`)) return
    setActing(d.id)
    try {
      const res = await fetch(`/api/internal-documents/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Error al publicar')
        return
      }
      toast.success('Documento publicado al cliente')
      await load()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setActing(null)
    }
  }

  async function remove(d: DocumentRow) {
    if (!confirm(`¿Eliminar "${d.file_name}"? Esta acción no se puede deshacer.`)) return
    setActing(d.id)
    try {
      const res = await fetch(`/api/internal-documents/${d.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error || 'Error al eliminar')
        return
      }
      toast.success('Documento eliminado')
      await load()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setActing(null)
    }
  }

  async function openPreview(d: DocumentRow) {
    setPreviewing(d)
    setPreviewUrl(null)
    try {
      const res = await fetch(`/api/internal-documents/${d.id}`)
      const json = await res.json()
      if (res.ok) setPreviewUrl(json.signed_url)
    } catch {}
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <AdminKeyframes />
      <PageHeader
        eyebrow="REVISIÓN INTERNA · QC"
        title="Revisión Interna"
        accentDot
        description="Sube documentos finales de cada cliente. Henry los aprueba o rechaza antes de que tú los entregues al cliente."
        telemetry={[
          { label: 'En revisión', value: counts.pending_review.toString() },
          { label: 'Aprobados', value: counts.approved.toString() },
          { label: 'Rechazados', value: counts.rejected.toString() },
        ]}
        action={
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full transition-opacity hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #F2C14E, var(--admin-gold))',
              color: 'var(--admin-accent)',
              border: '0.5px solid var(--admin-gold-border, rgba(255,255,255,0.2))',
              boxShadow: 'var(--admin-shadow-gold, 0 12px 28px rgba(216,155,29,0.28))',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            <Upload className="w-4 h-4" />
            Subir documento
          </button>
        }
      />

      {/* Stats / tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Clock className="w-4 h-4" style={{ color: 'var(--admin-gold)' }} />}
          label="En revisión"
          value={counts.pending_review}
          tone="gold"
          active={tab === 'pending_review'}
          onClick={() => setTab('pending_review')}
        />
        <StatCard
          icon={<CheckCircle className="w-4 h-4" style={{ color: 'var(--admin-green)' }} />}
          label="Aprobados"
          value={counts.approved}
          hint="listos para publicar"
          tone="green"
          active={tab === 'approved'}
          onClick={() => setTab('approved')}
        />
        <StatCard
          icon={<XCircle className="w-4 h-4" style={{ color: 'var(--admin-red)' }} />}
          label="Rechazados"
          value={counts.rejected}
          hint="por corregir"
          tone="red"
          active={tab === 'rejected'}
          onClick={() => setTab('rejected')}
        />
        <StatCard
          icon={<Send className="w-4 h-4" style={{ color: 'var(--admin-blue)' }} />}
          label="Publicados"
          value={counts.published}
          hint="entregados al cliente"
          tone="blue"
          active={tab === 'published'}
          onClick={() => setTab('published')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('all')}
          className="px-3 h-8 rounded-full transition-colors"
          style={
            tab === 'all'
              ? {
                  background: 'var(--admin-accent)',
                  color: 'var(--admin-bg-elev)',
                  border: '0.5px solid var(--admin-accent)',
                  fontSize: 12,
                  fontWeight: 600,
                }
              : {
                  background: 'var(--admin-bg-elev)',
                  color: 'var(--admin-fg-muted)',
                  border: '0.5px solid var(--admin-border)',
                  fontSize: 12,
                  fontWeight: 500,
                }
          }
        >
          Todos ({docs.length})
        </button>
        <button
          onClick={() => load()}
          className="inline-flex items-center gap-1 px-3 h-8 rounded-full transition-colors"
          style={{
            background: 'var(--admin-bg-elev)',
            color: 'var(--admin-fg-muted)',
            border: '0.5px solid var(--admin-border)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <RefreshCw className="w-3 h-3" /> Actualizar
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <AdminCard className="p-8">
          <div className="text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--admin-fg-subtle)' }} />
          </div>
        </AdminCard>
      ) : filtered.length === 0 ? (
        <AdminCard className="p-10">
          <div className="text-center">
            <Sparkles className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--admin-fg-faint)' }} />
            <p style={{ fontSize: 13, color: 'var(--admin-fg-subtle)' }}>
              {tab === 'pending_review' && 'No tienes documentos esperando revisión.'}
              {tab === 'approved' && 'No hay documentos aprobados pendientes de publicar.'}
              {tab === 'rejected' && '¡Sin rechazos!'}
              {tab === 'published' && 'Aún no has publicado documentos.'}
              {tab === 'all' && 'Aún no has subido documentos.'}
            </p>
          </div>
        </AdminCard>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
            <DocRow
              key={d.id}
              doc={d}
              acting={acting === d.id}
              onPreview={() => openPreview(d)}
              onPublish={() => publish(d)}
              onResubmit={() => setResubmitting(d)}
              onDelete={() => remove(d)}
            />
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          clients={clients}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); void load() }}
        />
      )}

      {/* Resubmit modal */}
      {resubmitting && (
        <UploadModal
          clients={clients}
          parentClient={{
            case_id: resubmitting.case_id,
            client_id: resubmitting.client_id,
            case_number: resubmitting.case?.case_number ?? '—',
            client_name: resubmitting.client ? `${resubmitting.client.first_name} ${resubmitting.client.last_name}` : 'Cliente',
            service_name: Array.isArray(resubmitting.case?.service) ? resubmitting.case?.service[0]?.name ?? null : resubmitting.case?.service?.name ?? null,
          }}
          parentDocumentId={resubmitting.id}
          onClose={() => setResubmitting(null)}
          onUploaded={() => { setResubmitting(null); void load() }}
        />
      )}

      {/* Preview */}
      {previewing && (
        <PreviewModal
          doc={previewing}
          url={previewUrl}
          onClose={() => { setPreviewing(null); setPreviewUrl(null) }}
        />
      )}
    </div>
  )
}

function StatCard({
  icon, label, value, hint, tone, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: number
  hint?: string
  tone: 'gold' | 'green' | 'red' | 'blue'
  active: boolean
  onClick: () => void
}) {
  const palette = {
    gold:  { bg: 'var(--admin-gold-soft)',  border: 'var(--admin-gold-border, var(--admin-gold))', ring: 'var(--admin-gold)' },
    green: { bg: 'var(--admin-green-soft)', border: 'var(--admin-green)',  ring: 'var(--admin-green)' },
    red:   { bg: 'var(--admin-red-soft)',   border: 'var(--admin-red)',    ring: 'var(--admin-red)' },
    blue:  { bg: 'var(--admin-blue-soft)',  border: 'var(--admin-blue)',   ring: 'var(--admin-blue)' },
  }[tone]
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl p-3 transition-all"
      style={{
        background: active ? palette.bg : 'var(--admin-panel-grad)',
        border: `0.5px solid ${active ? palette.ring : 'var(--admin-border)'}`,
        boxShadow: active ? `0 0 0 2px color-mix(in srgb, ${palette.ring} 25%, transparent)` : 'var(--admin-shadow, 0 1px 3px rgba(11,31,58,0.04))',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.16em',
          color: 'var(--admin-fg-subtle)',
          fontFamily: 'var(--font-mono-tech)',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--admin-fg)' }}>{value}</p>
      {hint && (
        <p style={{ fontSize: 10, color: 'var(--admin-fg-subtle)', marginTop: 2 }}>{hint}</p>
      )}
    </button>
  )
}

function DocRow({
  doc, acting, onPreview, onPublish, onResubmit, onDelete,
}: {
  doc: DocumentRow
  acting: boolean
  onPreview: () => void
  onPublish: () => void
  onResubmit: () => void
  onDelete: () => void
}) {
  const STATUS_META: Record<DocumentRow['status'], { label: string; tone: 'gold' | 'green' | 'red' | 'blue'; icon: typeof Clock }> = {
    pending_review: { label: 'En revisión', tone: 'gold', icon: Clock },
    approved:       { label: 'Aprobado',    tone: 'green', icon: CheckCircle },
    rejected:       { label: 'Rechazado',   tone: 'red', icon: XCircle },
    published:      { label: 'Publicado',   tone: 'blue', icon: Send },
  }
  const meta = STATUS_META[doc.status]
  const Icon = meta.icon
  const clientName = doc.client ? `${doc.client.first_name} ${doc.client.last_name}` : 'Cliente'

  return (
    <AdminCard className="p-4 transition-shadow hover:shadow-lg">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p
              className="truncate flex items-center gap-1.5"
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)' }}
            >
              <FileText className="w-3.5 h-3.5" style={{ color: 'var(--admin-fg-subtle)' }} />
              {doc.file_name}
            </p>
            <Pill tone={meta.tone}>
              <Icon className="w-3 h-3" />
              {meta.label}
            </Pill>
            {doc.version > 1 && <Pill tone="neutral">v{doc.version}</Pill>}
          </div>
          <p style={{ fontSize: 11, color: 'var(--admin-fg-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--admin-fg)' }}>{clientName}</span>
            {' · '}{doc.case?.case_number}
            {' · '}{INTERNAL_CATEGORY_LABELS[doc.category] || doc.category}
          </p>
          <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', marginTop: 2 }}>
            Subido {formatDistanceToNow(new Date(doc.created_at), { locale: es, addSuffix: true })}
            {doc.reviewed_at && ` · Revisado ${formatDistanceToNow(new Date(doc.reviewed_at), { locale: es, addSuffix: true })}`}
          </p>

          {doc.upload_notes && (
            <p
              className="rounded p-1.5 mt-1"
              style={{
                fontSize: 11,
                color: 'var(--admin-fg-muted)',
                background: 'var(--admin-bg-elev-2)',
                border: '0.5px solid var(--admin-border)',
              }}
            >
              Tu nota: {doc.upload_notes}
            </p>
          )}

          {doc.status === 'rejected' && doc.review_comment && (
            <div
              className="mt-2 rounded-lg p-2"
              style={{
                background: 'var(--admin-red-soft)',
                border: '0.5px solid var(--admin-red)',
              }}
            >
              <p
                className="flex items-center gap-1"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                  color: 'var(--admin-red)',
                  marginBottom: 2,
                  fontFamily: 'var(--font-mono-tech)',
                }}
              >
                <AlertCircle className="w-3 h-3" /> Motivo de rechazo
              </p>
              <p style={{ fontSize: 12, color: 'var(--admin-red)' }}>{doc.review_comment}</p>
            </div>
          )}

          {doc.status === 'approved' && (
            <p
              style={{
                fontSize: 11,
                color: 'var(--admin-green)',
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              ✅ Henry aprobó · Listo para publicar al cliente
            </p>
          )}

          {doc.status === 'published' && doc.published_at && (
            <p
              style={{
                fontSize: 11,
                color: 'var(--admin-blue)',
                marginTop: 4,
              }}
            >
              📤 Entregado al cliente el {format(new Date(doc.published_at), 'd MMM yyyy', { locale: es })}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={onPreview}
            className="h-7"
            style={{
              fontSize: 11,
              background: 'var(--admin-bg-elev)',
              color: 'var(--admin-blue)',
              border: '0.5px solid var(--admin-border-strong)',
            }}
          >
            <Eye className="w-3 h-3 mr-1" /> Ver
          </Button>

          {doc.status === 'approved' && (
            <Button
              size="sm"
              onClick={onPublish}
              disabled={acting}
              className="h-7"
              style={{
                fontSize: 11,
                background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
                color: '#FFFFFF',
                border: '0.5px solid rgba(255,255,255,0.2)',
                boxShadow: '0 8px 20px rgba(30,78,154,0.20)',
                fontWeight: 600,
              }}
            >
              {acting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
              Publicar
            </Button>
          )}

          {doc.status === 'rejected' && (
            <Button
              size="sm"
              onClick={onResubmit}
              className="h-7"
              style={{
                fontSize: 11,
                background: 'linear-gradient(135deg, #F2C14E, var(--admin-gold))',
                color: 'var(--admin-accent)',
                boxShadow: 'var(--admin-shadow-gold, 0 8px 20px rgba(216,155,29,0.22))',
                fontWeight: 700,
                border: '0.5px solid var(--admin-gold-border, var(--admin-gold))',
              }}
            >
              <ArrowUp className="w-3 h-3 mr-1" /> Subir corrección
            </Button>
          )}

          {(doc.status === 'pending_review' || doc.status === 'rejected') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              disabled={acting}
              className="h-7"
              style={{
                fontSize: 11,
                color: 'var(--admin-red)',
                background: 'transparent',
              }}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Eliminar
            </Button>
          )}
        </div>
      </div>
    </AdminCard>
  )
}

function PreviewModal({ doc, url, onClose }: { doc: DocumentRow; url: string | null; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <p
          className="truncate flex-1 mr-4"
          style={{ color: '#FFFFFF', fontWeight: 600, fontSize: 13 }}
        >
          {doc.file_name}
        </p>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          <span style={{ color: '#FFFFFF' }}>×</span>
        </button>
      </div>
      <div className="flex-1 flex items-stretch justify-center px-4 pb-4" onClick={e => e.stopPropagation()}>
        {url ? (
          <iframe src={url} className="w-full h-full rounded-xl" style={{ background: '#FFFFFF' }} title={doc.file_name} />
        ) : (
          <div style={{ color: '#FFFFFF', textAlign: 'center' }}>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p style={{ fontSize: 13 }}>Cargando preview…</p>
          </div>
        )}
      </div>
    </div>
  )
}

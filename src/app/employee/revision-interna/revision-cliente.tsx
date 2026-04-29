'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  Upload, Loader2, CheckCircle, XCircle, Clock, Send, RefreshCw, Eye,
  Trash2, FileText, AlertCircle, Sparkles, ArrowUp,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { UploadModal, INTERNAL_CATEGORY_LABELS } from '@/components/internal-docs/upload-modal'

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

export function RevisionInternaClient({ currentUserId }: Props) {
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#002855]" />
            Revisión Interna
          </h1>
          <p className="text-sm text-gray-500">
            Sube documentos finales de cada cliente. Henry los aprueba o rechaza antes de que tú los entregues al cliente.
          </p>
        </div>
        <Button
          onClick={() => setShowUpload(true)}
          className="bg-[#F2A900] hover:bg-[#D4940A] text-white"
        >
          <Upload className="w-4 h-4 mr-1.5" />
          Subir documento
        </Button>
      </div>

      {/* Stats / tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          label="En revisión"
          value={counts.pending_review}
          accent="amber"
          active={tab === 'pending_review'}
          onClick={() => setTab('pending_review')}
        />
        <StatCard
          icon={<CheckCircle className="w-4 h-4 text-emerald-600" />}
          label="Aprobados"
          value={counts.approved}
          hint="listos para publicar"
          accent="emerald"
          active={tab === 'approved'}
          onClick={() => setTab('approved')}
        />
        <StatCard
          icon={<XCircle className="w-4 h-4 text-red-600" />}
          label="Rechazados"
          value={counts.rejected}
          hint="por corregir"
          accent="red"
          active={tab === 'rejected'}
          onClick={() => setTab('rejected')}
        />
        <StatCard
          icon={<Send className="w-4 h-4 text-blue-600" />}
          label="Publicados"
          value={counts.published}
          hint="entregados al cliente"
          accent="blue"
          active={tab === 'published'}
          onClick={() => setTab('published')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={tab === 'all' ? 'default' : 'outline'} onClick={() => setTab('all')}>
          Todos ({docs.length})
        </Button>
        <Button size="sm" variant="outline" onClick={() => load()}>
          <RefreshCw className="w-3 h-3 mr-1" /> Actualizar
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <Card><CardContent className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Sparkles className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              {tab === 'pending_review' && 'No tienes documentos esperando revisión.'}
              {tab === 'approved' && 'No hay documentos aprobados pendientes de publicar.'}
              {tab === 'rejected' && '¡Sin rechazos!'}
              {tab === 'published' && 'Aún no has publicado documentos.'}
              {tab === 'all' && 'Aún no has subido documentos.'}
            </p>
          </CardContent>
        </Card>
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
  icon, label, value, hint, accent, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: number
  hint?: string
  accent: 'amber' | 'emerald' | 'red' | 'blue'
  active: boolean
  onClick: () => void
}) {
  const accentClass = {
    amber: active ? 'border-amber-400 ring-2 ring-amber-300/50 bg-amber-50' : 'border-amber-100 bg-amber-50/30 hover:border-amber-200',
    emerald: active ? 'border-emerald-400 ring-2 ring-emerald-300/50 bg-emerald-50' : 'border-emerald-100 bg-emerald-50/30 hover:border-emerald-200',
    red: active ? 'border-red-400 ring-2 ring-red-300/50 bg-red-50' : 'border-red-100 bg-red-50/30 hover:border-red-200',
    blue: active ? 'border-blue-400 ring-2 ring-blue-300/50 bg-blue-50' : 'border-blue-100 bg-blue-50/30 hover:border-blue-200',
  }[accent]
  return (
    <button onClick={onClick} className={`text-left rounded-xl border ${accentClass} p-3 transition-all`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-medium text-gray-700">{label}</span></div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>}
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
  const STATUS_META = {
    pending_review: { label: 'En revisión', color: 'bg-amber-100 text-amber-800', icon: Clock },
    approved: { label: 'Aprobado', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
    rejected: { label: 'Rechazado', color: 'bg-red-100 text-red-800', icon: XCircle },
    published: { label: 'Publicado', color: 'bg-blue-100 text-blue-800', icon: Send },
  }
  const meta = STATUS_META[doc.status]
  const Icon = meta.icon
  const clientName = doc.client ? `${doc.client.first_name} ${doc.client.last_name}` : 'Cliente'

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{doc.file_name}</p>
              <Badge className={meta.color}>
                <Icon className="w-3 h-3 mr-1" /> {meta.label}
              </Badge>
              {doc.version > 1 && (
                <Badge className="bg-gray-100 text-gray-700">v{doc.version}</Badge>
              )}
            </div>
            <p className="text-[11px] text-gray-600">
              <span className="font-medium">{clientName}</span> · {doc.case?.case_number} · {INTERNAL_CATEGORY_LABELS[doc.category] || doc.category}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Subido {formatDistanceToNow(new Date(doc.created_at), { locale: es, addSuffix: true })}
              {doc.reviewed_at && ` · Revisado ${formatDistanceToNow(new Date(doc.reviewed_at), { locale: es, addSuffix: true })}`}
            </p>

            {doc.upload_notes && (
              <p className="text-[11px] text-gray-600 mt-1 bg-gray-50 rounded p-1.5">
                Tu nota: {doc.upload_notes}
              </p>
            )}

            {doc.status === 'rejected' && doc.review_comment && (
              <div className="mt-2 rounded-lg bg-red-50 border border-red-200 p-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-700 mb-0.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Motivo de rechazo
                </p>
                <p className="text-xs text-red-900">{doc.review_comment}</p>
              </div>
            )}

            {doc.status === 'approved' && (
              <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                ✅ Henry aprobó · Listo para publicar al cliente
              </p>
            )}

            {doc.status === 'published' && doc.published_at && (
              <p className="text-[11px] text-blue-700 mt-1">
                📤 Entregado al cliente el {format(new Date(doc.published_at), "d MMM yyyy", { locale: es })}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={onPreview} className="h-7 text-[11px]">
              <Eye className="w-3 h-3 mr-1" /> Ver
            </Button>

            {doc.status === 'approved' && (
              <Button
                size="sm"
                onClick={onPublish}
                disabled={acting}
                className="h-7 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
              >
                {acting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                Publicar
              </Button>
            )}

            {doc.status === 'rejected' && (
              <Button
                size="sm"
                onClick={onResubmit}
                className="h-7 text-[11px] bg-[#F2A900] hover:bg-[#D4940A] text-white"
              >
                <ArrowUp className="w-3 h-3 mr-1" /> Subir corrección
              </Button>
            )}

            {(doc.status === 'pending_review' || doc.status === 'rejected') && (
              <Button size="sm" variant="ghost" onClick={onDelete} disabled={acting} className="h-7 text-[11px] text-red-600 hover:bg-red-50">
                <Trash2 className="w-3 h-3 mr-1" /> Eliminar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PreviewModal({ doc, url, onClose }: { doc: DocumentRow; url: string | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <p className="text-white font-semibold text-sm truncate flex-1 mr-4">{doc.file_name}</p>
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <span className="text-white">×</span>
        </button>
      </div>
      <div className="flex-1 flex items-stretch justify-center px-4 pb-4" onClick={e => e.stopPropagation()}>
        {url ? (
          <iframe src={url} className="w-full h-full rounded-xl bg-white" title={doc.file_name} />
        ) : (
          <div className="text-white text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-sm">Cargando preview…</p>
          </div>
        )}
      </div>
    </div>
  )
}

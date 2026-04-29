'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  Loader2, CheckCircle, XCircle, Clock, Send, RefreshCw, Eye, FileText,
  AlertCircle, Sparkles, User,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { INTERNAL_CATEGORY_LABELS } from '@/components/internal-docs/upload-modal'

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
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#002855]" />
            Revisión Interna
          </h1>
          <p className="text-sm text-gray-500">
            Documentos que el equipo (Diana, Andrium) sube para tu aprobación antes de entregarlos al cliente.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => load()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Clock className="w-4 h-4 text-amber-600" />} label="Esperando revisión" value={counts.pending_review} accent="amber" active={tab === 'pending_review'} onClick={() => setTab('pending_review')} />
        <StatCard icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} label="Aprobados" value={counts.approved} hint="esperando publicar" accent="emerald" active={tab === 'approved'} onClick={() => setTab('approved')} />
        <StatCard icon={<XCircle className="w-4 h-4 text-red-600" />} label="Rechazados" value={counts.rejected} accent="red" active={tab === 'rejected'} onClick={() => setTab('rejected')} />
        <StatCard icon={<Send className="w-4 h-4 text-blue-600" />} label="Publicados" value={counts.published} accent="blue" active={tab === 'published'} onClick={() => setTab('published')} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={tab === 'all' ? 'default' : 'outline'} onClick={() => setTab('all')}>
          Todos ({docs.length})
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></CardContent></Card>
      ) : groupedByClient.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Sparkles className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              {tab === 'pending_review' && 'Sin documentos esperando tu revisión 🎉'}
              {tab === 'approved' && 'Sin documentos aprobados pendientes de publicar.'}
              {tab === 'rejected' && 'Sin documentos rechazados.'}
              {tab === 'published' && 'Aún nada publicado.'}
              {tab === 'all' && 'El equipo aún no ha subido documentos.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedByClient.map(g => (
            <Card key={g.client_id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                  <User className="w-4 h-4 text-[#002855]" />
                  <p className="text-sm font-bold text-gray-900">
                    {g.client ? `${g.client.first_name} ${g.client.last_name}` : 'Cliente sin nombre'}
                  </p>
                  <Badge className="bg-gray-100 text-gray-700">{g.case_number || '—'}</Badge>
                  <span className="text-[11px] text-gray-400 ml-auto">{g.docs.length} documento{g.docs.length !== 1 ? 's' : ''}</span>
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
              </CardContent>
            </Card>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-bold text-gray-900">Rechazar documento</h3>
              </div>
              <p className="text-sm text-gray-600">
                Diana verá el motivo y podrá subir una versión corregida.
              </p>
              <textarea
                value={rejectComment}
                onChange={e => setRejectComment(e.target.value)}
                placeholder="Ej: faltan los nombres del padre ausente. Corregir y volver a enviar."
                rows={4}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => { setRejecting(null); setRejectComment('') }}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={reject}
                  disabled={!rejectComment.trim() || acting === rejecting.id}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {acting === rejecting.id
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Rechazando…</>
                    : <><XCircle className="w-3.5 h-3.5 mr-1" /> Rechazar</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
  doc, acting, onPreview, onApprove, onReject,
}: {
  doc: DocumentRow
  acting: boolean
  onPreview: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const STATUS_META = {
    pending_review: { label: 'Esperando revisión', color: 'bg-amber-100 text-amber-800', icon: Clock },
    approved: { label: 'Aprobado', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
    rejected: { label: 'Rechazado', color: 'bg-red-100 text-red-800', icon: XCircle },
    published: { label: 'Publicado al cliente', color: 'bg-blue-100 text-blue-800', icon: Send },
  }
  const meta = STATUS_META[doc.status]
  const Icon = meta.icon
  const uploaderName = doc.uploader ? `${doc.uploader.first_name} ${doc.uploader.last_name}` : 'Empleado'

  return (
    <div className="rounded-lg border border-gray-100 hover:border-gray-200 p-3 transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-semibold text-gray-900 truncate">{doc.file_name}</p>
            <Badge className={meta.color}>
              <Icon className="w-3 h-3 mr-1" /> {meta.label}
            </Badge>
            {doc.version > 1 && <Badge className="bg-gray-100 text-gray-700">v{doc.version}</Badge>}
          </div>
          <p className="text-[11px] text-gray-600">
            {INTERNAL_CATEGORY_LABELS[doc.category] || doc.category} · subido por {uploaderName} {formatDistanceToNow(new Date(doc.created_at), { locale: es, addSuffix: true })}
          </p>

          {doc.upload_notes && (
            <p className="text-[11px] text-gray-700 mt-1 bg-blue-50 border border-blue-100 rounded p-1.5">
              <span className="font-semibold">Nota: </span>{doc.upload_notes}
            </p>
          )}

          {doc.status === 'rejected' && doc.review_comment && (
            <p className="text-[11px] text-red-700 mt-1 bg-red-50 border border-red-100 rounded p-1.5">
              <span className="font-semibold">Tu motivo: </span>{doc.review_comment}
            </p>
          )}

          {doc.status === 'published' && doc.published_at && (
            <p className="text-[11px] text-blue-700 mt-1">
              📤 {uploaderName} lo entregó el {format(new Date(doc.published_at), "d MMM yyyy, HH:mm", { locale: es })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={onPreview} className="h-7 text-[11px]">
            <Eye className="w-3 h-3 mr-1" /> Ver
          </Button>
          {doc.status === 'pending_review' && (
            <>
              <Button
                size="sm"
                onClick={onApprove}
                disabled={acting}
                className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {acting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                Aprobar
              </Button>
              <Button
                size="sm"
                onClick={onReject}
                disabled={acting}
                variant="outline"
                className="h-7 text-[11px] text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-3 h-3 mr-1" /> Rechazar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
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

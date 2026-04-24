'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  FileText, FileSignature, Loader2, Pencil, Download, CheckCircle,
  AlertCircle, Clock, RefreshCw, Sparkles,
} from 'lucide-react'
import type { DetectedField } from '@/lib/legal/acroform-service'
import { FormEditorModal } from './form-editor-modal'

interface FormInstance {
  id: string
  case_id: string
  packet_type: 'intake' | 'merits'
  form_name: string
  form_url_official: string
  form_description_es: string | null
  is_mandatory: boolean
  acroform_schema: DetectedField[] | null
  schema_source: 'pending' | 'acroform' | 'ocr_gemini' | 'failed'
  schema_error: string | null
  filled_values: Record<string, unknown> | null
  filled_at: string | null
  filled_pdf_path: string | null
  status: 'pending' | 'detecting' | 'ready' | 'partial' | 'complete' | 'downloaded' | 'failed'
}

interface ListResponse {
  intake: FormInstance[]
  merits: FormInstance[]
  total: number
  pending: number
}

interface Props {
  caseId: string
}

export function CaseFormsSection({ caseId }: Props) {
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [editing, setEditing] = useState<FormInstance | null>(null)

  const load = useCallback(async (silent: boolean = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/admin/case-forms/list?caseId=${encodeURIComponent(caseId)}`)
      if (!res.ok) throw new Error()
      const json = (await res.json()) as ListResponse
      setData(json)
    } catch {
      if (!silent) toast.error('Error al cargar formularios')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [caseId])

  useEffect(() => { void load() }, [load])

  // Polling mientras haya schemas pending
  useEffect(() => {
    if (!data || data.pending === 0) return
    const id = setInterval(() => { void load(true) }, 5000)
    return () => clearInterval(id)
  }, [data, load])

  async function initialize() {
    setInitializing(true)
    try {
      const res = await fetch('/api/admin/case-forms/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'No se pudo inicializar')
        return
      }
      toast.success(`${json.created ?? 0} formularios en proceso de análisis`)
      await load()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setInitializing(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
      </div>
    )
  }

  const noData = !data || (data.intake.length === 0 && data.merits.length === 0)

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-[#002855]" />
            <div>
              <h3 className="text-sm font-bold text-gray-900">Formularios del caso</h3>
              <p className="text-[11px] text-gray-500">
                Documentos oficiales que el cliente debe llenar. La IA detecta campos y sugiere valores relevantes para SIJS.
              </p>
            </div>
          </div>
          {noData && (
            <Button size="sm" onClick={initialize} disabled={initializing} className="bg-[#F2A900] hover:bg-[#D4940A] text-white">
              {initializing
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Iniciando…</>
                : <><Sparkles className="w-3.5 h-3.5 mr-1" /> Generar formularios</>}
            </Button>
          )}
          {!noData && (
            <Button size="sm" variant="outline" onClick={() => load()} className="text-[11px] h-7">
              <RefreshCw className="w-3 h-3 mr-1" /> Actualizar
            </Button>
          )}
        </div>

        {noData ? (
          <div className="p-6 text-center">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-1">No hay formularios inicializados.</p>
            <p className="text-[11px] text-gray-400">
              Se crean a partir de la jurisdicción investigada. Se generarán automáticamente al crear contratos nuevos, o usa el botón de arriba.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-5">
            <PacketGroup
              title="Radicación de la presentación"
              subtitle="Etapa 1 — formularios administrativos para abrir el caso"
              accent="violet"
              instances={data.intake}
              onEdit={setEditing}
              onRefresh={() => load()}
            />
            <PacketGroup
              title="Radicación del procedimiento del caso"
              subtitle="Etapa 2 — documentos sustantivos que evalúa el juez"
              accent="amber"
              instances={data.merits}
              onEdit={setEditing}
              onRefresh={() => load()}
            />
          </div>
        )}
      </div>

      {editing && (
        <FormEditorModal
          instance={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { void load(); setEditing(null) }}
        />
      )}
    </>
  )
}

function PacketGroup({
  title, subtitle, accent, instances, onEdit, onRefresh,
}: {
  title: string
  subtitle: string
  accent: 'violet' | 'amber'
  instances: FormInstance[]
  onEdit: (f: FormInstance) => void
  onRefresh: () => void
}) {
  const accentBorder = accent === 'violet' ? 'border-l-violet-400' : 'border-l-amber-400'
  const titleColor = accent === 'violet' ? 'text-violet-900' : 'text-amber-900'

  return (
    <section className={`rounded-lg bg-gray-50/60 pl-4 pr-3 py-3 border-l-4 ${accentBorder}`}>
      <div className="mb-2">
        <p className={`text-xs font-bold uppercase tracking-wider ${titleColor}`}>{title}</p>
        <p className="text-[11px] text-gray-500">{subtitle}</p>
      </div>

      {instances.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">
          Sin formularios identificados en fuentes oficiales.
        </p>
      ) : (
        <div className="space-y-2">
          {instances.map(f => <FormRow key={f.id} instance={f} onEdit={onEdit} onRefresh={onRefresh} />)}
        </div>
      )}
    </section>
  )
}

function FormRow({
  instance, onEdit, onRefresh,
}: {
  instance: FormInstance
  onEdit: (f: FormInstance) => void
  onRefresh: () => void
}) {
  const schema = (instance.acroform_schema ?? []) as DetectedField[]
  const filled = instance.filled_values ?? {}
  const relevantFields = schema.filter(f => f.sijs_relevant !== false)
  const filledCount = relevantFields.filter(f => {
    const v = filled[f.name]
    return v !== undefined && v !== null && v !== '' && v !== false
  }).length

  const statusMeta = (() => {
    switch (instance.status) {
      case 'detecting':
        return { icon: Loader2, spin: true, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', label: 'Analizando…' }
      case 'ready':
        return { icon: FileText, color: 'text-gray-500', bg: 'bg-white border-gray-200', label: `0 de ${relevantFields.length}` }
      case 'partial':
        return { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: `${filledCount} de ${relevantFields.length}` }
      case 'complete':
        return { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Completo' }
      case 'downloaded':
        return { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Descargado' }
      case 'failed':
        return { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Error' }
      default:
        return { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200', label: 'En cola' }
    }
  })()
  const StatusIcon = statusMeta.icon

  const canEdit = instance.status === 'ready' || instance.status === 'partial' || instance.status === 'complete' || instance.status === 'downloaded'
  const canDownload = filledCount > 0 && (instance.schema_source === 'acroform' || instance.schema_source === 'ocr_gemini')

  return (
    <div className={`rounded-lg border ${statusMeta.bg} p-3`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-semibold text-gray-900 truncate">{instance.form_name}</p>
            {instance.is_mandatory && (
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Obligatorio</span>
            )}
            {instance.schema_source === 'ocr_gemini' && (
              <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium" title="Schema detectado con Gemini Vision (PDF sin AcroForm nativo)">
                OCR
              </span>
            )}
          </div>
          {instance.form_description_es && (
            <p className="text-[11px] text-gray-600">{instance.form_description_es}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <StatusIcon className={`w-3 h-3 ${statusMeta.color} ${statusMeta.spin ? 'animate-spin' : ''}`} />
            <span className={`text-[11px] font-medium ${statusMeta.color}`}>{statusMeta.label}</span>
            {instance.status === 'failed' && instance.schema_error && (
              <span className="text-[10px] text-red-600 font-mono truncate" title={instance.schema_error}>
                {instance.schema_error.slice(0, 60)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <a
            href={instance.form_url_official}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-blue-600 hover:underline px-2 py-1"
          >
            Ver oficial
          </a>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => onEdit(instance)} className="h-7 text-[11px]">
              <Pencil className="w-3 h-3 mr-1" /> Llenar
            </Button>
          )}
          {canDownload && (
            <Button
              size="sm"
              onClick={() => {
                window.open(`/api/admin/case-forms/${instance.id}/download`, '_blank')
                setTimeout(() => onRefresh(), 1000)
              }}
              className="h-7 text-[11px] bg-[#002855] hover:bg-[#001d3d] text-white"
            >
              <Download className="w-3 h-3 mr-1" /> PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

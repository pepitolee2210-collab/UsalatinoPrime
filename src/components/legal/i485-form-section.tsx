'use client'

// Sección especializada para visualizar/editar/imprimir el USCIS Form I-485.
// Compartida entre admin (`/admin/cases/[id]`) y employee (`/employee/cases/[id]`).
//
// Reutiliza:
// - `AutomatedFormModal` (autosave 250ms + optimistic concurrency + Imprimir interno)
// - `FormClientStatus` (progreso del cliente + lock/unlock)
// - endpoint `/api/admin/case-forms/uscis-i-485/print` (genera PDF rellenado y aplanado)

import { useCallback, useEffect, useState } from 'react'
import { FileText, Pencil, Printer, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { AutomatedFormModal } from '@/app/admin/cases/[id]/automated-form-modal'
import { FormClientStatus } from '@/app/admin/cases/[id]/form-client-status'

const I485_SLUG = 'uscis-i-485'

interface Props {
  caseId: string
}

interface FormMetaEntry {
  slug: string
  form_name: string
  total_user_fields: number
  filled_user_fields: number
  client_last_edit_at: string | null
  client_submitted_at: string | null
  locked_for_client: boolean
  status: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Sin iniciar', color: 'bg-gray-100 text-gray-700' },
  partial: { label: 'En progreso', color: 'bg-yellow-100 text-yellow-800' },
  ready: { label: 'Listo', color: 'bg-emerald-100 text-emerald-800' },
  complete: { label: 'Completo', color: 'bg-emerald-100 text-emerald-800' },
  downloaded: { label: 'PDF generado', color: 'bg-blue-100 text-blue-800' },
  needs_correction: { label: 'Necesita correcciones', color: 'bg-red-100 text-red-800' },
  failed: { label: 'Falló', color: 'bg-red-100 text-red-800' },
}

export function I485FormSection({ caseId }: Props) {
  const router = useRouter()
  const [meta, setMeta] = useState<FormMetaEntry | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/forms-meta`, { cache: 'no-store' })
      if (!res.ok) throw new Error('No se pudo cargar')
      const json = await res.json()
      const found = (json.meta as FormMetaEntry[] | undefined)?.find((m) => m.slug === I485_SLUG)
      setMeta(found ?? null)
    } catch {
      setMeta(null)
    } finally {
      setLoadingMeta(false)
    }
  }, [caseId])

  useEffect(() => { void loadMeta() }, [loadMeta, refreshKey])

  function handleModalChange(open: boolean) {
    setModalOpen(open)
    if (!open) {
      // Refresh meta al cerrar — los valores guardados pudieron cambiar.
      setRefreshKey((k) => k + 1)
    }
  }

  async function handlePrint() {
    setPrinting(true)
    try {
      const res = await fetch(`/api/admin/case-forms/${encodeURIComponent(I485_SLUG)}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.message || err.error || 'Error al generar PDF')
        return
      }
      const blob = await res.blob()
      const filename =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `${I485_SLUG}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF generado y archivado en Documentos del caso')
      setRefreshKey((k) => k + 1)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al imprimir')
    } finally {
      setPrinting(false)
    }
  }

  const status = meta?.status ?? 'pending'
  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.pending
  const pct = meta && meta.total_user_fields > 0
    ? Math.round((meta.filled_user_fields / meta.total_user_fields) * 100)
    : 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3">
        <FileText className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-bold text-emerald-800 uppercase">Fase 3 — I-485 (Ajuste de Estatus)</p>
          <p className="text-[12px] text-emerald-700 mt-0.5">
            Solicitud para Registrar Residencia Permanente o Ajustar Estatus (USCIS).
            El cliente llena las preguntas en su portal (Fases) y aquí Diana o Henry pueden completarlas, editarlas e imprimir el PDF oficial autorrellenado.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              USCIS Form I-485
            </h3>
            <p className="text-[12px] text-gray-600 mt-0.5">
              Solicitud para Registrar Residencia Permanente o Ajustar Estatus.
            </p>
          </div>
          <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${statusInfo.color}`}>
            {loadingMeta ? <Loader2 className="w-3 h-3 animate-spin inline-block" /> : statusInfo.label}
          </span>
        </div>

        {/* Progreso */}
        {meta && meta.total_user_fields > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-gray-600">Progreso del cliente</span>
              <span className="font-bold tabular-nums text-gray-800">
                {meta.filled_user_fields} de {meta.total_user_fields} campos · {pct}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Status del cliente + lock/unlock */}
        <FormClientStatus caseId={caseId} slug={I485_SLUG} refreshKey={refreshKey} />

        {/* Banner de submitted */}
        {meta?.client_submitted_at && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2">
            <CheckCircle className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-900">
              <p className="font-semibold">El cliente envió este formulario a revisión.</p>
              <p>Revisa todos los campos antes de imprimir el PDF oficial. Puedes seguir editando.</p>
            </div>
          </div>
        )}

        {/* Banner si necesita correcciones */}
        {status === 'needs_correction' && (
          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2">
            <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-900">
              <strong>Necesita correcciones.</strong> Edita el formulario y avisa al cliente.
            </p>
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={() => setModalOpen(true)}
            className="text-xs"
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Editar formulario
          </Button>
          <Button
            onClick={handlePrint}
            disabled={printing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            {printing ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Generando PDF…</>
            ) : (
              <><Printer className="w-3.5 h-3.5 mr-1.5" /> Imprimir oficial</>
            )}
          </Button>
        </div>
      </div>

      {/* Info legal interna */}
      <div className="text-[10px] text-gray-400 flex items-center gap-2">
        <Clock className="w-3 h-3" />
        Schema USCIS I-485 versión 2026-05 · Edición simultánea con last-write-wins · Diana y Henry pueden editar todos los campos
      </div>

      {modalOpen && (
        <AutomatedFormModal
          caseId={caseId}
          slug={I485_SLUG}
          open={true}
          onOpenChange={handleModalChange}
        />
      )}
    </div>
  )
}

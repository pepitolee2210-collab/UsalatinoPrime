'use client'

import { useState } from 'react'
import { FileText, CheckCircle2, Clock, Download, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { FormInstance } from './phase-types'

interface PhaseFormsListProps {
  forms: FormInstance[]
  caseId: string
  /** Callback opcional para refrescar la vista del padre cuando se descarga un PDF. */
  onPdfGenerated?: () => void
  /** Callback opcional para abrir el editor del formulario (`AutomatedFormModal`).
   *  Si se pasa, aparece un botón "Editar" junto a "Generar PDF" para forms con slug. */
  onEdit?: (slug: string) => void
  emptyMessage?: string
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

/**
 * Detona el endpoint /api/admin/case-forms/[slug]/print, descarga el blob
 * resultante en el browser, y refresca la vista para que el PDF aparezca
 * en la pestaña "Documentos Oficiales".
 */
async function generateAndDownloadPdf(slug: string, formName: string, caseId: string): Promise<void> {
  const res = await fetch(`/api/admin/case-forms/${encodeURIComponent(slug)}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (res.status === 400 && err.missingFields?.length) {
      throw new Error(
        `Faltan campos obligatorios en ${formName}: ${err.missingFields.slice(0, 5).join(', ')}${err.missingFields.length > 5 ? '…' : ''}`,
      )
    }
    throw new Error(err.error || err.message || `Error ${res.status}`)
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const m = /filename="([^"]+)"/.exec(cd)
  const filename = m?.[1] ?? `${slug}.pdf`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function PhaseFormsList({ forms, caseId, onPdfGenerated, onEdit, emptyMessage }: PhaseFormsListProps) {
  const [generatingSlug, setGeneratingSlug] = useState<string | null>(null)

  if (forms.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-4">{emptyMessage ?? 'No hay formularios oficiales en esta fase.'}</p>
    )
  }

  async function handleGenerate(slug: string, formName: string) {
    setGeneratingSlug(slug)
    try {
      await generateAndDownloadPdf(slug, formName, caseId)
      toast.success(`PDF de ${formName} generado y descargado`)
      onPdfGenerated?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar el PDF')
    } finally {
      setGeneratingSlug(null)
    }
  }

  return (
    <ul className="space-y-2">
      {forms.map(f => {
        const submitted = f.client_submitted_at != null
        const stateLabel = submitted ? 'Enviado' : f.client_last_edit_at ? 'En progreso' : 'Sin iniciar'
        const stateClass = submitted
          ? 'bg-emerald-100 text-emerald-700'
          : f.client_last_edit_at
          ? 'bg-amber-100 text-amber-700'
          : 'bg-gray-100 text-gray-500'
        const StateIcon = submitted ? CheckCircle2 : Clock
        const isAutomated = !!f.slug
        const isGenerating = generatingSlug === f.slug

        return (
          <li
            key={f.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white"
          >
            <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-blue-700" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{f.form_name}</p>
              <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${stateClass}`}>
                  <StateIcon className="w-3 h-3" />
                  {stateLabel}
                </span>
                <span>·</span>
                <span>{f.total_filled_keys} campos</span>
                {submitted && (
                  <>
                    <span>·</span>
                    <span>{formatDate(f.client_submitted_at)}</span>
                  </>
                )}
                {f.filled_pdf_generated_at && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-700">PDF: {formatDate(f.filled_pdf_generated_at)}</span>
                  </>
                )}
              </div>
            </div>
            {isAutomated && f.slug && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(f.slug as string)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                title={`Edita los campos de ${f.form_name} desde aquí — la firma puede llenar/corregir sin entrar al portal del cliente.`}
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </button>
            )}
            {isAutomated && f.slug && (
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => handleGenerate(f.slug as string, f.form_name)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                title={`Genera el PDF oficial de ${f.form_name} con los datos del cliente y lo descarga.`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generando…
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Generar PDF
                  </>
                )}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

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
      <p
        className="text-center py-4"
        style={{ fontSize: 12, color: 'var(--admin-fg-subtle)' }}
      >
        {emptyMessage ?? 'No hay formularios oficiales en esta fase.'}
      </p>
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
        const stateStyle = submitted
          ? { bg: 'var(--admin-green-soft)', text: 'var(--admin-green)', border: 'var(--admin-green)' }
          : f.client_last_edit_at
          ? { bg: 'var(--admin-gold-soft)', text: 'var(--admin-gold)', border: 'var(--admin-gold-border, var(--admin-gold))' }
          : { bg: 'var(--admin-bg-elev-2)', text: 'var(--admin-fg-muted)', border: 'var(--admin-border-strong)' }
        const StateIcon = submitted ? CheckCircle2 : Clock
        const isAutomated = !!f.slug
        const isGenerating = generatingSlug === f.slug

        return (
          <li
            key={f.id}
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{
              background: 'var(--admin-bg-elev)',
              border: '0.5px solid var(--admin-border)',
            }}
          >
            <span
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: 'var(--admin-blue-soft)',
                border: '0.5px solid var(--admin-border-strong)',
              }}
            >
              <FileText className="w-4 h-4" style={{ color: 'var(--admin-blue)' }} />
            </span>
            <div className="flex-1 min-w-0">
              <p
                className="truncate"
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-fg)' }}
              >
                {f.form_name}
              </p>
              <div
                className="flex items-center gap-2 mt-0.5"
                style={{ fontSize: 11, color: 'var(--admin-fg-muted)' }}
              >
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                  style={{
                    background: stateStyle.bg,
                    color: stateStyle.text,
                    border: `0.5px solid ${stateStyle.border}`,
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                  }}
                >
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
                    <span style={{ color: 'var(--admin-green)' }}>PDF: {formatDate(f.filled_pdf_generated_at)}</span>
                  </>
                )}
              </div>
            </div>
            {isAutomated && f.slug && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(f.slug as string)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
                  color: '#FFFFFF',
                  border: '0.5px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 8px 18px rgba(30,78,154,0.18)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #F2C14E, var(--admin-gold))',
                  color: 'var(--admin-accent)',
                  border: '0.5px solid var(--admin-gold-border, rgba(255,255,255,0.2))',
                  boxShadow: 'var(--admin-shadow-gold, 0 8px 18px rgba(216,155,29,0.22))',
                  fontSize: 12,
                  fontWeight: 700,
                }}
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

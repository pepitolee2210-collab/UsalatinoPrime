'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Download, FileText, Loader2 } from 'lucide-react'

interface Props {
  caseId: string
  caseNumber: string
}

/**
 * Card del tab "Generadores" con TRES botones de descarga del PDF I-589
 * oficial USCIS:
 *
 *  - Parte A (páginas 1-4): siempre habilitado. Rellena con datos del
 *    wizard del cliente (submissions `i589_part_a1..a4`).
 *  - Parte B/C/D (páginas 5-12): habilitado solo si hay Miedo Creíble
 *    `is_current=true`. Rellena Yes/No checkboxes y textareas con el
 *    JSON estructurado del prompt v3.
 *  - Completo (1-12): mismo gate que Parte B. Mezcla ambas fuentes en un
 *    solo PDF de 12 páginas, listo para imprimir y presentar a USCIS.
 */
export function I589DownloadCard({ caseId, caseNumber }: Props) {
  const supabase = createClient()
  const [submittedCount, setSubmittedCount] = useState<number | null>(null)
  const [draft, setDraft] = useState<{ version: number; generated_at: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [subsRes, draftRes] = await Promise.all([
      supabase
        .from('case_form_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('case_id', caseId)
        .eq('status', 'submitted')
        .in('form_type', ['i589_part_a1', 'i589_part_a2', 'i589_part_a3', 'i589_part_a4']),
      supabase
        .from('case_credible_fear_drafts')
        .select('version, generated_at')
        .eq('case_id', caseId)
        .eq('is_current', true)
        .maybeSingle(),
    ])
    setSubmittedCount(subsRes.count ?? 0)
    setDraft(draftRes.data ?? null)
    setLoading(false)
  }, [caseId, supabase])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const submitted = submittedCount ?? 0
  const hasDraft = !!draft

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 text-emerald-700 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-900">
            Formulario I-589 oficial USCIS
          </p>
          <p className="text-xs text-emerald-700 mt-1">
            {loading ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Cargando estado…
              </span>
            ) : (
              <>
                Wizard: <strong>{submitted}/4</strong> partes enviadas · Miedo Creíble:{' '}
                {hasDraft ? (
                  <>
                    <strong>v{draft!.version}</strong>{' '}
                    <span className="opacity-70">
                      · {new Date(draft!.generated_at).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </>
                ) : (
                  <strong>—</strong>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <DownloadButton
          label="Páginas 1-4 (Parte A)"
          hint="Datos del wizard del cliente"
          caseId={caseId}
          caseNumber={caseNumber}
          endpoint="i589-part-a"
          loading={loading}
        />
        <DownloadButton
          label="Páginas 5-12 (B/C/D)"
          hint="Generado del Miedo Creíble"
          caseId={caseId}
          caseNumber={caseNumber}
          endpoint="i589-part-b"
          loading={loading}
          disabled={!hasDraft}
          disabledHint="Genera primero el Miedo Creíble"
        />
        <DownloadButton
          label="Completo (1-12)"
          hint="Listo para presentar a USCIS"
          caseId={caseId}
          caseNumber={caseNumber}
          endpoint="i589-complete"
          loading={loading}
          disabled={!hasDraft}
          disabledHint="Genera primero el Miedo Creíble"
        />
      </div>
    </div>
  )
}

interface BtnProps {
  label: string
  hint: string
  caseId: string
  caseNumber: string
  endpoint: 'i589-part-a' | 'i589-part-b' | 'i589-complete'
  loading: boolean
  disabled?: boolean
  disabledHint?: string
}

function DownloadButton({
  label,
  hint,
  caseId,
  caseNumber,
  endpoint,
  loading,
  disabled,
  disabledHint,
}: BtnProps) {
  const href = `/api/admin/cases/${caseId}/${endpoint}/download`
  const isDisabled = loading || disabled
  const buttonInner = (
    <Button
      className={`w-full ${isDisabled ? 'bg-emerald-300 text-white' : 'bg-emerald-700 hover:bg-emerald-800 text-white'}`}
      disabled={isDisabled}
      title={disabled ? disabledHint : hint}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-1.5" />
      )}
      <span className="text-xs">{label}</span>
    </Button>
  )

  if (isDisabled) {
    return (
      <div className="flex flex-col gap-0.5" title={disabled ? disabledHint : ''}>
        {buttonInner}
        <span className="text-[10px] text-emerald-700/70 px-1">
          {disabled ? disabledHint : hint}
        </span>
      </div>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Descargar ${label} caso ${caseNumber}`}
      className="flex flex-col gap-0.5"
    >
      {buttonInner}
      <span className="text-[10px] text-emerald-700/70 px-1">{hint}</span>
    </a>
  )
}

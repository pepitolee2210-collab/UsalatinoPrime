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
 * Card del tab "Generadores" que permite a Diana descargar el PDF I-589
 * oficial USCIS rellenado con las respuestas del wizard del cliente.
 *
 * El endpoint detrás (`/api/admin/cases/[id]/i589-part-a/download`) carga
 * los 4 `case_form_submissions` (form_type=i589_part_aN), los mergea, los
 * aplica al PDF AcroForm oficial (`public/forms/usa-i-589-asylum.pdf`),
 * flatten, y recorta a páginas 1-4. Diana lo imprime o lo anexa al
 * expediente final.
 */
export function I589PartADownloadCard({ caseId, caseNumber }: Props) {
  const supabase = createClient()
  const [submittedCount, setSubmittedCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { count } = await supabase
      .from('case_form_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('status', 'submitted')
      .in('form_type', ['i589_part_a1', 'i589_part_a2', 'i589_part_a3', 'i589_part_a4'])
    setSubmittedCount(count ?? 0)
    setLoading(false)
  }, [caseId, supabase])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const submitted = submittedCount ?? 0
  const allReady = submitted === 4

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <FileText className="w-5 h-5 text-emerald-700 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-900">
            I-589 oficial USCIS — Páginas 1 a 4
          </p>
          <p className="text-xs text-emerald-700 mt-1">
            {loading ? (
              'Cargando estado del formulario…'
            ) : allReady ? (
              <>
                El cliente envió las 4 partes del wizard. Descarga el PDF oficial USCIS rellenado con sus respuestas (recortado a páginas 1-4, Parte A).
              </>
            ) : (
              <>
                El cliente envió <strong>{submitted}</strong> de 4 partes. El PDF se generará con los datos disponibles; partes faltantes quedarán en blanco.
              </>
            )}
          </p>
        </div>
      </div>
      <a
        href={`/api/admin/cases/${caseId}/i589-part-a/download`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Descargar I-589 caso ${caseNumber}`}
      >
        <Button className="bg-emerald-700 hover:bg-emerald-800 text-white" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
          Descargar PDF
        </Button>
      </a>
    </div>
  )
}

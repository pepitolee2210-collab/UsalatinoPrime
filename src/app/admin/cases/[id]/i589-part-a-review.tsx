'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, FileText, CheckCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  I589_PART_A_STEPS,
  I589_FORM_TYPES,
  type I589PartId,
} from '@/components/i589/i589-part-a-questions'
import { createClient } from '@/lib/supabase/client'

/**
 * Panel admin para Diana: vista de lectura de los 4 parts del I-589 Parte A
 * que el cliente llenó vía wizard. Útil mientras el AcroForm I-589 oficial
 * no está registrado — Diana copia los valores manualmente al PDF USCIS.
 *
 * Cuando se registre el AcroForm:
 *   /api/admin/case-forms/i-589/print → genera el PDF rellenado
 * y este componente puede mostrar también un botón "Imprimir oficial".
 */

interface I589PartAReviewProps {
  caseId: string
  caseNumber: string
}

interface PartRow {
  form_type: string
  form_data: Record<string, unknown> | null
  status: string | null
  updated_at: string | null
  submitted_at: string | null
}

export function I589PartAReview({ caseId, caseNumber }: I589PartAReviewProps) {
  const supabase = createClient()
  const [parts, setParts] = useState<Map<I589PartId, PartRow>>(new Map())
  const [loading, setLoading] = useState(true)

  const fetchParts = useCallback(async () => {
    const { data, error } = await supabase
      .from('case_form_submissions')
      .select('form_type, form_data, status, updated_at, submitted_at')
      .eq('case_id', caseId)
      .in('form_type', Object.values(I589_FORM_TYPES))
      .eq('minor_index', 0)

    if (error) {
      toast.error('Error al cargar el I-589 del cliente')
      setLoading(false)
      return
    }
    const m = new Map<I589PartId, PartRow>()
    for (const row of (data ?? []) as PartRow[]) {
      const partId = (Object.keys(I589_FORM_TYPES) as I589PartId[]).find(
        (k) => I589_FORM_TYPES[k] === row.form_type,
      )
      if (partId) m.set(partId, row)
    }
    setParts(m)
    setLoading(false)
  }, [caseId, supabase])

  useEffect(() => {
    void fetchParts()
  }, [fetchParts])

  function downloadJSON() {
    const obj: Record<string, unknown> = { case_number: caseNumber }
    for (const step of I589_PART_A_STEPS) {
      obj[step.id] = parts.get(step.id)?.form_data ?? null
    }
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `i589-part-a-${caseNumber}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Cargando datos del I-589…
      </div>
    )
  }

  const allSubmitted = I589_PART_A_STEPS.every(
    (s) => parts.get(s.id)?.status === 'submitted',
  )
  const anyData = I589_PART_A_STEPS.some(
    (s) => parts.get(s.id)?.form_data && Object.keys(parts.get(s.id)?.form_data ?? {}).length > 0,
  )

  if (!anyData) {
    return (
      <div className="text-center py-12 px-4">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-600 font-semibold">
          El cliente aún no ha llenado el I-589 Parte A
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Cuando complete el wizard en /cita/[token] → Formularios, los datos aparecerán aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <FileText className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900">
            I-589 Parte A — Datos del cliente
          </p>
          <p className="text-xs text-amber-800 mt-1">
            Estos son los datos que Mauricio Test capturó vía el wizard del portal. Mientras se
            implementa el AcroForm I-589 oficial, copia los valores al PDF USCIS manualmente
            usando el botón de descarga JSON o esta vista de lectura.
          </p>
        </div>
        <Button onClick={downloadJSON} size="sm" variant="outline">
          <Download className="w-3.5 h-3.5 mr-1" />
          Descargar JSON
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Badge className={allSubmitted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
          {allSubmitted ? <><CheckCircle className="w-3 h-3 mr-1" /> 4/4 enviados</> : 'En progreso'}
        </Badge>
      </div>

      {I589_PART_A_STEPS.map((step) => {
        const row = parts.get(step.id)
        const data = (row?.form_data ?? {}) as Record<string, unknown>
        const filledCount = step.sections
          .flatMap((s) => s.fields)
          .filter((f) => {
            const v = data[f.key]
            return v !== undefined && v !== null && String(v).trim() !== ''
          }).length
        const totalCount = step.sections.flatMap((s) => s.fields).length

        return (
          <details key={step.id} className="rounded-2xl border border-gray-200 bg-white" open>
            <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-50">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  {step.number}
                </p>
                <p className="text-sm font-bold text-gray-900">{step.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{filledCount}/{totalCount}</span>
                {row?.status === 'submitted' ? (
                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Enviado</Badge>
                ) : row?.form_data ? (
                  <Badge className="bg-amber-100 text-amber-800 text-[10px]">Borrador</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Sin datos</Badge>
                )}
              </div>
            </summary>
            <div className="px-4 py-3 border-t border-gray-100 space-y-4">
              {step.sections.map((sec, i) => (
                <section key={i}>
                  <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">{sec.title}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sec.fields.map((f) => {
                      const v = data[f.key]
                      const display = v === undefined || v === null || String(v).trim() === ''
                        ? '—'
                        : String(v)
                      return (
                        <div key={f.key} className="text-xs">
                          <p className="font-bold text-gray-500 uppercase text-[10px]">{f.label}</p>
                          <p className="text-gray-900 break-words">{display}</p>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </details>
        )
      })}
    </div>
  )
}

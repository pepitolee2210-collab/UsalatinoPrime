'use client'

import { I589PartAReview } from './i589-part-a-review'
import { CredibleFearGenerator } from './credible-fear-generator'
import { I589DownloadCard } from './i589-download-card'
import { Sparkles } from 'lucide-react'

/**
 * Tab "Generadores" del panel Diana para Asilo Político.
 *
 * Reúne en un solo lugar todo lo que la firma necesita para producir
 * documentos a partir de los datos del cliente:
 *
 *   - I-589 oficial USCIS (páginas 1-4) rellenado con el wizard
 *   - Vista de los datos del wizard (read-only, copyable)
 *   - Generador del Miedo Creíble (IA) con descarga Word
 *
 * Se inyecta como extraTab en /employee/clientes/[id] y /employee/cases/[id]
 * cuando el servicio es 'asilo-politico'.
 */
export function AsiloGeneradoresTab({ caseId, caseNumber }: { caseId: string; caseNumber: string }) {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-purple-200 bg-purple-50 p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-purple-700 mt-0.5" data-fill="1" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-purple-900">
            Generadores — Asilo Político
          </p>
          <p className="text-[11px] text-purple-700 mt-0.5">
            Herramientas para Diana: descargar el I-589 oficial con los datos del cliente y
            generar el relato de Miedo Creíble (Word editable).
          </p>
        </div>
      </header>

      <I589DownloadCard caseId={caseId} caseNumber={caseNumber} />
      <I589PartAReview caseId={caseId} caseNumber={caseNumber} />
      <CredibleFearGenerator caseId={caseId} caseNumber={caseNumber} />
    </div>
  )
}

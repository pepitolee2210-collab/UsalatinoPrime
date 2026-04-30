'use client'

import { FileText, CheckCircle2, Clock, ExternalLink } from 'lucide-react'
import type { FormInstance } from './phase-types'

interface PhaseFormsListProps {
  forms: FormInstance[]
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

export function PhaseFormsList({ forms, emptyMessage }: PhaseFormsListProps) {
  if (forms.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-4">{emptyMessage ?? 'No hay formularios oficiales en esta fase.'}</p>
    )
  }

  return (
    <ul className="space-y-2">
      {forms.map(f => {
        const submitted = f.client_submitted_at != null
        const hasPDF = !!f.filled_pdf_path
        const stateLabel = submitted ? 'Enviado' : f.client_last_edit_at ? 'En progreso' : 'Sin iniciar'
        const stateClass = submitted
          ? 'bg-emerald-100 text-emerald-700'
          : f.client_last_edit_at
          ? 'bg-amber-100 text-amber-700'
          : 'bg-gray-100 text-gray-500'
        const StateIcon = submitted ? CheckCircle2 : Clock

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
              </div>
            </div>
            {hasPDF && (
              <a
                href={`/api/admin/case-forms/${encodeURIComponent(f.form_name)}/print?caseId=&download=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
                title="Abrir PDF generado"
              >
                PDF
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}

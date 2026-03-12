'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { statusLabels } from '@/lib/case-status'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock, FileText, CheckCircle, BookOpen } from 'lucide-react'

interface CaseCardProps {
  caseData: any
}

export function CaseCard({ caseData }: CaseCardProps) {
  const daysSinceUpdate = differenceInDays(new Date(), new Date(caseData.updated_at))
  const isUrgent = daysSinceUpdate > 7
  const status = statusLabels[caseData.intake_status] || statusLabels.in_progress

  return (
    <Link href={`/admin/cases/${caseData.id}`}>
      <div className={`bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${isUrgent ? 'border-l-4 border-l-red-400' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-blue-600">#{caseData.case_number}</span>
          {isUrgent && (
            <span className="flex items-center gap-1 text-xs text-red-500" title={`${daysSinceUpdate} dias sin actualizar`}>
              <Clock className="w-3 h-3" />
              {daysSinceUpdate}d
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-gray-900 truncate">
          {caseData.client?.first_name} {caseData.client?.last_name}
        </p>
        <p className="text-xs text-gray-500 truncate">{caseData.service?.name}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {format(new Date(caseData.created_at), 'd MMM', { locale: es })}
          </span>
          <div className="flex items-center gap-1.5">
            {(caseData.doc_count > 0) && (
              <span className="flex items-center gap-0.5 text-xs text-blue-600" title={`${caseData.doc_count} documentos`}>
                <FileText className="w-3 h-3" />
                {caseData.doc_count}
              </span>
            )}
            {(caseData.submission_total > 0) && (
              <span
                className={`flex items-center gap-0.5 text-xs ${
                  caseData.submission_done === caseData.submission_total ? 'text-green-600' : 'text-amber-600'
                }`}
                title={`${caseData.submission_done}/${caseData.submission_total} historias enviadas`}
              >
                {caseData.submission_done === caseData.submission_total
                  ? <CheckCircle className="w-3 h-3" />
                  : <BookOpen className="w-3 h-3" />
                }
                {caseData.submission_done}/{caseData.submission_total}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

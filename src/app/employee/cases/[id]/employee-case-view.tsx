'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PhaseStatusPanel } from '@/app/admin/cases/[id]/phase-status-panel'
import { CaseTabsByPhase } from '@/app/employee/_shared/case-tabs-by-phase'
import { useCaseOverview } from '@/app/employee/_shared/use-case-overview'
import type { CasePhase } from '@/types/database'

interface CaseData {
  id: string
  case_number: string
  client_id: string
  current_phase: CasePhase | null
  process_start: CasePhase | null
  state_us: string | null
  parent_deceased: boolean
  in_orr_custody: boolean
  has_criminal_history: boolean
  minor_close_to_21: boolean
  client: { first_name: string; last_name: string; email: string; phone: string }
  service: { name: string; slug: string }
}

interface Assignment {
  id: string
  task_description: string | null
  status: string
  assigned_at: string
}

interface Doc {
  id: string
  document_key: string
  name: string
  file_size: number | null
  status: string
  created_at: string
}

interface FormSubmission {
  form_type: string
  form_data: Record<string, unknown>
  status: string
  updated_at: string
  minor_index: number
}

interface Submission {
  id: string
  title: string | null
  content: string | null
  file_url: string | null
  file_name: string | null
  status: string
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export function EmployeeCaseView({
  caseData,
  assignment,
  formSubmissions = [],
  submissions,
  henryNotes,
}: {
  caseData: CaseData
  /** Null cuando el paralegal accede a un caso sin asignación explícita. */
  assignment: Assignment | null
  documents: Doc[]
  henryDocuments: Doc[]
  formSubmissions?: FormSubmission[]
  submissions: Submission[]
  henryNotes: string
}) {
  const router = useRouter()
  const hasAssignment = Boolean(assignment)
  const clientName = `${caseData.client?.first_name || ''} ${caseData.client?.last_name || ''}`.trim()
  const isVisaJuvenil = caseData.service?.slug === 'visa-juvenil'

  const { overview, loading, refresh } = useCaseOverview(caseData.id)

  // Tab "Mi Trabajo" se inyecta como extraTab cuando hay asignación.
  const miTrabajoTab = hasAssignment
    ? [{
        id: 'mi-trabajo' as const,
        label: 'Mi Trabajo',
        count: submissions.length,
        content: (
          <div className="space-y-3">
            {submissions.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No hay trabajos enviados.</p>
            ) : submissions.map(sub => (
              <div key={sub.id} className="p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-900">{sub.title || 'Sin título'}</p>
                  <Badge className={
                    sub.status === 'approved' ? 'bg-green-100 text-green-700' :
                    sub.status === 'submitted' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-600'
                  }>
                    {sub.status === 'submitted' ? 'Enviado' : sub.status === 'approved' ? 'Aprobado' : sub.status}
                  </Badge>
                </div>
                {sub.content && <p className="text-xs text-gray-600 line-clamp-3">{sub.content}</p>}
                {sub.admin_notes && (
                  <div className="mt-2 p-2 bg-yellow-50 rounded-lg">
                    <p className="text-[10px] font-bold text-yellow-700">Notas del abogado:</p>
                    <p className="text-xs text-yellow-800">{sub.admin_notes}</p>
                  </div>
                )}
              </div>
            ))}
            {assignment?.task_description && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-xs font-bold text-blue-700 mb-2">Instrucciones de la tarea</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{assignment.task_description}</p>
              </div>
            )}
          </div>
        ),
      }]
    : []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/employee/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{clientName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-[10px]">#{caseData.case_number}</Badge>
            <Badge variant="secondary" className="text-[10px]">{caseData.service?.name}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
            <span>{caseData.client?.phone}</span>
            <span>{caseData.client?.email}</span>
          </div>
        </div>
      </div>

      {/* SIJS Phase Panel */}
      <PhaseStatusPanel
        caseId={caseData.id}
        caseNumber={caseData.case_number}
        currentPhase={caseData.current_phase}
        processStart={caseData.process_start}
        stateUs={caseData.state_us}
        flags={{
          parent_deceased: caseData.parent_deceased,
          in_orr_custody: caseData.in_orr_custody,
          has_criminal_history: caseData.has_criminal_history,
          minor_close_to_21: caseData.minor_close_to_21,
        }}
        isVisaJuvenil={isVisaJuvenil}
      />

      {/* Tabs por fase */}
      <CaseTabsByPhase
        caseId={caseData.id}
        caseNumber={caseData.case_number}
        clientId={caseData.client_id}
        clientName={clientName}
        serviceSlug={caseData.service?.slug ?? ''}
        isVisaJuvenil={isVisaJuvenil}
        overview={overview}
        loading={loading}
        formSubmissions={formSubmissions}
        henryNotes={henryNotes}
        extraTabs={miTrabajoTab}
        onRefresh={() => {
          refresh()
          router.refresh()
        }}
      />
    </div>
  )
}

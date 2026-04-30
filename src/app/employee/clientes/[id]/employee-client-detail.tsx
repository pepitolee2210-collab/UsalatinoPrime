'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone } from 'lucide-react'
import { PhaseStatusPanel } from '@/app/admin/cases/[id]/phase-status-panel'
import { CasePipeline } from '@/components/case-pipeline'
import { CaseTabsByPhase } from '@/app/employee/_shared/case-tabs-by-phase'
import { useCaseOverview } from '@/app/employee/_shared/use-case-overview'
import type { CasePhase } from '@/types/database'

interface Client {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
}

interface Case {
  id: string
  case_number: string
  henry_notes: string | null
  pipeline_status: Record<string, boolean> | null
  current_phase: CasePhase | null
  process_start: CasePhase | null
  state_us: string | null
  parent_deceased: boolean | null
  in_orr_custody: boolean | null
  has_criminal_history: boolean | null
  minor_close_to_21: boolean | null
  service: { name: string; slug: string } | null
}

interface Doc {
  id: string
  case_id: string
  document_key: string
  name: string
  file_size: number | null
  file_path: string
  created_at: string
}

interface FormSub {
  form_type: string
  form_data: Record<string, unknown>
  status: string
  updated_at: string
  case_id: string
  minor_index: number
}

export function EmployeeClientDetail({
  client,
  cases,
  documents,
  henryDocuments,
  formSubmissions,
  appointments,
}: {
  client: Client
  cases: Case[]
  documents: Doc[]
  henryDocuments: Doc[]
  formSubmissions: FormSub[]
  appointments: { id: string; case_id: string; status: string }[]
}) {
  const router = useRouter()
  const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id || '')

  const activeCase = cases.find(c => c.id === selectedCaseId)
  const clientName = `${client.first_name} ${client.last_name}`.trim()
  const isVisaJuvenil = activeCase?.service?.slug === 'visa-juvenil'

  const caseForms = formSubmissions.filter(f => f.case_id === selectedCaseId)
  const caseDocs = documents.filter(d => d.case_id === selectedCaseId)
  const caseHenryDocs = henryDocuments.filter(d => d.case_id === selectedCaseId)
  const i360Sub = caseForms.find(s => s.form_type === 'i360_sijs')

  // Cargar overview por fase del caso seleccionado.
  const { overview, loading, refresh } = useCaseOverview(selectedCaseId || null)

  // Si cambia el caso, refrescar.
  useEffect(() => {
    refresh()
  }, [selectedCaseId, refresh])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/employee/clientes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{clientName}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>
            {client.phone && (
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>
            )}
          </div>
        </div>
      </div>

      {/* Case selector */}
      {cases.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {cases.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCaseId(c.id)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                selectedCaseId === c.id
                  ? 'border-[#F2A900] bg-[#F2A900]/10 text-[#9a6500]'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              #{c.case_number} — {c.service?.name || '—'}
            </button>
          ))}
        </div>
      )}
      {cases.length === 1 && activeCase && (
        <Badge variant="secondary" className="text-[10px]">
          #{activeCase.case_number} — {activeCase.service?.name}
        </Badge>
      )}

      {/* SIJS Phase Panel — Diana puede avanzar fases sin Henry */}
      {activeCase && (
        <PhaseStatusPanel
          caseId={activeCase.id}
          caseNumber={activeCase.case_number}
          currentPhase={activeCase.current_phase ?? null}
          processStart={activeCase.process_start ?? null}
          stateUs={activeCase.state_us ?? null}
          flags={{
            parent_deceased: !!activeCase.parent_deceased,
            in_orr_custody: !!activeCase.in_orr_custody,
            has_criminal_history: !!activeCase.has_criminal_history,
            minor_close_to_21: !!activeCase.minor_close_to_21,
          }}
          isVisaJuvenil={!!isVisaJuvenil}
        />
      )}

      {/* Pipeline visual */}
      {isVisaJuvenil && activeCase && (
        <CasePipeline
          caseId={activeCase.id}
          hasAppointment={appointments.filter(a => a.case_id === activeCase.id).some(a => a.status === 'scheduled' || a.status === 'completed')}
          hasDocuments={caseDocs.length >= 3}
          hasHistory={caseForms.some(s => s.form_type === 'client_story' && (s.status === 'submitted' || s.status === 'approved'))}
          hasDeclarations={caseForms.some(s => s.form_type === 'tutor_guardian' && s.status === 'submitted')}
          hasClientDocs={caseHenryDocs.length > 0}
          hasI360={!!i360Sub && (i360Sub.status === 'submitted' || i360Sub.status === 'approved')}
          manualStages={{
            henry_reviewed: !!(activeCase.pipeline_status as Record<string, boolean> | null)?.henry_reviewed,
            presented_to_court: !!(activeCase.pipeline_status as Record<string, boolean> | null)?.presented_to_court,
          }}
          canEdit={true}
        />
      )}

      {/* Tabs por fase */}
      {activeCase && (
        <CaseTabsByPhase
          caseId={activeCase.id}
          caseNumber={activeCase.case_number}
          clientId={client.id}
          clientName={clientName}
          serviceSlug={activeCase.service?.slug ?? ''}
          isVisaJuvenil={!!isVisaJuvenil}
          overview={overview}
          loading={loading}
          formSubmissions={caseForms}
          henryNotes={activeCase.henry_notes ?? ''}
          onRefresh={() => {
            refresh()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

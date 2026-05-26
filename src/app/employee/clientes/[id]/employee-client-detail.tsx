'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone } from 'lucide-react'
import { PhaseStatusPanel } from '@/app/admin/cases/[id]/phase-status-panel'
import { CasePipeline } from '@/components/case-pipeline'
import { CaseTabsByPhase } from '@/app/employee/_shared/case-tabs-by-phase'
import { useCaseOverview } from '@/app/employee/_shared/use-case-overview'
import { BitacoraTab } from '@/app/employee/_shared/bitacora-tab'
import { CollectionTab, type CollectionContract, type CollectionPayment } from '@/components/payments/collection-tab'
import { AsiloGeneradoresTab } from '@/app/admin/cases/[id]/asilo-generadores-tab'
import { AdminKeyframes } from '@/components/admin-ui'
import type { CasePhase } from '@/types/database'
import { isAsylumService } from '@/lib/services/asylum'

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
  currentUserId,
  isAdmin,
  isContractsManager = false,
  contracts = [],
  payments = [],
}: {
  client: Client
  cases: Case[]
  documents: Doc[]
  henryDocuments: Doc[]
  formSubmissions: FormSub[]
  appointments: { id: string; case_id: string; status: string }[]
  currentUserId: string
  isAdmin: boolean
  isContractsManager?: boolean
  contracts?: CollectionContract[]
  payments?: CollectionPayment[]
}) {
  const router = useRouter()
  const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id || '')

  const activeCase = cases.find(c => c.id === selectedCaseId)
  const clientName = `${client.first_name} ${client.last_name}`.trim()
  const isVisaJuvenil = activeCase?.service?.slug === 'visa-juvenil'
  const isAsiloPolitico = isAsylumService(activeCase?.service?.slug)

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
      <AdminKeyframes />

      {/* Header */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border)',
          boxShadow: 'var(--admin-shadow, 0 1px 3px rgba(11,31,58,0.04))',
        }}
      >
        <div className="flex items-start gap-3">
          <Link href="/employee/clientes">
            <Button
              variant="ghost"
              size="icon"
              style={{ color: 'var(--admin-fg-muted)' }}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <p
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.2em',
                color: 'var(--admin-accent)',
              }}
            >
              CLIENTE · DETALLE
            </p>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--admin-fg)',
                marginTop: 4,
                letterSpacing: '-0.02em',
              }}
            >
              {clientName}
            </h1>
            <div
              className="flex flex-wrap items-center gap-4 mt-2"
              style={{ fontSize: 12, color: 'var(--admin-fg-subtle)' }}
            >
              <span className="flex items-center gap-1.5">
                <Mail className="w-3 h-3" />
                {client.email}
              </span>
              {client.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />
                  {client.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Case selector */}
      {cases.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {cases.map(c => {
            const isActive = selectedCaseId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCaseId(c.id)}
                className="px-3 py-1.5 rounded-lg transition-colors"
                style={
                  isActive
                    ? {
                        background: 'var(--admin-accent-soft)',
                        color: 'var(--admin-accent)',
                        border: '0.5px solid var(--admin-accent)',
                        fontSize: 12,
                        fontWeight: 600,
                      }
                    : {
                        background: 'var(--admin-bg-elev)',
                        color: 'var(--admin-fg-muted)',
                        border: '0.5px solid var(--admin-border)',
                        fontSize: 12,
                        fontWeight: 500,
                      }
                }
              >
                #{c.case_number} — {c.service?.name || '—'}
              </button>
            )
          })}
        </div>
      )}
      {cases.length === 1 && activeCase && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{
            background: 'var(--admin-accent-soft)',
            border: '0.5px solid var(--admin-border-strong)',
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            color: 'var(--admin-fg-muted)',
          }}
        >
          #{activeCase.case_number.toUpperCase()} — {activeCase.service?.name?.toUpperCase()}
        </span>
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
          serviceSlug={activeCase.service?.slug ?? null}
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
          overview={overview}
          loading={loading}
          formSubmissions={caseForms}
          henryNotes={activeCase.henry_notes ?? ''}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          extraTabs={[
            // Tab "Cobranza" — solo visible para contracts_manager (Andrium).
            // Va PRIMERO porque es lo más relevante para su trabajo diario.
            ...(isContractsManager
              ? [{
                  id: 'cobranza' as const,
                  label: '💸 Cobranza',
                  content: (
                    <CollectionTab
                      caseId={activeCase.id}
                      clientName={clientName}
                      clientPhone={client.phone}
                      contracts={contracts.filter((c) => c.case_id === activeCase.id)}
                      payments={payments.filter((p) => p.case_id === activeCase.id)}
                    />
                  ),
                }]
              : []),
            // Tab "Generadores" — Asilo Político. Reúne descarga I-589 oficial
            // (páginas 1-4) + vista del wizard + generador del Miedo Creíble.
            ...(isAsiloPolitico
              ? [{
                  id: 'generadores' as const,
                  label: 'Generadores',
                  content: (
                    <AsiloGeneradoresTab
                      caseId={activeCase.id}
                      caseNumber={activeCase.case_number}
                    />
                  ),
                }]
              : []),
            {
              id: 'bitacora',
              label: 'Bitácora',
              content: <BitacoraTab caseId={activeCase.id} />,
            },
          ]}
          onRefresh={() => {
            refresh()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

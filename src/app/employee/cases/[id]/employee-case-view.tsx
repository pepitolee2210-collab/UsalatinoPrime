'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { PhaseStatusPanel } from '@/app/admin/cases/[id]/phase-status-panel'
import { CaseTabsByPhase } from '@/app/employee/_shared/case-tabs-by-phase'
import { useCaseOverview } from '@/app/employee/_shared/use-case-overview'
import { I360FormSection } from '@/components/legal/i360-form-section'
import { AdminKeyframes } from '@/components/admin-ui'
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
  currentUserId,
}: {
  caseData: CaseData
  /** Null cuando el paralegal accede a un caso sin asignación explícita. */
  assignment: Assignment | null
  documents: Doc[]
  henryDocuments: Doc[]
  formSubmissions?: FormSubmission[]
  submissions: Submission[]
  henryNotes: string
  currentUserId: string
}) {
  const router = useRouter()
  const hasAssignment = Boolean(assignment)
  const clientName = `${caseData.client?.first_name || ''} ${caseData.client?.last_name || ''}`.trim()
  const isVisaJuvenil = caseData.service?.slug === 'visa-juvenil'

  const { overview, loading, refresh } = useCaseOverview(caseData.id)

  // Tab "I-360" — sección especializada para Fase 2 (petición SIJS).
  // Diana puede ver, editar e imprimir el formulario USCIS I-360.
  const i360Submission = formSubmissions.find(s => s.form_type === 'i360_sijs' && (s.minor_index ?? 0) === 0)
  const i360Tab = isVisaJuvenil
    ? [{
        id: 'i360' as const,
        label: 'I-360',
        content: (
          <I360FormSection
            caseId={caseData.id}
            caseNumber={caseData.case_number}
            clientName={clientName}
            submission={i360Submission}
          />
        ),
      }]
    : []

  // i485 (SIJS), i589-part-a (Asilo) y credible-fear (Asilo) viven en el
  // registry compartido `src/lib/services/dashboard-tabs.tsx` — Diana los
  // recibe automáticamente sin necesidad de declararlos como extraTabs.

  // Tab "Mi Trabajo" se inyecta como extraTab cuando hay asignación.
  const miTrabajoTab = hasAssignment
    ? [{
        id: 'mi-trabajo' as const,
        label: 'Mi Trabajo',
        count: submissions.length,
        content: (
          <div className="space-y-3">
            {submissions.length === 0 ? (
              <div
                className="rounded-2xl p-12 text-center"
                style={{
                  background: 'var(--admin-panel-grad)',
                  border: '0.5px dashed var(--admin-border-strong)',
                }}
              >
                <p style={{ color: 'var(--admin-fg-muted)', fontSize: 14 }}>No hay trabajos enviados.</p>
              </div>
            ) : submissions.map(sub => (
              <div
                key={sub.id}
                className="p-4 rounded-xl"
                style={{
                  background: 'var(--admin-panel-grad)',
                  border: '0.5px solid var(--admin-border-strong)',
                  boxShadow: 'var(--admin-shadow)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)' }}>
                    {sub.title || 'Sin título'}
                  </p>
                  <SubmissionStatusPill status={sub.status} />
                </div>
                {sub.content && (
                  <p
                    className="line-clamp-3"
                    style={{ fontSize: 12, color: 'var(--admin-fg-muted)', lineHeight: 1.5 }}
                  >
                    {sub.content}
                  </p>
                )}
                {sub.admin_notes && (
                  <div
                    className="mt-2 p-2 rounded-lg"
                    style={{
                      background: 'var(--admin-gold-soft)',
                      border: '0.5px solid var(--admin-gold-border, var(--admin-gold))',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        color: 'var(--admin-gold)',
                      }}
                    >
                      NOTAS DEL ABOGADO
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--admin-gold)', marginTop: 2 }}>{sub.admin_notes}</p>
                  </div>
                )}
              </div>
            ))}
            {assignment?.task_description && (
              <div
                className="p-4 rounded-xl"
                style={{
                  background: 'var(--admin-blue-soft)',
                  border: '0.5px solid var(--admin-blue)',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    color: 'var(--admin-blue)',
                    marginBottom: 8,
                  }}
                >
                  INSTRUCCIONES DE LA TAREA
                </p>
                <p style={{ fontSize: 13, color: 'var(--admin-fg)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {assignment.task_description}
                </p>
              </div>
            )}
          </div>
        ),
      }]
    : []

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/employee/dashboard"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors flex-shrink-0"
          style={{
            background: 'var(--admin-bg-elev)',
            border: '0.5px solid var(--admin-border-strong)',
            color: 'var(--admin-fg-muted)',
          }}
          aria-label="Volver"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="relative flex items-center justify-center"
              style={{ width: 6, height: 6 }}
              aria-hidden
            >
              <span
                className="absolute inset-0 rounded-full"
                style={{ background: 'var(--admin-accent)', animation: 'ulp-ping 2s ease-in-out infinite' }}
              />
              <span
                className="relative rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  background: 'var(--admin-accent)',
                  boxShadow: '0 0 8px var(--admin-accent-glow)',
                }}
              />
            </span>
            <p
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.2em',
                color: 'var(--admin-accent)',
              }}
            >
              CASO · {caseData.case_number}
            </p>
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
              color: 'var(--admin-fg)',
            }}
          >
            {clientName}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--admin-accent-soft)',
                color: 'var(--admin-accent)',
                border: '0.5px solid var(--admin-border-strong)',
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                letterSpacing: '0.05em',
              }}
            >
              {caseData.service?.name}
            </span>
            {caseData.client?.phone && (
              <span style={{ fontSize: 12, color: 'var(--admin-fg-muted)' }}>{caseData.client.phone}</span>
            )}
            {caseData.client?.email && !caseData.client.email.includes('@usalatinoprime.internal') && (
              <span style={{ fontSize: 12, color: 'var(--admin-fg-muted)' }}>{caseData.client.email}</span>
            )}
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
        serviceSlug={caseData.service?.slug ?? null}
      />

      {/* Tabs por fase */}
      <CaseTabsByPhase
        caseId={caseData.id}
        caseNumber={caseData.case_number}
        clientId={caseData.client_id}
        clientName={clientName}
        serviceSlug={caseData.service?.slug ?? ''}
        overview={overview}
        loading={loading}
        formSubmissions={formSubmissions}
        henryNotes={henryNotes}
        currentUserId={currentUserId}
        isAdmin={false}
        extraTabs={[...i360Tab, ...miTrabajoTab]}
        onRefresh={() => {
          refresh()
          router.refresh()
        }}
      />
    </div>
  )
}

function SubmissionStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; text: string; border: string }> = {
    approved:  { label: 'Aprobado', bg: 'var(--admin-green-soft)', text: 'var(--admin-green)', border: 'var(--admin-green)' },
    submitted: { label: 'Enviado',  bg: 'var(--admin-accent-soft)', text: 'var(--admin-accent)', border: 'var(--admin-border-strong)' },
  }
  const cfg = map[status] || {
    label: status,
    bg: 'var(--admin-bg-elev-2)',
    text: 'var(--admin-fg-muted)',
    border: 'var(--admin-border-strong)',
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full"
      style={{
        background: cfg.bg,
        color: cfg.text,
        border: `0.5px solid ${cfg.border}`,
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.1em',
      }}
    >
      {cfg.label.toUpperCase()}
    </span>
  )
}

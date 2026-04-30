'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  ArrowLeft, FileText, Download, Send, Loader2,
  CheckCircle, AlertTriangle, Clock, Upload,
  User, BookOpen, Eye, X, MessageSquare,
} from 'lucide-react'
import Link from 'next/link'
import { DeclarationGenerator } from '@/app/admin/cases/[id]/declaration-generator'
import { ParentalConsentGenerator } from '@/app/admin/cases/[id]/parental-consent-generator'
import { SupplementaryDataForm } from '@/app/admin/cases/[id]/supplementary-data-form'
import { JurisdictionPanel } from '@/app/admin/cases/[id]/jurisdiction-panel'
import { PhaseHistoryTab } from '@/app/admin/cases/[id]/phase-history-tab'
import { PhaseStatusPanel } from '@/app/admin/cases/[id]/phase-status-panel'
import type { CasePhase } from '@/types/database'

interface CaseData {
  id: string
  case_number: string
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

type TabId = 'docs' | 'client-docs' | 'notas' | 'historia' | 'radicacion' | 'historico' | 'declaraciones' | 'i360' | 'mi-trabajo'

export function EmployeeCaseView({ caseData, assignment, documents, henryDocuments, formSubmissions = [], submissions, henryNotes }: {
  caseData: CaseData
  /** Null cuando el paralegal accede a un caso sin asignación explícita. */
  assignment: Assignment | null
  documents: Doc[]
  henryDocuments: Doc[]
  formSubmissions?: FormSubmission[]
  submissions: Submission[]
  henryNotes: string
}) {
  const hasAssignment = Boolean(assignment)
  const [tab, setTab] = useState<TabId>('docs')
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)

  const clientName = `${caseData.client?.first_name || ''} ${caseData.client?.last_name || ''}`.trim()
  const isVisaJuvenil = caseData.service?.slug === 'visa-juvenil'

  const aiSubmissions = formSubmissions
  const tutorData = aiSubmissions.find(s => s.form_type === 'tutor_guardian')?.form_data || null
  const minorStories = aiSubmissions
    .filter(s => s.form_type === 'client_story')
    .sort((a, b) => (a.minor_index || 0) - (b.minor_index || 0))
    .map(s => ({ minorIndex: s.minor_index || 0, formData: s.form_data }))
  const absentParents = aiSubmissions
    .filter(s => s.form_type === 'client_absent_parent')
    .sort((a, b) => (a.minor_index || 0) - (b.minor_index || 0))
    .map(s => ({ formData: s.form_data }))

  const i360Sub = aiSubmissions.find(s => s.form_type === 'i360_sijs')

  const isPDF = (name: string) => name.toLowerCase().endsWith('.pdf')

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'docs', label: 'Documentos', count: documents.length },
    { id: 'client-docs', label: 'Para el Cliente', count: henryDocuments.length },
    { id: 'notas', label: 'Notas' },
    { id: 'historia', label: 'Historia' },
    ...(isVisaJuvenil ? [
      { id: 'radicacion' as TabId, label: 'Radicación · PDFs' },
      { id: 'historico' as TabId, label: 'Histórico fases' },
      { id: 'declaraciones' as TabId, label: 'Declaraciones' },
      { id: 'i360' as TabId, label: 'I-360' },
    ] : []),
    // El tab "Mi Trabajo" solo aplica cuando hay asignación específica;
    // de lo contrario el paralegal está consultando el caso de forma abierta.
    ...(hasAssignment ? [{ id: 'mi-trabajo' as TabId, label: 'Mi Trabajo', count: submissions.length }] : []),
  ]

  return (
    <div className="space-y-5">
      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <p className="font-bold text-gray-900 truncate flex-1">{previewDoc.name}</p>
              <div className="flex items-center gap-2 ml-3">
                <a href={`/api/employee/download-case-doc?id=${previewDoc.id}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline"><Download className="w-3 h-3 mr-1" /> Descargar</Button>
                </a>
                <button onClick={() => setPreviewDoc(null)} className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100">
              {isPDF(previewDoc.name) ? (
                <iframe src={`/api/employee/download-case-doc?id=${previewDoc.id}`} className="w-full h-[75vh]" title={previewDoc.name} />
              ) : (
                <div className="flex items-center justify-center h-[50vh]">
                  <div className="text-center">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Vista previa no disponible</p>
                    <a href={`/api/employee/download-case-doc?id=${previewDoc.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-[#F2A900] hover:underline mt-2 inline-block">Descargar</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/employee/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
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

      {/* SIJS Phase Panel — visible para paralegals (Diana avanza fases sin Henry) */}
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

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1" style={{ borderBottom: '1px solid #f0f1f3' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg transition-colors ${
              tab === t.id ? 'bg-white text-gray-900 border border-b-0 border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {t.count !== undefined && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* === DOCUMENTOS TAB === */}
      {tab === 'docs' && (
        <div className="space-y-2">
          {documents.length === 0 ? <p className="text-center text-gray-400 py-8 text-sm">No hay documentos.</p> : documents.map(doc => (
            <DocRow key={doc.id} doc={doc} onPreview={() => setPreviewDoc(doc)} isPDF={isPDF(doc.name)} />
          ))}
        </div>
      )}

      {/* === PARA EL CLIENTE TAB === */}
      {tab === 'client-docs' && (
        <div className="space-y-2">
          {henryDocuments.length === 0 ? <p className="text-center text-gray-400 py-8 text-sm">No hay documentos para el cliente.</p> : henryDocuments.map(doc => (
            <DocRow key={doc.id} doc={doc} onPreview={() => setPreviewDoc(doc)} isPDF={isPDF(doc.name)} />
          ))}
        </div>
      )}

      {/* === NOTAS TAB === */}
      {tab === 'notas' && (
        <div className="space-y-3">
          {henryNotes ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-xs font-bold text-yellow-700 mb-2">Notas del Abogado</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{henryNotes}</p>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8 text-sm">No hay notas.</p>
          )}
          {assignment?.task_description && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs font-bold text-blue-700 mb-2">Instrucciones de la tarea</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{assignment.task_description}</p>
            </div>
          )}
          {!assignment && !henryNotes && (
            <p className="text-center text-gray-400 py-8 text-sm">No hay notas — estás consultando este caso sin asignación específica.</p>
          )}
        </div>
      )}

      {/* === HISTORIA TAB === */}
      {tab === 'historia' && (
        <div className="space-y-3">
          {aiSubmissions.filter(s => ['tutor_guardian', 'client_story', 'client_witnesses', 'client_absent_parent'].includes(s.form_type)).map((sub, i) => {
            const labels: Record<string, string> = {
              tutor_guardian: 'Declaración del Tutor',
              client_story: `Historia del Menor ${sub.minor_index + 1}`,
              client_witnesses: 'Testigos',
              client_absent_parent: `Padre Ausente ${sub.minor_index + 1}`,
            }
            return (
              <FormSection key={sub.form_type + sub.minor_index + i} title={labels[sub.form_type] || sub.form_type} status={sub.status} data={sub.form_data} />
            )
          })}
          {aiSubmissions.filter(s => ['tutor_guardian', 'client_story'].includes(s.form_type)).length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">El cliente no ha llenado la historia.</p>
          )}
        </div>
      )}

      {/* === RADICACIÓN TAB — proceso, formularios oficiales, PDF llenados === */}
      {tab === 'radicacion' && isVisaJuvenil && (
        <div>
          <JurisdictionPanel caseId={caseData.id} />
        </div>
      )}

      {/* === HISTÓRICO FASES TAB === */}
      {tab === 'historico' && isVisaJuvenil && (
        <PhaseHistoryTab caseId={caseData.id} />
      )}

      {/* === DECLARACIONES TAB === */}
      {tab === 'declaraciones' && isVisaJuvenil && (
        <div className="space-y-4">
          <SupplementaryDataForm
            caseId={caseData.id}
            tutorData={tutorData}
            minorStories={minorStories}
            absentParents={absentParents}
          />
          <ParentalConsentGenerator caseId={caseData.id} clientName={clientName} />
          <div className="border-t border-gray-200" />
          <DeclarationGenerator
            caseId={caseData.id}
            clientName={clientName}
            tutorData={tutorData}
            minorStories={minorStories}
          />
        </div>
      )}

      {/* === I-360 TAB === */}
      {tab === 'i360' && isVisaJuvenil && (
        <I360ReviewSection submission={i360Sub} />
      )}

      {/* === MI TRABAJO TAB === */}
      {tab === 'mi-trabajo' && (
        <div className="space-y-3">
          {submissions.length === 0 ? <p className="text-center text-gray-400 py-8 text-sm">No hay trabajos enviados.</p> : submissions.map(sub => (
            <div key={sub.id} className="p-4 bg-white border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-900">{sub.title || 'Sin título'}</p>
                <Badge className={sub.status === 'approved' ? 'bg-green-100 text-green-700' : sub.status === 'submitted' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}>
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
        </div>
      )}
    </div>
  )
}

// === HELPER COMPONENTS ===

function DocRow({ doc, onPreview, isPDF }: { doc: Doc; onPreview: () => void; isPDF: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isPDF ? 'bg-red-50' : 'bg-blue-50'}`}>
        <FileText className={`w-4 h-4 ${isPDF ? 'text-red-500' : 'text-blue-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
        <p className="text-[10px] text-gray-400">
          {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB · ` : ''}
          {new Date(doc.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {isPDF && (
          <button onClick={onPreview} className="p-2 rounded-lg hover:bg-gray-100" title="Vista previa"><Eye className="w-4 h-4 text-gray-500" /></button>
        )}
        <a href={`/api/employee/download-case-doc?id=${doc.id}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-gray-100" title="Descargar">
          <Download className="w-4 h-4 text-gray-500" />
        </a>
      </div>
    </div>
  )
}

function FormSection({ title, status, data }: { title: string; status: string; data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(data).filter(([, v]) => v && ((typeof v === 'string' && v.trim()) || typeof v === 'object'))

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100">
        <span className="text-sm font-bold text-gray-700">{title}</span>
        <div className="flex items-center gap-2">
          <Badge className={status === 'submitted' ? 'bg-purple-100 text-purple-700' : status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
            {status === 'submitted' ? 'Enviado' : status === 'approved' ? 'Aprobado' : status}
          </Badge>
          <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="p-4 space-y-2">
          {entries.map(([key, value]) => {
            if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
              const nested = value as Record<string, string>
              const filled = Object.entries(nested).filter(([, v]) => v && typeof v === 'string' && v.trim())
              if (!filled.length) return null
              return (
                <div key={key} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</p>
                  {filled.map(([k, v]) => (
                    <div key={k}><span className="text-[10px] text-gray-400 capitalize">{k.replace(/_/g, ' ')}</span><p className="text-xs text-gray-700">{v}</p></div>
                  ))}
                </div>
              )
            }
            if (Array.isArray(value)) {
              return (
                <div key={key} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{key.replace(/_/g, ' ')} ({value.length})</p>
                  {value.filter(v => typeof v === 'object' && v.name).map((item: any, i: number) => (
                    <p key={i} className="text-xs text-gray-700">{item.name} {item.relationship ? `— ${item.relationship}` : ''}</p>
                  ))}
                </div>
              )
            }
            return (
              <div key={key}><span className="text-[10px] text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span><p className="text-xs text-gray-700">{value as string}</p></div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function I360ReviewSection({ submission }: { submission?: FormSubmission }) {
  if (!submission) return <p className="text-center text-gray-400 py-8 text-sm">El cliente aún no ha llenado el formulario I-360.</p>

  const d = submission.form_data as Record<string, string>
  const sections = [
    { title: 'Part 1 — Peticionario', fields: [
      ['Nombre', `${d.petitioner_first_name || ''} ${d.petitioner_last_name || ''}`.trim()],
      ['SSN', d.petitioner_ssn], ['A-Number', d.petitioner_a_number],
      ['Dirección', `${d.petitioner_address || ''} ${d.petitioner_city || ''} ${d.petitioner_state || ''} ${d.petitioner_zip || ''}`],
    ]},
    { title: 'Part 3 — Beneficiario', fields: [
      ['Nombre', `${d.beneficiary_first_name || ''} ${d.beneficiary_last_name || ''}`.trim()],
      ['DOB', d.beneficiary_dob], ['País', d.beneficiary_country_birth],
      ['Pasaporte', d.beneficiary_passport_number], ['I-94', d.beneficiary_i94_number],
      ['Status', d.beneficiary_nonimmigrant_status],
    ]},
    { title: 'Part 8 — SIJS', fields: [
      ['Dependiente de corte', d.declared_dependent_court],
      ['Corte', d.state_agency_name],
      ['Bajo jurisdicción', d.currently_under_jurisdiction],
      ['Reunificación no viable', d.reunification_not_viable_reason],
      ['Mejor interés', d.best_interest_not_return],
    ]},
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Formulario I-360</h3>
        <Badge className={submission.status === 'submitted' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}>
          {submission.status === 'submitted' ? 'Enviado' : submission.status}
        </Badge>
      </div>
      {sections.map(s => (
        <div key={s.title} className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50"><span className="text-xs font-bold text-gray-600 uppercase">{s.title}</span></div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {s.fields.filter(([, v]) => v && (v as string).trim()).map(([label, value]) => (
              <div key={label as string}><span className="text-[10px] text-gray-400">{label as string}</span><p className="text-sm text-gray-900">{value as string}</p></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

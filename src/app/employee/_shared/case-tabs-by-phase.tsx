'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload, X, Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DeclarationGenerator } from '@/app/admin/cases/[id]/declaration-generator'
import { ParentalConsentGenerator } from '@/app/admin/cases/[id]/parental-consent-generator'
import { SupplementaryDataForm } from '@/app/admin/cases/[id]/supplementary-data-form'
import { JurisdictionPanel } from '@/app/admin/cases/[id]/jurisdiction-panel'
import { PhaseHistoryTab } from '@/app/admin/cases/[id]/phase-history-tab'
import { PhaseAccordion } from './phase-accordion'
import { PhaseDocumentList } from './phase-document-list'
import { PhaseFormsList } from './phase-forms-list'
import { PhaseEmptyState } from './phase-empty-state'
import { ReopenPhaseButton } from './reopen-phase-button'
import { PhaseTimelineStrip } from './phase-timeline-strip'
import { I360Section } from './i360-section'
import type { CaseOverview, PhaseGroup, UploadFile } from './phase-types'
import type { CasePhase } from '@/types/database'

export type TabId = 'docs' | 'client-docs' | 'forms' | 'notas' | 'historia' | 'radicacion' | 'historico' | 'generadores' | 'mi-trabajo'

interface FormSub {
  form_type: string
  form_data: Record<string, unknown>
  status: string
  updated_at: string
  minor_index: number
}

interface ExtraTab {
  id: TabId
  label: string
  count?: number
  content: React.ReactNode
}

interface CaseTabsByPhaseProps {
  caseId: string
  caseNumber: string
  clientId: string
  clientName: string
  serviceSlug: string
  isVisaJuvenil: boolean
  overview: CaseOverview | null
  loading: boolean
  /** Para los generadores, vienen del fetch original. */
  formSubmissions: FormSub[]
  henryNotes: string
  /** Tab opcional "Mi Trabajo" (solo employee-case-view con asignación). */
  extraTabs?: ExtraTab[]
  /** Llamado para refrescar tras un upload o cambio. */
  onRefresh: () => void
}

export function CaseTabsByPhase({
  caseId,
  caseNumber,
  clientId,
  clientName,
  isVisaJuvenil,
  overview,
  loading,
  formSubmissions,
  henryNotes,
  extraTabs = [],
  onRefresh,
}: CaseTabsByPhaseProps) {
  const router = useRouter()
  const [tab, setTab] = useState<TabId>('docs')
  const [previewDoc, setPreviewDoc] = useState<UploadFile | null>(null)
  const [uploadingClient, setUploadingClient] = useState(false)

  const currentPhase = overview?.case.current_phase ?? null

  const tabs: { id: TabId; label: string; count?: number }[] = useMemo(() => {
    const baseTabs: { id: TabId; label: string; count?: number }[] = [
      { id: 'docs', label: 'Documentos', count: countTotalUploads(overview, 'client_uploads') },
      { id: 'client-docs', label: 'Para el Cliente', count: countTotalUploads(overview, 'firm_documents') },
    ]
    if (isVisaJuvenil) {
      baseTabs.push({ id: 'forms', label: 'Formularios', count: countTotalForms(overview) })
    }
    baseTabs.push(
      { id: 'notas', label: 'Notas' },
      { id: 'historia', label: 'Historia' },
    )
    if (isVisaJuvenil) {
      baseTabs.push(
        { id: 'radicacion', label: 'Radicación' },
        { id: 'historico', label: 'Histórico' },
        { id: 'generadores', label: 'Generadores' },
      )
    }
    for (const t of extraTabs) {
      baseTabs.push({ id: t.id, label: t.label, count: t.count })
    }
    return baseTabs
  }, [overview, isVisaJuvenil, extraTabs])

  const handleScrollToPhase = (phase: CasePhase) => {
    const el = document.getElementById(`phase-section-${phase}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  async function handleClientDocUpload(file: File) {
    if (!caseId || !currentPhase) {
      toast.error('No se puede subir: el caso no tiene fase activa.')
      return
    }
    setUploadingClient(true)
    try {
      const { uploadDirect } = await import('@/lib/upload-direct')
      await uploadDirect({ file, documentKey: 'general', mode: 'admin', caseId, clientId })
      toast.success('Documento subido')
      onRefresh()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setUploadingClient(false)
    }
  }

  // Render

  return (
    <div className="space-y-4">
      {/* Preview modal */}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      {/* Mini timeline */}
      {isVisaJuvenil && overview && currentPhase && (
        <PhaseTimelineStrip overview={overview} onPhaseClick={handleScrollToPhase} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-gray-100">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg transition-colors ${
              tab === t.id ? 'bg-white text-gray-900 border border-b-0 border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Cargando caso...
        </div>
      )}

      {/* === DOCUMENTOS === */}
      {tab === 'docs' && !loading && overview && (
        <div className="space-y-3">
          {isVisaJuvenil ? (
            renderPhaseAccordions({
              phases: overview.phases,
              currentPhase,
              caseId,
              caseNumber,
              kind: 'client_uploads',
              onPreview: setPreviewDoc,
              uploading: uploadingClient,
              onUpload: handleClientDocUpload,
            })
          ) : (
            <PhaseEmptyState
              icon="folder_open"
              title="Sin sistema de fases"
              description="Este servicio no usa fases. Sube documentos sin restricción de fase."
            />
          )}
        </div>
      )}

      {/* === PARA EL CLIENTE === */}
      {tab === 'client-docs' && !loading && overview && (
        <div className="space-y-3">
          {isVisaJuvenil ? (
            renderPhaseAccordions({
              phases: overview.phases,
              currentPhase,
              caseId,
              caseNumber,
              kind: 'firm_documents',
              onPreview: setPreviewDoc,
            })
          ) : (
            <PhaseEmptyState
              icon="inventory_2"
              title="Sin documentos para el cliente"
              description="Diana sube aquí cartas y formularios cuando estén listos."
            />
          )}
        </div>
      )}

      {/* === FORMULARIOS === */}
      {tab === 'forms' && !loading && overview && (
        <div className="space-y-3">
          {overview.phases.map(group => (
            <PhaseAccordion
              key={group.phase}
              group={group}
              defaultOpen={group.phase === currentPhase}
              countLabel={`${group.counts.forms_total} formulario${group.counts.forms_total === 1 ? '' : 's'}`}
              headerActions={group.status === 'completed' ? (
                <ReopenPhaseButton
                  caseId={caseId}
                  caseNumber={caseNumber}
                  toPhase={group.phase as CasePhase}
                />
              ) : undefined}
            >
              <div className="space-y-4">
                {group.phase === 'i360' && (
                  <I360Section submission={formSubmissions.find(s => s.form_type === 'i360_sijs')} />
                )}
                <PhaseFormsList forms={group.forms} />
                {group.phase === 'custodia' && group.forms.length > 0 && (
                  <p className="text-[11px] text-gray-500 mt-2">
                    Para llenar/imprimir formularios de Fase 1, ve a la pestaña <strong>Radicación</strong>.
                  </p>
                )}
              </div>
            </PhaseAccordion>
          ))}
        </div>
      )}

      {/* === NOTAS === */}
      {tab === 'notas' && (
        <div className="space-y-3">
          {henryNotes ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-xs font-bold text-yellow-700 mb-2">Notas del Abogado</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{henryNotes}</p>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8 text-sm">Sin notas en este caso.</p>
          )}
        </div>
      )}

      {/* === HISTORIA === */}
      {tab === 'historia' && (
        <div className="space-y-3">
          <HistoryTab submissions={formSubmissions} />
        </div>
      )}

      {/* === RADICACIÓN === */}
      {tab === 'radicacion' && isVisaJuvenil && (
        <div className="space-y-3">
          <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 flex items-center gap-3">
            <span
              className="material-symbols-outlined text-purple-700"
              data-fill="1"
              style={{ fontSize: 22 }}
            >
              child_care
            </span>
            <div>
              <p className="text-xs font-bold text-purple-800 uppercase">Fase 1 — Custodia</p>
              <p className="text-[11px] text-purple-700">
                Detección de jurisdicción y formularios estatales para obtener la orden con hallazgos SIJS.
              </p>
            </div>
          </div>
          <JurisdictionPanel caseId={caseId} />
        </div>
      )}

      {/* === HISTÓRICO === */}
      {tab === 'historico' && isVisaJuvenil && (
        <PhaseHistoryTab caseId={caseId} />
      )}

      {/* === GENERADORES === */}
      {tab === 'generadores' && isVisaJuvenil && (
        <GeneratorsTab
          caseId={caseId}
          clientName={clientName}
          formSubmissions={formSubmissions}
          currentPhase={currentPhase}
        />
      )}

      {/* === Tabs extra (Mi Trabajo) === */}
      {extraTabs.find(t => t.id === tab) && (
        <div>{extraTabs.find(t => t.id === tab)?.content}</div>
      )}
    </div>
  )
}

// ───────────────────────── Helpers internos ─────────────────────────

function countTotalUploads(overview: CaseOverview | null, kind: 'client_uploads' | 'firm_documents'): number {
  if (!overview) return 0
  return overview.phases.reduce((acc, p) => acc + p.documents[kind].length, 0)
}

function countTotalForms(overview: CaseOverview | null): number {
  if (!overview) return 0
  return overview.phases.reduce((acc, p) => acc + p.forms.length, 0)
}

function renderPhaseAccordions({
  phases,
  currentPhase,
  caseId,
  caseNumber,
  kind,
  onPreview,
  uploading,
  onUpload,
}: {
  phases: PhaseGroup[]
  currentPhase: CasePhase | null
  caseId: string
  caseNumber: string
  kind: 'client_uploads' | 'firm_documents'
  onPreview: (doc: UploadFile) => void
  uploading?: boolean
  onUpload?: (file: File) => Promise<void>
}) {
  if (phases.length === 0) {
    return (
      <PhaseEmptyState
        icon="folder_open"
        title="Sin documentos"
        description="Aún no se han registrado documentos para este caso."
      />
    )
  }

  return phases.map(group => {
    const uploads = group.documents[kind]
    const isActive = group.phase === currentPhase
    const isCompleted = group.status === 'completed'
    const showUploadButton = isActive && kind === 'client_uploads' && onUpload

    return (
      <PhaseAccordion
        key={group.phase}
        group={group}
        defaultOpen={isActive}
        countLabel={`${uploads.length} archivo${uploads.length === 1 ? '' : 's'}`}
        headerActions={isCompleted ? (
          <ReopenPhaseButton caseId={caseId} caseNumber={caseNumber} toPhase={group.phase as CasePhase} />
        ) : undefined}
      >
        <div className="space-y-3">
          {showUploadButton && (
            <label
              className={`flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed rounded-xl cursor-pointer text-sm font-medium transition-colors ${
                uploading
                  ? 'opacity-50 cursor-not-allowed border-gray-200 text-gray-400'
                  : 'border-gray-300 text-gray-500 hover:border-[#F2A900] hover:text-[#9a6500]'
              }`}
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Subiendo...' : 'Subir Documento del Cliente'}
              <input
                type="file"
                accept="application/pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file && onUpload) await onUpload(file)
                }}
              />
            </label>
          )}
          {uploads.length > 0 ? (
            <PhaseDocumentList phase={group.phase} uploads={uploads} onPreview={onPreview} />
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">
              {isActive ? 'Aún no hay archivos en esta fase.' : 'Sin archivos en esta fase.'}
            </p>
          )}
        </div>
      </PhaseAccordion>
    )
  })
}

// ───────────────────────── PreviewModal ─────────────────────────

function PreviewModal({ doc, onClose }: { doc: UploadFile; onClose: () => void }) {
  const isPDF = doc.name.toLowerCase().endsWith('.pdf')
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <p className="font-bold text-gray-900 truncate flex-1">{doc.name}</p>
          <div className="flex items-center gap-2 ml-3">
            <a
              href={`/api/employee/download-case-doc?id=${doc.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline">
                <Download className="w-3 h-3 mr-1" /> Descargar
              </Button>
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-gray-100">
          {isPDF ? (
            <iframe src={`/api/employee/download-case-doc?id=${doc.id}`} className="w-full h-[75vh]" title={doc.name} />
          ) : (
            <div className="flex items-center justify-center h-[50vh]">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Vista previa no disponible</p>
                <a
                  href={`/api/employee/download-case-doc?id=${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#F2A900] hover:underline mt-2 inline-block"
                >
                  Descargar
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── HistoryTab ─────────────────────────

function HistoryTab({ submissions }: { submissions: FormSub[] }) {
  const filtered = submissions.filter(s =>
    ['tutor_guardian', 'client_story', 'client_witnesses', 'client_absent_parent'].includes(s.form_type)
  )

  if (filtered.length === 0) {
    return <p className="text-center text-gray-400 py-8 text-sm">El cliente no ha llenado la historia.</p>
  }

  const labels: Record<string, string> = {
    tutor_guardian: 'Declaración del Tutor',
    client_story: 'Historia del Menor',
    client_witnesses: 'Testigos',
    client_absent_parent: 'Padre Ausente',
  }

  return (
    <div className="space-y-3">
      {filtered.map((sub, i) => {
        const idx = sub.minor_index ?? 0
        const label = ['client_story', 'client_absent_parent'].includes(sub.form_type)
          ? `${labels[sub.form_type]} ${idx + 1}`
          : labels[sub.form_type] ?? sub.form_type
        return <FormSection key={sub.form_type + idx + i} title={label} status={sub.status} data={sub.form_data} />
      })}
    </div>
  )
}

function FormSection({ title, status, data }: { title: string; status: string; data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)
  const entries = Object.entries(data ?? {})
  const statusBadge =
    status === 'submitted' ? 'bg-emerald-100 text-emerald-700' :
    status === 'approved' ? 'bg-blue-100 text-blue-700' :
    'bg-gray-100 text-gray-600'

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <FileText className="w-4 h-4 text-gray-500" />
        <span className="flex-1 text-sm font-semibold text-gray-900">{title}</span>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadge}`}>
          {status}
        </span>
      </button>
      {expanded && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {entries.map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] font-bold uppercase text-gray-400">{k}</p>
              <p className="text-gray-800 break-words">{formatValue(v)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatValue(v: unknown): string {
  if (v == null || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ───────────────────────── GeneratorsTab ─────────────────────────

function GeneratorsTab({
  caseId,
  clientName,
  formSubmissions,
  currentPhase,
}: {
  caseId: string
  clientName: string
  formSubmissions: FormSub[]
  currentPhase: CasePhase | null
}) {
  const tutorData = formSubmissions.find(s => s.form_type === 'tutor_guardian')?.form_data ?? null
  const minorStories = formSubmissions
    .filter(s => s.form_type === 'client_story')
    .sort((a, b) => (a.minor_index || 0) - (b.minor_index || 0))
    .map(s => ({ minorIndex: s.minor_index || 0, formData: s.form_data }))
  const absentParents = formSubmissions
    .filter(s => s.form_type === 'client_absent_parent')
    .sort((a, b) => (a.minor_index || 0) - (b.minor_index || 0))
    .map(s => ({ formData: s.form_data }))

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 flex items-center gap-3">
        <span
          className="material-symbols-outlined text-purple-700"
          data-fill="1"
          style={{ fontSize: 22 }}
        >
          auto_awesome
        </span>
        <div>
          <p className="text-xs font-bold text-purple-800 uppercase">Generadores de Fase 1 — Custodia</p>
          <p className="text-[11px] text-purple-700">
            Crea declaraciones, consentimientos y peticiones a partir de la información del cliente.
          </p>
        </div>
      </div>

      <SupplementaryDataForm
        caseId={caseId}
        tutorData={tutorData}
        minorStories={minorStories}
        absentParents={absentParents}
      />

      <ParentalConsentGenerator caseId={caseId} clientName={clientName} />

      <DeclarationGenerator
        caseId={caseId}
        clientName={clientName}
        tutorData={tutorData}
        minorStories={minorStories}
      />

      {currentPhase && currentPhase !== 'custodia' && (
        <p className="text-[11px] text-gray-500 italic">
          Estos generadores son de Fase 1 (Custodia). El caso ya avanzó a {currentPhase.toUpperCase()}, pero puedes seguir generando documentación si necesitas.
        </p>
      )}
    </div>
  )
}

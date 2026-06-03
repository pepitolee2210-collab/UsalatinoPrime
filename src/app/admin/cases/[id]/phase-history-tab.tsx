'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, FileText, FileCheck, Clock } from 'lucide-react'
import type { CasePhase } from '@/types/database'

interface HistoryEntry {
  id: string
  from_phase: CasePhase | null
  to_phase: CasePhase
  changed_at: string
  reason: string | null
  changed_by_name: string | null
}

interface DocumentEntry {
  id: string
  name: string
  file_type: string | null
  file_size: number | null
  status: string
  uploaded_at: string
  document_type_name_es: string | null
  category_name_es: string | null
  slot_label: string | null
}

interface FormEntry {
  id: string
  form_name: string
  status: string
  client_submitted_at: string | null
  filled_pdf_path: string | null
  filled_pdf_generated_at: string | null
  total_filled_keys: number
}

interface PhaseHistoryTabProps {
  caseId: string
}

const PHASE_LABEL: Record<CasePhase, string> = {
  custodia: 'Custodia',
  i360: 'I-360',
  i485: 'I-485',
  completado: 'Completado',
  asilo_sustentos: 'Sustentos',
  asilo_reforzar: 'Reforzar Asilo',
  asilo_completado: 'Completado',
  apelacion: 'Apelación',
  cambio_de_corte: 'Cambio de Corte',
}

const PHASE_COLOR: Record<CasePhase, string> = {
  custodia: 'bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]',
  i360: 'bg-[var(--admin-blue-soft)] text-[var(--admin-blue-on)]',
  i485: 'bg-[var(--admin-green-soft)] text-[var(--admin-green-on)]',
  completado: 'bg-[var(--admin-gold-soft)] text-[var(--admin-gold-on)]',
  asilo_sustentos: 'bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]',
  asilo_reforzar: 'bg-[var(--admin-blue-soft)] text-[var(--admin-blue-on)]',
  asilo_completado: 'bg-[var(--admin-gold-soft)] text-[var(--admin-gold-on)]',
  apelacion: 'bg-[var(--admin-red-soft)] text-[var(--admin-red-on)]',
  cambio_de_corte: 'bg-[var(--admin-blue-soft)] text-[var(--admin-blue-on)]',
}

export function PhaseHistoryTab({ caseId }: PhaseHistoryTabProps) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [expanded, setExpanded] = useState<CasePhase | null>(null)
  const [phaseData, setPhaseData] = useState<Record<string, { documents: DocumentEntry[]; forms: FormEntry[] } | null>>({})
  const [loadingPhase, setLoadingPhase] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/cases/${caseId}/phase-history`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setHistory(j.history ?? []))
      .catch(() => setHistory([]))
  }, [caseId])

  async function togglePhase(phase: CasePhase) {
    if (expanded === phase) {
      setExpanded(null)
      return
    }
    setExpanded(phase)
    if (!phaseData[phase]) {
      setLoadingPhase(phase)
      try {
        const res = await fetch(`/api/admin/cases/${caseId}/historical-documents?phase=${phase}`, { cache: 'no-store' })
        const j = await res.json()
        setPhaseData((prev) => ({ ...prev, [phase]: { documents: j.documents ?? [], forms: j.forms ?? [] } }))
      } catch {
        setPhaseData((prev) => ({ ...prev, [phase]: { documents: [], forms: [] } }))
      } finally {
        setLoadingPhase(null)
      }
    }
  }

  if (history === null) {
    return (
      <div className="p-8 text-center text-[var(--admin-fg-muted)]">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--admin-border-strong)] p-8 text-center">
        <Clock className="w-10 h-10 text-[var(--admin-fg-subtle)] mx-auto mb-2" />
        <p className="text-sm font-semibold text-[var(--admin-fg)]">Sin cambios de fase registrados</p>
        <p className="text-xs text-[var(--admin-fg-muted)] mt-1">Cuando avances de fase a este caso, los cambios aparecerán aquí.</p>
      </div>
    )
  }

  // Lista única de fases pasadas (excluye fase inicial sin from_phase)
  const pastPhases = Array.from(new Set(history.map((h) => h.from_phase).filter(Boolean))) as CasePhase[]

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-sm font-bold text-[var(--admin-fg)] mb-3">Línea de tiempo de cambios</h3>
        <ol className="relative pl-6 space-y-3 border-l-2 border-[var(--admin-border)]">
          {history.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-[var(--admin-accent)] border-2 border-[var(--admin-bg-elev)]" />
              <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg-elev)] p-3">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {h.from_phase ? (
                      <>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${PHASE_COLOR[h.from_phase]}`}>
                          {PHASE_LABEL[h.from_phase]}
                        </span>
                        <span className="text-[var(--admin-fg-subtle)] text-xs">→</span>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold text-[var(--admin-fg-muted)] uppercase">Asignación inicial</span>
                    )}
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${PHASE_COLOR[h.to_phase]}`}>
                      {PHASE_LABEL[h.to_phase]}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--admin-fg-muted)]">
                    {format(new Date(h.changed_at), "d 'de' MMM yyyy 'a las' HH:mm", { locale: es })}
                  </span>
                </div>
                {h.changed_by_name && (
                  <p className="text-[11px] text-[var(--admin-fg-muted)] mt-1">
                    Por <strong>{h.changed_by_name}</strong>
                  </p>
                )}
                {h.reason && (
                  <p className="text-xs text-[var(--admin-fg)] mt-1.5 italic">&quot;{h.reason}&quot;</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {pastPhases.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-[var(--admin-fg)] mb-3 mt-6">Documentos archivados por fase</h3>
          <div className="space-y-2">
            {pastPhases.map((phase) => {
              const isExpanded = expanded === phase
              const data = phaseData[phase]
              return (
                <div key={phase} className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg-elev)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => togglePhase(phase)}
                    className="w-full flex items-center justify-between p-3 hover:bg-[var(--admin-veil-1)] text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${PHASE_COLOR[phase]}`}>
                        {PHASE_LABEL[phase]}
                      </span>
                      {data && (
                        <span className="text-xs text-[var(--admin-fg-muted)]">
                          {data.documents.length} docs · {data.forms.length} formularios
                        </span>
                      )}
                    </div>
                    <span className="text-[var(--admin-fg-subtle)] text-sm">{isExpanded ? '−' : '+'}</span>
                  </button>
                  {isExpanded && (
                    <div className="p-3 border-t border-[var(--admin-border)] space-y-3">
                      {loadingPhase === phase ? (
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--admin-fg-subtle)] mx-auto" />
                      ) : data ? (
                        <>
                          {data.documents.length === 0 && data.forms.length === 0 && (
                            <p className="text-xs text-[var(--admin-fg-muted)] text-center py-2">
                              No hay archivos registrados en esta fase.
                            </p>
                          )}
                          {data.documents.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold uppercase text-[var(--admin-fg-muted)] mb-1.5">Documentos del cliente</p>
                              <ul className="space-y-1">
                                {data.documents.map((d) => (
                                  <li key={d.id} className="flex items-center gap-2 text-xs">
                                    <FileText className="w-3.5 h-3.5 text-[var(--admin-fg-subtle)]" />
                                    <span className="flex-1 truncate">
                                      {d.document_type_name_es || d.name}
                                      {d.slot_label && <span className="text-[var(--admin-fg-subtle)]"> · {d.slot_label}</span>}
                                    </span>
                                    <span className="text-[10px] text-[var(--admin-fg-subtle)]">{d.status}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {data.forms.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold uppercase text-[var(--admin-fg-muted)] mb-1.5 mt-2">Formularios oficiales</p>
                              <ul className="space-y-1">
                                {data.forms.map((f) => (
                                  <li key={f.id} className="flex items-center gap-2 text-xs">
                                    <FileCheck className="w-3.5 h-3.5 text-[var(--admin-fg-subtle)]" />
                                    <span className="flex-1 truncate">{f.form_name}</span>
                                    <span className="text-[10px] text-[var(--admin-fg-subtle)]">{f.status} · {f.total_filled_keys} campos</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

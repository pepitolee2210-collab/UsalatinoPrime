'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarCheck, FileUp, BookOpen, FileText, Download, UserCheck, ClipboardList, Scale,
  Check, Loader2, Lock,
} from 'lucide-react'

interface PipelineProps {
  caseId: string
  hasAppointment: boolean
  hasDocuments: boolean
  hasHistory: boolean
  hasDeclarations: boolean
  hasClientDocs: boolean
  hasI360: boolean
  manualStages: { henry_reviewed: boolean; presented_to_court: boolean }
  canEdit: boolean
}

const STAGES = [
  { key: 'appointment', label: 'Cita Agendada', icon: CalendarCheck, auto: true },
  { key: 'documents', label: 'Documentos Subidos', icon: FileUp, auto: true },
  { key: 'history', label: 'Historia Completada', icon: BookOpen, auto: true },
  { key: 'declarations', label: 'Declaraciones Generadas', icon: FileText, auto: true },
  { key: 'client_docs', label: 'Docs Enviados al Cliente', icon: Download, auto: true },
  { key: 'henry_reviewed', label: 'Revisión Henry', icon: UserCheck, auto: false },
  { key: 'i360', label: 'Formulario I-360', icon: ClipboardList, auto: true },
  { key: 'presented_to_court', label: 'Presentado ante Corte', icon: Scale, auto: false },
]

export function CasePipeline({ caseId, hasAppointment, hasDocuments, hasHistory, hasDeclarations, hasClientDocs, hasI360, manualStages, canEdit }: PipelineProps) {
  const [manual, setManual] = useState(manualStages)
  const [saving, setSaving] = useState<string | null>(null)

  function isComplete(key: string): boolean {
    switch (key) {
      case 'appointment': return hasAppointment
      case 'documents': return hasDocuments
      case 'history': return hasHistory
      case 'declarations': return hasDeclarations
      case 'client_docs': return hasClientDocs
      case 'henry_reviewed': return manual.henry_reviewed
      case 'i360': return hasI360
      case 'presented_to_court': return manual.presented_to_court
      default: return false
    }
  }

  const completedCount = STAGES.filter(s => isComplete(s.key)).length
  const progress = (completedCount / STAGES.length) * 100

  async function toggleManual(key: 'henry_reviewed' | 'presented_to_court') {
    const newValue = !manual[key]
    setSaving(key)
    try {
      const res = await fetch('/api/cases/pipeline-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, [key]: newValue }),
      })
      if (!res.ok) throw new Error()
      setManual(prev => ({ ...prev, [key]: newValue }))
      toast.success(newValue ? 'Etapa completada' : 'Etapa desmarcada')
    } catch {
      toast.error('Error al actualizar')
    }
    setSaving(null)
  }

  const currentStageIdx = STAGES.findIndex(s => !isComplete(s.key))

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border)',
        boxShadow: 'var(--admin-shadow)',
      }}
    >
      {/* Ambient glow (sutil — usa tokens accent + blue) */}
      <div
        className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--admin-gold) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--admin-blue) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p
              className="text-[10px] font-bold uppercase"
              style={{
                color: 'var(--admin-gold)',
                letterSpacing: '0.2em',
                fontFamily: 'var(--font-mono-tech)',
              }}
            >
              Pipeline del Caso
            </p>
            <p
              className="text-lg font-black mt-0.5"
              style={{ color: 'var(--admin-fg)' }}
            >
              {completedCount} de {STAGES.length} etapas
            </p>
          </div>
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="var(--admin-border)" strokeWidth="4" />
              <circle
                cx="28" cy="28" r="24" fill="none"
                stroke="url(#progressGrad)" strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${progress * 1.508} 150.8`}
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
              <defs>
                <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--admin-gold)" />
                  <stop offset="100%" stopColor="var(--admin-blue)" />
                </linearGradient>
              </defs>
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center text-sm font-black"
              style={{ color: 'var(--admin-fg)' }}
            >
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="h-1.5 rounded-full mb-5 overflow-hidden"
          style={{ background: 'var(--admin-bg-deep)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.max(progress, 2)}%`,
              background: 'linear-gradient(90deg, var(--admin-gold), var(--admin-blue))',
            }}
          />
        </div>

        {/* Stages */}
        <div className="space-y-1.5">
          {STAGES.map((stage, i) => {
            const done = isComplete(stage.key)
            const isCurrent = i === currentStageIdx
            const isManual = !stage.auto
            const isSavingThis = saving === stage.key
            const Icon = stage.icon

            return (
              <div
                key={stage.key}
                className="group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300"
                style={{
                  background: done
                    ? 'var(--admin-accent-soft)'
                    : isCurrent
                      ? 'var(--admin-blue-soft)'
                      : 'transparent',
                  border: isCurrent ? '0.5px solid var(--admin-blue)' : '0.5px solid transparent',
                  opacity: !done && !isCurrent ? 0.55 : 1,
                }}
              >
                {/* Connector line */}
                {i < STAGES.length - 1 && (
                  <div
                    className="absolute left-[1.65rem] top-[2.75rem] w-0.5 h-3 transition-colors duration-500"
                    style={{
                      background: done ? 'var(--admin-gold)' : 'var(--admin-border)',
                      opacity: done ? 0.6 : 1,
                    }}
                  />
                )}

                {/* Status indicator */}
                <div
                  className="relative flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500"
                  style={{
                    background: done
                      ? 'linear-gradient(135deg, var(--admin-gold), var(--admin-blue))'
                      : isCurrent
                        ? 'var(--admin-blue-soft)'
                        : 'var(--admin-accent-soft)',
                    border: done
                      ? 'none'
                      : isCurrent
                        ? '0.5px solid var(--admin-blue)'
                        : '0.5px solid var(--admin-border)',
                    boxShadow: done ? '0 0 20px var(--admin-accent-glow)' : 'none',
                  }}
                >
                  {isSavingThis ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#FFFFFF' }} />
                  ) : done ? (
                    <Check className="w-4 h-4" strokeWidth={3} style={{ color: '#FFFFFF' }} />
                  ) : (
                    <Icon
                      className="w-4 h-4"
                      style={{ color: isCurrent ? 'var(--admin-blue)' : 'var(--admin-fg-muted)' }}
                    />
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold transition-colors"
                    style={{
                      color: done || isCurrent ? 'var(--admin-fg)' : 'var(--admin-fg-muted)',
                    }}
                  >
                    {stage.label}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-[9px] font-medium tracking-wider uppercase"
                      style={{
                        color: done
                          ? stage.auto ? 'var(--admin-green)' : 'var(--admin-gold)'
                          : 'var(--admin-fg-subtle)',
                        fontFamily: 'var(--font-mono-tech)',
                        letterSpacing: '0.15em',
                      }}
                    >
                      {done ? (stage.auto ? 'Completado' : 'Marcado') : (stage.auto ? 'Automático' : 'Manual')}
                    </span>
                  </div>
                </div>

                {/* Toggle for manual stages */}
                {isManual && canEdit && (
                  <button
                    onClick={() => toggleManual(stage.key as 'henry_reviewed' | 'presented_to_court')}
                    disabled={isSavingThis}
                    className="flex-shrink-0 w-10 h-6 rounded-full transition-all duration-300"
                    style={{
                      background: done
                        ? 'linear-gradient(135deg, var(--admin-gold), var(--admin-blue))'
                        : 'var(--admin-accent-soft)',
                      border: done ? 'none' : '0.5px solid var(--admin-border-strong)',
                    }}
                  >
                    <div
                      className={`rounded-full shadow-md transition-all duration-300 mt-[3px] ${
                        done ? 'ml-[22px]' : 'ml-[3px]'
                      }`}
                      style={{ width: '18px', height: '18px', background: '#FFFFFF' }}
                    />
                  </button>
                )}
                {isManual && !canEdit && (
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--admin-fg-subtle)' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

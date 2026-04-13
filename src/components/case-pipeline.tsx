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
  { key: 'appointment', label: 'Cita Agendada', icon: CalendarCheck, auto: true, color: 'from-blue-500 to-cyan-400' },
  { key: 'documents', label: 'Documentos Subidos', icon: FileUp, auto: true, color: 'from-cyan-400 to-teal-400' },
  { key: 'history', label: 'Historia Completada', icon: BookOpen, auto: true, color: 'from-teal-400 to-emerald-400' },
  { key: 'declarations', label: 'Declaraciones Generadas', icon: FileText, auto: true, color: 'from-emerald-400 to-green-400' },
  { key: 'client_docs', label: 'Docs Enviados al Cliente', icon: Download, auto: true, color: 'from-green-400 to-lime-400' },
  { key: 'henry_reviewed', label: 'Revisión Henry', icon: UserCheck, auto: false, color: 'from-lime-400 to-yellow-400' },
  { key: 'i360', label: 'Formulario I-360', icon: ClipboardList, auto: true, color: 'from-yellow-400 to-amber-400' },
  { key: 'presented_to_court', label: 'Presentado ante Corte', icon: Scale, auto: false, color: 'from-amber-400 to-orange-500' },
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
    <div className="relative overflow-hidden rounded-2xl border border-white/10"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)' }}>

      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #F2A900 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #22d3ee 0%, transparent 70%)' }} />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: '#F2A900' }}>Pipeline del Caso</p>
            <p className="text-lg font-black text-white mt-0.5">{completedCount} de {STAGES.length} etapas</p>
          </div>
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
              <circle cx="28" cy="28" r="24" fill="none" stroke="url(#progressGrad)" strokeWidth="4"
                strokeLinecap="round" strokeDasharray={`${progress * 1.508} 150.8`}
                style={{ transition: 'stroke-dasharray 0.6s ease' }} />
              <defs>
                <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F2A900" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-white/10 mb-5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(progress, 2)}%`, background: 'linear-gradient(90deg, #F2A900, #22d3ee)' }} />
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
              <div key={stage.key}
                className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300 ${
                  done ? 'bg-white/[0.08]' : isCurrent ? 'bg-white/[0.05] ring-1 ring-white/20' : 'bg-transparent opacity-50'
                }`}
                style={isCurrent ? { animation: 'pulseGlow 2s ease-in-out infinite' } : undefined}
              >
                {/* Connector line */}
                {i < STAGES.length - 1 && (
                  <div className={`absolute left-[1.65rem] top-[2.75rem] w-0.5 h-3 transition-colors duration-500 ${
                    done ? 'bg-gradient-to-b ' + stage.color : 'bg-white/10'
                  }`} style={{ opacity: done ? 0.6 : 1 }} />
                )}

                {/* Status indicator */}
                <div className={`relative flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${
                  done ? 'bg-gradient-to-br ' + stage.color + ' shadow-lg' : isCurrent ? 'bg-white/10 ring-1 ring-white/30' : 'bg-white/5'
                }`}
                  style={done ? { boxShadow: '0 0 20px rgba(242, 169, 0, 0.15)' } : undefined}>
                  {isSavingThis ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : done ? (
                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                  ) : (
                    <Icon className={`w-4 h-4 ${isCurrent ? 'text-white/80' : 'text-white/30'}`} />
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold transition-colors ${done ? 'text-white' : isCurrent ? 'text-white/80' : 'text-white/40'}`}>
                    {stage.label}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {stage.auto ? (
                      <span className={`text-[9px] font-medium tracking-wider uppercase ${done ? 'text-emerald-400' : 'text-white/20'}`}>
                        {done ? 'Completado' : 'Automático'}
                      </span>
                    ) : (
                      <span className={`text-[9px] font-medium tracking-wider uppercase ${done ? 'text-amber-400' : 'text-white/20'}`}>
                        {done ? 'Marcado' : 'Manual'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Toggle for manual stages */}
                {isManual && canEdit && (
                  <button
                    onClick={() => toggleManual(stage.key as 'henry_reviewed' | 'presented_to_court')}
                    disabled={isSavingThis}
                    className={`flex-shrink-0 w-10 h-6 rounded-full transition-all duration-300 ${
                      done ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-white/10 hover:bg-white/20'
                    }`}>
                    <div className={`rounded-full bg-white shadow-md transition-all duration-300 mt-[3px] ${
                      done ? 'ml-[22px]' : 'ml-[3px]'
                    }`} style={{ width: '18px', height: '18px' }} />
                  </button>
                )}
                {isManual && !canEdit && (
                  <Lock className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: inset 0 0 0 0 rgba(242, 169, 0, 0); }
          50% { box-shadow: inset 0 0 30px 0 rgba(242, 169, 0, 0.03); }
        }
      `}</style>
    </div>
  )
}

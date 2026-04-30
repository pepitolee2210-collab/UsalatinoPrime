'use client'

import { PHASE_TOKENS, formatCompletedAt } from './phase-tokens'
import type { CaseOverview } from './phase-types'
import type { CasePhase } from '@/types/database'

interface PhaseTimelineStripProps {
  overview: CaseOverview
  onPhaseClick?: (phase: CasePhase) => void
}

const TIMELINE_PHASES: CasePhase[] = ['custodia', 'i360', 'i485', 'completado']

export function PhaseTimelineStrip({ overview, onPhaseClick }: PhaseTimelineStripProps) {
  const current = overview.case.current_phase
  if (!current) return null

  const currentIdx = TIMELINE_PHASES.indexOf(current)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Recorrido del caso</p>
      <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
        {TIMELINE_PHASES.map((phase, idx) => {
          const tokens = PHASE_TOKENS[phase]
          const phaseGroup = overview.phases.find(p => p.phase === phase)
          const isCompleted = idx < currentIdx
          const isActive = idx === currentIdx
          const isFuture = idx > currentIdx

          const dotColor = isCompleted
            ? 'bg-emerald-500 ring-emerald-200'
            : isActive
            ? `${tokens.dot} ring-amber-200 animate-pulse`
            : 'bg-gray-300 ring-gray-100'

          const labelColor = isCompleted || isActive ? 'text-gray-900' : 'text-gray-400'
          const subColor = isCompleted ? 'text-emerald-700' : isActive ? 'text-amber-700' : 'text-gray-400'

          return (
            <li key={phase} className="flex items-center flex-1 min-w-[110px]">
              <button
                type="button"
                onClick={() => onPhaseClick?.(phase)}
                disabled={isFuture}
                className={`flex flex-col items-center gap-1 group ${isFuture ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                title={tokens.label}
              >
                <span className={`w-3 h-3 rounded-full ring-4 ${dotColor}`} />
                <span className={`text-[11px] font-bold ${labelColor}`}>{tokens.shortLabel}</span>
                <span className={`text-[10px] ${subColor}`}>
                  {isCompleted && phaseGroup?.completed_at
                    ? formatCompletedAt(phaseGroup.completed_at)
                    : isActive
                    ? 'En curso'
                    : isFuture
                    ? '—'
                    : ''}
                </span>
              </button>
              {idx < TIMELINE_PHASES.length - 1 && (
                <span
                  className={`flex-1 h-0.5 mx-1 sm:mx-2 ${isCompleted ? 'bg-emerald-300' : 'bg-gray-200'}`}
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

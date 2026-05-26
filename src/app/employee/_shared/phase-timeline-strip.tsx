'use client'

import { PHASE_TOKENS, formatCompletedAt } from './phase-tokens'
import type { CaseOverview } from './phase-types'
import type { CasePhase } from '@/types/database'
import { getServicePhases } from '@/lib/services/registry'

interface PhaseTimelineStripProps {
  overview: CaseOverview
  /**
   * Slug del servicio del caso. Se usa para resolver las fases visibles via
   * getServicePhases (registry). Default a 'visa-juvenil' por si algún caller
   * legacy lo omite — preserva el comportamiento SIJS.
   */
  serviceSlug?: string | null
  onPhaseClick?: (phase: CasePhase) => void
}

export function PhaseTimelineStrip({ overview, serviceSlug = 'visa-juvenil', onPhaseClick }: PhaseTimelineStripProps) {
  const current = overview.case.current_phase
  if (!current) return null

  const timelinePhases = getServicePhases(serviceSlug).map((p) => p.code)
  if (timelinePhases.length === 0) return null

  const currentIdx = timelinePhases.indexOf(current)

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border-strong)',
        boxShadow: 'var(--admin-shadow)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: 'var(--admin-fg-subtle)',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Recorrido del caso
      </p>
      <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
        {timelinePhases.map((phase, idx) => {
          const tokens = PHASE_TOKENS[phase]
          const phaseGroup = overview.phases.find(p => p.phase === phase)
          const isCompleted = idx < currentIdx
          const isActive = idx === currentIdx
          const isFuture = idx > currentIdx

          const dotColor = isCompleted
            ? 'var(--admin-green)'
            : isActive
            ? 'var(--admin-gold)'
            : 'var(--admin-fg-faint)'
          const ringColor = isCompleted
            ? 'var(--admin-green-soft)'
            : isActive
            ? 'var(--admin-gold-soft)'
            : 'var(--admin-bg-elev-2)'

          const labelColor = isCompleted || isActive ? 'var(--admin-fg)' : 'var(--admin-fg-subtle)'
          const subColor = isCompleted
            ? 'var(--admin-green)'
            : isActive
            ? 'var(--admin-gold)'
            : 'var(--admin-fg-subtle)'

          return (
            <li key={phase} className="flex items-center flex-1 min-w-[110px]">
              <button
                type="button"
                onClick={() => onPhaseClick?.(phase)}
                disabled={isFuture}
                className="flex flex-col items-center gap-1 group transition-opacity"
                style={{
                  cursor: isFuture ? 'not-allowed' : 'pointer',
                  opacity: isFuture ? 0.7 : 1,
                }}
                title={tokens.label}
              >
                <span
                  className="rounded-full"
                  style={{
                    width: 12,
                    height: 12,
                    background: dotColor,
                    boxShadow: `0 0 0 4px ${ringColor}`,
                    animation: isActive ? 'ulp-glow 2.5s ease-in-out infinite' : undefined,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: labelColor,
                  }}
                >
                  {tokens.shortLabel}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    color: subColor,
                    letterSpacing: '0.04em',
                  }}
                >
                  {isCompleted && phaseGroup?.completed_at
                    ? formatCompletedAt(phaseGroup.completed_at)
                    : isActive
                    ? 'En curso'
                    : isFuture
                    ? '—'
                    : ''}
                </span>
              </button>
              {idx < timelinePhases.length - 1 && (
                <span
                  className="flex-1 mx-1 sm:mx-2"
                  style={{
                    height: 2,
                    background: isCompleted ? 'var(--admin-green)' : 'var(--admin-border-strong)',
                    opacity: isCompleted ? 0.6 : 1,
                  }}
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

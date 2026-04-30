'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PHASE_TOKENS, STATUS_BADGE, formatCompletedAt } from './phase-tokens'
import type { PhaseGroup } from './phase-types'

interface PhaseAccordionProps {
  group: PhaseGroup
  defaultOpen?: boolean
  /** Conteo personalizado a la derecha del header (ej: "4 archivos"). */
  countLabel?: string
  /** Acciones en la cabecera, ej: botón Reabrir fase. */
  headerActions?: React.ReactNode
  children: React.ReactNode
}

export function PhaseAccordion({
  group,
  defaultOpen = false,
  countLabel,
  headerActions,
  children,
}: PhaseAccordionProps) {
  const tokens = PHASE_TOKENS[group.phase]
  const status = STATUS_BADGE[group.status]
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section
      id={`phase-section-${group.phase}`}
      className={`rounded-2xl border ${tokens.border} ${tokens.bg} overflow-hidden`}
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          aria-expanded={open}
        >
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tokens.bgSoft}`}
          >
            <span
              className={`material-symbols-outlined ${tokens.text}`}
              data-fill="1"
              style={{ fontSize: 22 }}
            >
              {tokens.icon}
            </span>
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-sm font-bold ${tokens.text}`}>{tokens.label}</p>
              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${status.className}`}>
                {status.label}
              </span>
              {countLabel && (
                <span className="text-[11px] text-gray-600 bg-white/70 px-2 py-0.5 rounded-full">
                  {countLabel}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-600 mt-0.5 truncate">
              {group.status === 'completed' && group.completed_at
                ? `Completada el ${formatCompletedAt(group.completed_at)}${group.completed_by_name ? ` por ${group.completed_by_name}` : ''}`
                : tokens.description}
            </p>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {headerActions && (
          <div className="flex items-center gap-2 flex-shrink-0">{headerActions}</div>
        )}
      </header>
      {open && (
        <div className="bg-white border-t border-gray-100 px-4 py-4">
          {children}
        </div>
      )}
    </section>
  )
}

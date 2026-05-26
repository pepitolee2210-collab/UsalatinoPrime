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
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border-strong)',
        boxShadow: 'var(--admin-shadow)',
      }}
    >
      <header
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: 'var(--admin-bg-elev)' }}
      >
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
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-fg)' }}>{tokens.label}</p>
              <span
                className={`px-2 py-0.5 rounded-full ${status.className}`}
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {status.label}
              </span>
              {countLabel && (
                <span
                  className="px-2 py-0.5 rounded-full"
                  style={{
                    background: 'var(--admin-bg-deep)',
                    color: 'var(--admin-fg-muted)',
                    border: '0.5px solid var(--admin-border-strong)',
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    letterSpacing: '0.04em',
                  }}
                >
                  {countLabel}
                </span>
              )}
            </div>
            <p
              className="truncate"
              style={{ fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 2 }}
            >
              {group.status === 'completed' && group.completed_at
                ? `Completada el ${formatCompletedAt(group.completed_at)}${group.completed_by_name ? ` por ${group.completed_by_name}` : ''}`
                : tokens.description}
            </p>
          </div>
          <ChevronDown
            className={`w-5 h-5 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--admin-fg-muted)' }}
            aria-hidden
          />
        </button>
        {headerActions && (
          <div className="flex items-center gap-2 flex-shrink-0">{headerActions}</div>
        )}
      </header>
      {open && (
        <div
          className="px-4 py-4"
          style={{
            background: 'var(--admin-bg-elev-2)',
            borderTop: '0.5px solid var(--admin-border)',
          }}
        >
          {children}
        </div>
      )}
    </section>
  )
}

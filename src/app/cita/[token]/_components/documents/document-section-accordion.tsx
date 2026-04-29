'use client'

import { useState, type ReactNode } from 'react'
import type { CategoryGroup } from './types'

interface DocumentSectionAccordionProps {
  category: CategoryGroup
  defaultOpen?: boolean
  children: ReactNode
}

export function DocumentSectionAccordion({
  category,
  defaultOpen = false,
  children,
}: DocumentSectionAccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const isComplete = category.total_required > 0 && category.total_completed === category.total_required

  return (
    <section
      className="rounded-2xl border overflow-hidden"
      style={{
        background: 'var(--color-ulp-surface-container-lowest)',
        borderColor: 'var(--color-ulp-outline-variant)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--color-ulp-primary-fixed)' }}
        >
          <span
            className="material-symbols-outlined"
            data-fill="1"
            style={{ fontSize: 22, color: 'var(--color-ulp-primary)' }}
          >
            {category.icon || 'folder'}
          </span>
        </span>
        <div className="flex-1 min-w-0">
          <p className="ulp-body-md font-semibold" style={{ color: 'var(--color-ulp-on-surface)' }}>
            {category.name_es}
          </p>
          <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            {category.total_completed} de {category.total_required} completados
          </p>
        </div>
        {isComplete && (
          <span
            className="material-symbols-outlined flex-shrink-0"
            data-fill="1"
            style={{ fontSize: 22, color: 'var(--color-ulp-status-approved)' }}
          >
            check_circle
          </span>
        )}
        <span
          className="material-symbols-outlined transition-transform flex-shrink-0"
          style={{
            fontSize: 20,
            color: 'var(--color-ulp-outline)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div
          className="p-4 pt-0 space-y-3 border-t"
          style={{ borderColor: 'var(--color-ulp-outline-variant)' }}
        >
          <div className="pt-3 space-y-3">{children}</div>
        </div>
      )}
    </section>
  )
}

'use client'

import type { FormSummary } from './types'

interface FormCardProps {
  form: FormSummary
  onOpen: () => void
}

export function FormCard({ form, onOpen }: FormCardProps) {
  const isComplete = form.pct === 100
  const isLocked = form.locked_for_client
  const isSubmitted = form.client_submitted_at != null

  let cta = 'Comenzar'
  let ctaIcon = 'arrow_forward'
  let statusBadge: { label: string; bg: string; color: string } | null = null

  if (form.completed_user_fields > 0 && form.completed_user_fields < form.total_user_fields) {
    cta = 'Continuar'
  }
  if (isComplete && !isSubmitted) {
    cta = 'Revisar y enviar'
    ctaIcon = 'send'
  }
  if (isSubmitted) {
    cta = 'Ver enviado'
    ctaIcon = 'visibility'
    statusBadge = { label: 'Enviado', bg: 'rgb(236 253 245)', color: 'rgb(4 120 87)' }
  }
  if (isLocked) {
    cta = 'Bloqueado'
    ctaIcon = 'lock'
    statusBadge = { label: 'Bloqueado', bg: 'rgb(243 244 246)', color: 'rgb(107 114 128)' }
  }

  return (
    <article
      className="rounded-2xl border p-5 flex flex-col gap-3 transition-shadow hover:shadow-md"
      style={{
        background: 'var(--color-ulp-surface-container-lowest)',
        borderColor: 'var(--color-ulp-outline-variant)',
      }}
    >
      <header className="flex items-start gap-3">
        <span
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--color-ulp-primary-fixed)' }}
        >
          <span
            className="material-symbols-outlined"
            data-fill="1"
            style={{ fontSize: 24, color: 'var(--color-ulp-primary)' }}
          >
            {form.icon}
          </span>
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="ulp-body-md font-semibold" style={{ color: 'var(--color-ulp-on-surface)' }}>
            {form.form_name}
          </h3>
          <p className="ulp-body-sm mt-0.5" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            {form.description_es}
          </p>
        </div>
        {statusBadge && (
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0"
            style={{ background: statusBadge.bg, color: statusBadge.color }}
          >
            {statusBadge.label}
          </span>
        )}
      </header>

      <div>
        <div className="flex justify-between items-baseline mb-1.5">
          <p className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            {form.completed_user_fields} / {form.total_user_fields} campos completados
          </p>
          <p className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--color-ulp-primary)' }}>
            {form.pct}%
          </p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-ulp-surface-container)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${form.pct}%`,
              background: 'var(--color-ulp-primary-container)',
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onOpen}
        disabled={isLocked}
        className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'var(--color-ulp-primary-container)',
          color: 'var(--color-ulp-on-primary-container)',
        }}
      >
        {cta}
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          {ctaIcon}
        </span>
      </button>
    </article>
  )
}

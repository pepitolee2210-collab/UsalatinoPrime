'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import Link from 'next/link'

interface Props {
  open: boolean
  onClose: () => void
  /** Etiqueta encima del título — ej "ESTE MES" */
  eyebrow?: string
  title: string
  /** Número grande (count o total) */
  bigNumber: string
  /** Subtítulo descriptivo */
  subtitle?: string
  /** Color del acento (por defecto dorado UsaLatino) */
  accent?: string
  children: React.ReactNode
}

export function KpiDrawer({
  open,
  onClose,
  eyebrow,
  title,
  bigNumber,
  subtitle,
  accent = '#F2A900',
  children,
}: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Bloquea el scroll del body mientras el drawer está abierto
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: 'kpi-fade 200ms ease-out' }}
      />

      {/* Panel */}
      <div
        className="absolute right-0 top-0 h-full w-full max-w-[480px] overflow-y-auto border-l border-white/10 bg-[#0a1424]"
        style={{ animation: 'kpi-slide 280ms cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        {/* Glow decorativo arriba */}
        <div
          className="pointer-events-none absolute right-0 top-0 h-40 w-full opacity-40"
          style={{
            background: `radial-gradient(circle at top right, ${accent}33 0%, transparent 60%)`,
          }}
        />

        <div className="relative">
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0a1424]/95 backdrop-blur-md">
            <div className="flex items-start justify-between gap-4 px-6 py-5">
              <div className="min-w-0 flex-1">
                {eyebrow && (
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.25em]"
                    style={{ color: accent }}
                  >
                    {eyebrow}
                  </p>
                )}
                <h2 className="mt-1 font-display text-2xl font-medium text-white leading-tight">
                  {title}
                </h2>
                <div className="mt-3 flex items-baseline gap-2">
                  <span
                    className="font-display text-5xl font-medium leading-none tabular-nums"
                    style={{ color: accent }}
                  >
                    {bigNumber}
                  </span>
                </div>
                {subtitle && (
                  <p className="mt-2 text-xs text-white/50">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">{children}</div>
        </div>

        <style>{`
          @keyframes kpi-slide {
            from { transform: translateX(100%); }
            to   { transform: translateX(0); }
          }
          @keyframes kpi-fade {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  )
}

/**
 * Fila reutilizable para listar items dentro del drawer. Mantiene un look
 * consistente: avatar inicial, nombre + sub-info, badge de "días en este
 * estado", monto, y link al perfil del cliente si aplica.
 */
export function DrawerRow({
  name,
  subtitle,
  amount,
  daysLabel,
  daysTone = 'neutral',
  href,
}: {
  name: string
  subtitle?: string
  amount?: string
  daysLabel?: string
  daysTone?: 'good' | 'warn' | 'bad' | 'neutral'
  href?: string
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const toneStyles = {
    good: { bg: 'rgba(0, 229, 160, 0.10)', color: '#00E5A0', border: 'rgba(0,229,160,0.25)' },
    warn: { bg: 'rgba(242, 169, 0, 0.10)', color: '#F2A900', border: 'rgba(242,169,0,0.25)' },
    bad: { bg: 'rgba(255, 77, 109, 0.10)', color: '#FF8AA0', border: 'rgba(255,77,109,0.25)' },
    neutral: { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', border: 'rgba(255,255,255,0.1)' },
  }[daysTone]

  const content = (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 transition hover:border-white/15 hover:bg-white/[0.05]">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-mono-ceo text-[11px] font-bold"
        style={{
          background: 'linear-gradient(135deg, rgba(242,169,0,0.18), rgba(242,169,0,0.04))',
          color: '#F2A900',
          border: '1px solid rgba(242,169,0,0.25)',
        }}
      >
        {initials || '—'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{name}</p>
        {subtitle && <p className="truncate text-[11px] text-white/40">{subtitle}</p>}
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        {amount && (
          <span className="font-mono-ceo text-sm font-semibold text-white tabular-nums">
            {amount}
          </span>
        )}
        {daysLabel && (
          <span
            className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{
              background: toneStyles.bg,
              color: toneStyles.color,
              borderColor: toneStyles.border,
            }}
          >
            {daysLabel}
          </span>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    )
  }
  return content
}

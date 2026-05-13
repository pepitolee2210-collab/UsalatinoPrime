'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import Link from 'next/link'

interface Props {
  open: boolean
  onClose: () => void
  /** Etiqueta encima del título — ej "este mes" */
  eyebrow?: string
  title: string
  /** Número grande (count o total) */
  bigNumber: string
  /** Subtítulo descriptivo */
  subtitle?: string
  /** Color del acento. Default dorado suave. */
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
  accent = '#E8B84A',
  children,
}: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 ceo-scope">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
        style={{ animation: 'kpi-fade 160ms ease-out' }}
      />

      <div
        className="absolute right-0 top-0 h-full w-full max-w-[460px] overflow-y-auto border-l border-white/[0.06] bg-[#0A0A0B]"
        style={{ animation: 'kpi-slide 220ms cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        {/* Linea dorada superior */}
        <div className="h-px w-full" style={{ background: accent, opacity: 0.6 }} />

        <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0A0A0B]/95 backdrop-blur-md">
          <div className="flex items-start justify-between gap-4 px-7 py-6">
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p
                  className="font-mono-ceo text-[10px] uppercase tracking-[0.22em] font-medium"
                  style={{ color: accent }}
                >
                  {eyebrow}
                </p>
              )}
              <h2 className="font-display mt-2 text-xl text-white font-medium leading-tight">
                {title}
              </h2>
              <div className="mt-4 font-display text-5xl text-white font-light leading-none tabular-nums tracking-tight">
                {bigNumber}
              </div>
              {subtitle && (
                <p className="mt-3 text-xs text-white/70 leading-relaxed max-w-[320px]">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02] text-white/75 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Cerrar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="px-7 py-5">{children}</div>

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
 * Fila minimal del drawer — sin avatars decorativos, mucho espacio,
 * tipografía como protagonista. Estilo Linear command palette.
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
  const toneColor = {
    good: '#4ADE80',
    warn: '#E8B84A',
    bad: '#F87171',
    neutral: 'rgba(255,255,255,0.45)',
  }[daysTone]

  const content = (
    <div className="group flex items-center gap-4 border-b border-white/[0.04] px-1 py-3.5 transition hover:bg-white/[0.015]">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white font-medium leading-tight truncate">{name}</p>
        {subtitle && (
          <p className="mt-0.5 font-mono-ceo text-[10px] uppercase tracking-wider text-white/65 truncate">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-3">
        {daysLabel && (
          <span
            className="font-mono-ceo text-[10px] uppercase tracking-wider tabular-nums font-medium"
            style={{ color: toneColor }}
          >
            {daysLabel}
          </span>
        )}
        {amount && (
          <span className="font-display text-sm text-white tabular-nums font-medium min-w-[80px] text-right">
            {amount}
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

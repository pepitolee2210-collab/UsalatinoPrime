'use client'

/**
 * Sistema visual reutilizable del admin (dark techno + Apple elegance).
 *
 * Estos componentes proveen la "voz" visual del admin nuevo:
 * - Backgrounds: gradients oscuros con aurora glow sutil
 * - Borders: hairline 0.5px white/0.1
 * - Typography: Inter Tight para body + JetBrains Mono para labels técnicos
 * - Animations: stagger fade-in con cubic-bezier(0.16, 1, 0.3, 1)
 *
 * Úsalos en cada página operativa para mantener consistencia.
 */

import Link from 'next/link'
import React from 'react'
import 'material-symbols/outlined.css'

// ─────────────────────────────────────────────────────────────
// PageHeader — encabezado consistente para cada sección
// ─────────────────────────────────────────────────────────────
interface PageHeaderProps {
  /** Eyebrow uppercase tipo "OPERACIÓN · CASOS" */
  eyebrow?: string
  /** Título principal */
  title: string
  /** Acento en el título — se renderiza con un dot blanco con glow al final */
  accentDot?: boolean
  /** Subtítulo opcional */
  description?: string
  /** Acción primaria (botón a la derecha) */
  action?: React.ReactNode
  /** Telemetría/stats opcional (chips horizontales debajo) */
  telemetry?: { label: string; value: string }[]
}

export function PageHeader({ eyebrow, title, accentDot, description, action, telemetry }: PageHeaderProps) {
  return (
    <header
      className="relative mb-8"
      style={{ animation: 'ulp-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-3 flex-1 min-w-0">
          {eyebrow && (
            <div className="flex items-center gap-2.5">
              <span className="relative flex items-center justify-center" style={{ width: 6, height: 6 }}>
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ background: '#FFFFFF', animation: 'ulp-ping 2s ease-in-out infinite' }}
                />
                <span
                  className="relative rounded-full"
                  style={{ width: 6, height: 6, background: '#FFFFFF', boxShadow: '0 0 8px rgba(255,255,255,0.7)' }}
                />
              </span>
              <p
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.2em',
                  color: 'var(--admin-fg-muted)',
                }}
              >
                {eyebrow.toUpperCase()}
              </p>
            </div>
          )}
          <h1
            style={{
              fontSize: 'clamp(34px, 4.5vw, 48px)',
              fontWeight: 600,
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
            }}
          >
            <span
              style={{
                background: 'linear-gradient(180deg, #FFFFFF 30%, #A1A1A1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {title}
            </span>
            {accentDot && (
              <span
                className="inline-block align-baseline ml-1"
                style={{
                  width: '0.45em',
                  height: '0.45em',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  boxShadow: '0 0 20px rgba(255,255,255,0.7)',
                  animation: 'ulp-glow 2.5s ease-in-out infinite',
                }}
              />
            )}
          </h1>
          {description && (
            <p style={{ fontSize: 16, color: 'var(--admin-fg-muted)', maxWidth: '52ch', lineHeight: 1.5, letterSpacing: '-0.01em' }}>
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {telemetry && telemetry.length > 0 && (
        <div className="mt-5 flex items-center gap-2 flex-wrap">
          {telemetry.map((t) => (
            <div
              key={t.label}
              className="inline-flex items-baseline gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: 'var(--admin-accent-soft)',
                border: '0.5px solid var(--admin-border)',
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 11,
              }}
            >
              <span style={{ color: 'var(--admin-fg-subtle)', letterSpacing: '0.15em' }}>{t.label.toUpperCase()}</span>
              <span style={{ color: 'var(--admin-fg)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{t.value}</span>
            </div>
          ))}
        </div>
      )}
    </header>
  )
}

// ─────────────────────────────────────────────────────────────
// PrimaryButton — botón pill estilo Apple sobre dark
// ─────────────────────────────────────────────────────────────
interface PrimaryButtonProps {
  children: React.ReactNode
  href?: string
  onClick?: () => void
  icon?: React.ReactNode
  variant?: 'solid' | 'ghost'
}

export function PrimaryButton({ children, href, onClick, icon, variant = 'solid' }: PrimaryButtonProps) {
  const styles: React.CSSProperties = variant === 'solid'
    ? {
        background: '#FFFFFF',
        color: 'var(--admin-bg-deep)',
        boxShadow: '0 4px 24px rgba(255,255,255,0.18), 0 0 0 0.5px rgba(255,255,255,0.4) inset',
      }
    : {
        background: 'var(--admin-accent-soft)',
        color: 'var(--admin-fg)',
        border: '0.5px solid rgba(255,255,255,0.15)',
      }

  const cls = "inline-flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 hover:opacity-90 active:scale-95"
  const inner = (
    <>
      {icon}
      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em' }}>{children}</span>
    </>
  )
  if (href) {
    return (
      <Link href={href} className={cls} style={styles}>
        {inner}
      </Link>
    )
  }
  return (
    <button onClick={onClick} className={cls} style={styles}>
      {inner}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// DataCard — contenedor base oscuro con glow halo
// ─────────────────────────────────────────────────────────────
interface DataCardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Glow ambient en el borde superior */
  accentTop?: boolean
}

export function DataCard({ children, className = '', padding = 'md', accentTop }: DataCardProps) {
  const pad = padding === 'none' ? '' : padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-7' : 'p-5'
  return (
    <div
      className={`relative rounded-2xl overflow-hidden ${pad} ${className}`}
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
        border: '0.5px solid var(--admin-border-strong)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {accentTop && (
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }}
        />
      )}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.03), transparent 60%)' }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// StatTile — KPI compacto con icono opcional
// ─────────────────────────────────────────────────────────────
interface StatTileProps {
  label: string
  value: string | number
  hint?: string
  icon?: React.ReactNode
  /** Cuando es true, tinte rojo sutil para indicar urgencia */
  warning?: boolean
}

export function StatTile({ label, value, hint, icon, warning }: StatTileProps) {
  return (
    <div
      className="relative rounded-2xl p-4 overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
        border: '0.5px solid var(--admin-border-strong)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-500"
        style={{ background: 'radial-gradient(circle at top, var(--admin-accent-soft), transparent 60%)' }}
      />
      <div className="relative">
        {icon && (
          <div
            className="inline-flex w-8 h-8 rounded-lg items-center justify-center mb-3"
            style={{
              background: warning ? 'rgba(248,113,113,0.12)' : 'var(--admin-accent-soft)',
              border: warning ? '0.5px solid rgba(248,113,113,0.3)' : '0.5px solid rgba(255,255,255,0.12)',
              color: warning ? '#FCA5A5' : '#FFFFFF',
            }}
          >
            {icon}
          </div>
        )}
        <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-subtle)' }}>
          {label.toUpperCase()}
        </p>
        <p style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', color: warning ? '#FCA5A5' : '#FFFFFF', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </p>
        {hint && (
          <p style={{ fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 3, letterSpacing: '-0.005em' }}>
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// StatusPill — badge con dot para estados
// ─────────────────────────────────────────────────────────────
type StatusKind = 'active' | 'pending' | 'completed' | 'paused' | 'warning' | 'neutral'

const STATUS_COLORS: Record<StatusKind, { bg: string; border: string; dot: string; text: string }> = {
  active:    { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.3)',  dot: '#4ADE80', text: '#86EFAC' },
  pending:   { bg: 'rgba(250,204,21,0.10)', border: 'rgba(250,204,21,0.3)', dot: '#FACC15', text: '#FDE68A' },
  completed: { bg: 'var(--admin-border)', border: 'rgba(255,255,255,0.18)', dot: '#FFFFFF', text: '#FFFFFF' },
  paused:    { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.3)', dot: '#94A3B8', text: '#CBD5E1' },
  warning:   { bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.3)', dot: '#F87171', text: '#FCA5A5' },
  neutral:   { bg: 'var(--admin-accent-soft)', border: 'var(--admin-border-strong)', dot: 'var(--admin-fg-muted)', text: 'var(--admin-fg-muted)' },
}

export function StatusPill({ kind, label, pulse }: { kind: StatusKind; label: string; pulse?: boolean }) {
  const c = STATUS_COLORS[kind]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{
        background: c.bg,
        border: `0.5px solid ${c.border}`,
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.1em',
        color: c.text,
      }}
    >
      <span className="relative flex items-center justify-center" style={{ width: 6, height: 6 }}>
        {pulse && (
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: c.dot, animation: 'ulp-ping 2s ease-in-out infinite' }}
          />
        )}
        <span
          className="relative rounded-full"
          style={{ width: 6, height: 6, background: c.dot, boxShadow: pulse ? `0 0 8px ${c.dot}` : 'none' }}
        />
      </span>
      {label.toUpperCase()}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// EmptyState — para listas vacías
// ─────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 space-y-4">
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, var(--admin-border), rgba(255,255,255,0.02))',
          border: '0.5px solid rgba(255,255,255,0.12)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--admin-fg-muted)' }}>
          {icon}
        </span>
      </div>
      <div className="space-y-1.5">
        <p style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.018em', color: 'var(--admin-fg)' }}>{title}</p>
        {description && (
          <p style={{ fontSize: 14, color: 'var(--admin-fg-muted)', maxWidth: '44ch', lineHeight: 1.5 }}>{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SectionDivider
// ─────────────────────────────────────────────────────────────
export function SectionDivider({ label }: { label?: string }) {
  if (label) {
    return (
      <div className="flex items-center gap-3 my-6">
        <span className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--admin-border-strong))' }} />
        <span
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.25em',
            color: 'var(--admin-fg-subtle)',
          }}
        >
          {label.toUpperCase()}
        </span>
        <span className="flex-1 h-px" style={{ background: 'linear-gradient(-90deg, transparent, var(--admin-border-strong))' }} />
      </div>
    )
  }
  return <span className="block h-px my-4" style={{ background: 'linear-gradient(90deg, transparent, var(--admin-border), transparent)' }} />
}

// ─────────────────────────────────────────────────────────────
// Global keyframes — montar una vez en cada página
// ─────────────────────────────────────────────────────────────
export function AdminKeyframes() {
  return (
    <style>{`
      @keyframes ulp-rise {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes ulp-ping {
        0% { transform: scale(1); opacity: 0.8; }
        100% { transform: scale(2.6); opacity: 0; }
      }
      @keyframes ulp-glow {
        0%, 100% { opacity: 0.6; transform: scale(0.92); }
        50% { opacity: 1; transform: scale(1.08); }
      }
      @keyframes ulp-stagger-row {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  )
}

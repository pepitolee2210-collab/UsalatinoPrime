'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  TrendingUp, TrendingDown, Users, FileSignature, DollarSign,
  AlertTriangle, Clock, ArrowRight, PhoneCall,
  Briefcase, Activity, Sparkles, Zap, Layers,
} from 'lucide-react'
import type { CeoDashboardData } from '@/app/api/admin/ceo-dashboard/route'

interface Props {
  data: CeoDashboardData
}

export function CeoDashboard({ data }: Props) {
  const { kpi, funnel, services, trend, ops, autopilot } = data

  const monthDelta = kpi.revenue_last_month > 0
    ? ((kpi.revenue_this_month - kpi.revenue_last_month) / kpi.revenue_last_month) * 100
    : kpi.revenue_this_month > 0 ? 100 : 0

  return (
    <div className="space-y-6 max-w-7xl relative" style={{ color: 'var(--admin-fg)' }}>
      {/* ─── Header strip ─── */}
      <div
        className="rounded-2xl px-6 py-5 flex items-center justify-between gap-4 flex-wrap relative overflow-hidden"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border-strong)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}
        />
        <div className="flex items-center gap-3">
          <span className="relative flex items-center justify-center" style={{ width: 8, height: 8 }}>
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: 'var(--admin-bg-elev)', animation: 'dash-ping 2s ease-in-out infinite' }}
            />
            <span
              className="relative rounded-full"
              style={{ width: 8, height: 8, background: 'var(--admin-bg-elev)', boxShadow: '0 0 10px rgba(255,255,255,0.7)' }}
            />
          </span>
          <div>
            <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', color: 'var(--admin-fg-subtle)' }}>
              VISTA CEO · DASHBOARD
            </p>
            <p style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 2 }}>
              Centro de operaciones
            </p>
          </div>
        </div>
        <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 500, letterSpacing: '0.15em', color: 'var(--admin-fg-subtle)' }}>
          {new Date(data.generated_at).toLocaleString('es-US', { dateStyle: 'short', timeStyle: 'short' }).toUpperCase()}
        </p>
      </div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Users className="w-4 h-4" strokeWidth={1.7} />}
          label="Clientes totales"
          value={kpi.total_clients.toLocaleString()}
        />
        <KpiCard
          icon={<FileSignature className="w-4 h-4" strokeWidth={1.7} />}
          label="Contratos firmados"
          value={kpi.contracts_signed.toLocaleString()}
          hint={`${ops.pending_signature.length} pend. firma`}
        />
        <KpiCard
          icon={<DollarSign className="w-4 h-4" strokeWidth={1.7} />}
          label="Cobrado este mes"
          value={`$${kpi.revenue_this_month.toLocaleString()}`}
          hint={
            monthDelta === 0
              ? `vs $${kpi.revenue_last_month.toLocaleString()} mes pasado`
              : `${monthDelta > 0 ? '↑' : '↓'} ${Math.abs(monthDelta).toFixed(0)}% vs mes pasado`
          }
          deltaPositive={monthDelta >= 0}
        />
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4" strokeWidth={1.7} />}
          label="Vencido"
          value={`$${kpi.revenue_overdue.toLocaleString()}`}
          hint={`${ops.overdue_clients.length} clientes con deuda`}
          warning={kpi.revenue_overdue > 0}
        />
      </div>

      {/* ─── Funnel ─── */}
      <DashCard>
        <SectionHeader icon={<Layers className="w-4 h-4" strokeWidth={1.7} />} title="Funnel del cliente" subtitle="Desde la primera llamada IA hasta el contrato firmado" />
        <FunnelChart stages={funnel} />
      </DashCard>

      {/* ─── Servicios + Tendencia ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DashCard>
          <SectionHeader
            icon={<Briefcase className="w-4 h-4" strokeWidth={1.7} />}
            title="Servicios"
            action={<Link href="/admin/cases" style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, color: 'var(--admin-fg-muted)', letterSpacing: '0.15em' }}>VER CASOS →</Link>}
          />
          <ServicesBreakdown services={services} />
        </DashCard>

        <DashCard>
          <SectionHeader icon={<Activity className="w-4 h-4" strokeWidth={1.7} />} title="Tendencia · últimos 6 meses" />
          <TrendChart points={trend} />
        </DashCard>
      </div>

      {/* ─── Operaciones diarias ─── */}
      <DashCard>
        <SectionHeader
          icon={<Zap className="w-4 h-4" strokeWidth={1.7} />}
          title="Operaciones diarias"
          subtitle="Lo que el equipo gestiona manualmente · próximamente automatizado"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <OpStatCard
            icon={<FileSignature className="w-3.5 h-3.5" strokeWidth={1.7} />}
            label="Pendientes de firma"
            value={ops.pending_signature.length}
            hint={ops.pending_signature.length > 0 ? `${ops.pending_signature[0].days_waiting} días el más antiguo` : 'Al día'}
            link="/admin/contratos"
          />
          <OpStatCard
            icon={<Clock className="w-3.5 h-3.5" strokeWidth={1.7} />}
            label="Próximos 7 días"
            value={ops.upcoming_payments_7d_count}
            hint={`$${ops.upcoming_payments_7d_amount.toLocaleString()} a cobrar`}
            link="/admin/payments"
          />
          <OpStatCard
            icon={<AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.7} />}
            label="Casos atascados"
            value={ops.stuck_cases}
            hint="sin movimiento >14d"
            link="/admin/cases"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <PendingSignatureList items={ops.pending_signature} />
          <OverdueClientsList items={ops.overdue_clients} />
        </div>
      </DashCard>

      {/* ─── Auto-pilot ─── */}
      <DashCard accent>
        <SectionHeader
          icon={<Sparkles className="w-4 h-4" strokeWidth={1.7} />}
          title="Auto-pilot"
          subtitle="Automatización progresiva del trabajo manual"
          action={<span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', padding: '4px 8px', borderRadius: 4, background: 'var(--admin-border)', color: 'var(--admin-fg)', border: '0.5px solid rgba(255,255,255,0.15)' }}>SOON</span>}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AutoPilotCard
            icon={<FileSignature className="w-3.5 h-3.5" strokeWidth={1.7} />}
            label="Contratos auto-generados"
            value={autopilot.auto_contracts_this_month}
            description="Cuando Vanessa marca acepta, el sistema genera el draft."
            status="phase_2"
          />
          <AutoPilotCard
            icon={<PhoneCall className="w-3.5 h-3.5" strokeWidth={1.7} />}
            label="WhatsApp automáticos"
            value={autopilot.auto_whatsapp_sent_this_month}
            description="Recordatorios de firma + cobranza vía Twilio."
            status="phase_3"
          />
          <AutoPilotCard
            icon={<DollarSign className="w-3.5 h-3.5" strokeWidth={1.7} />}
            label="Pagos cobrados solos"
            value={autopilot.auto_payments_collected_this_month}
            description="Cron de cobranza diario sin intervención humana."
            status="phase_3"
          />
        </div>
      </DashCard>

      <style>{`
        @keyframes dash-ping {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// Reusable pieces
// ════════════════════════════════════════════════════════════════════

function DashCard({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className="relative rounded-2xl p-5 space-y-5 overflow-hidden"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border-strong)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {accent && (
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }}
        />
      )}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at top, var(--admin-accent-soft), transparent 60%)',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

function SectionHeader({
  icon, title, subtitle, action,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--admin-border-strong), rgba(255,255,255,0.02))',
            border: '0.5px solid rgba(255,255,255,0.15)',
            color: 'var(--admin-fg)',
          }}
        >
          {icon}
        </div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.018em', color: 'var(--admin-fg)' }}>{title}</h2>
          {subtitle && (
            <p style={{ fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 2, letterSpacing: '-0.005em' }}>{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

function KpiCard({
  icon, label, value, hint, deltaPositive, warning,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  deltaPositive?: boolean
  warning?: boolean
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl p-4 transition-all duration-500 hover:-translate-y-0.5"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border-strong)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{ background: 'radial-gradient(circle at top, var(--admin-border), transparent 60%)' }}
      />
      <div className="relative">
        <div
          className="inline-flex w-8 h-8 rounded-lg items-center justify-center mb-3"
          style={{
            background: warning ? 'rgba(255,255,255,0.12)' : 'linear-gradient(135deg, var(--admin-border-strong), rgba(255,255,255,0.02))',
            border: '0.5px solid rgba(255,255,255,0.15)',
            color: 'var(--admin-fg)',
          }}
        >
          {icon}
        </div>
        <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-subtle)' }}>
          {label.toUpperCase()}
        </p>
        <p style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--admin-fg)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </p>
        {hint && (
          <p
            className="flex items-center gap-1 mt-1.5"
            style={{
              fontSize: 10,
              color: typeof deltaPositive === 'boolean' ? '#FFFFFF' : 'var(--admin-fg-muted)',
              fontFamily: 'var(--font-mono-tech)',
              letterSpacing: '0.05em',
              fontWeight: typeof deltaPositive === 'boolean' ? 700 : 400,
            }}
          >
            {typeof deltaPositive === 'boolean' && (deltaPositive ? <TrendingUp className="w-3 h-3" strokeWidth={2} /> : <TrendingDown className="w-3 h-3" strokeWidth={2} />)}
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}

function FunnelChart({ stages }: { stages: CeoDashboardData['funnel'] }) {
  const max = Math.max(...stages.map(s => s.count), 1)
  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const pct = (stage.count / max) * 100
        const prevStage = i > 0 ? stages[i - 1] : null
        const conversion = prevStage && prevStage.count > 0
          ? (stage.count / prevStage.count) * 100
          : null
        // Cada etapa con intensidad blanca distinta
        const intensity = 1 - (i / Math.max(stages.length - 1, 1)) * 0.4
        return (
          <div key={stage.key}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>{stage.label}</span>
                <span style={{ fontSize: 10, color: 'var(--admin-fg-subtle)' }}>{stage.description}</span>
              </div>
              <div className="flex items-center gap-2">
                {conversion !== null && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: '0.05em',
                      color: conversion >= 50 ? '#FFFFFF' : conversion >= 20 ? 'var(--admin-fg-muted)' : 'var(--admin-fg-subtle)',
                    }}
                  >
                    {conversion.toFixed(0)}%
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-fg)', fontVariantNumeric: 'tabular-nums' }}>
                  {stage.count.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="h-7 rounded-lg overflow-hidden" style={{ background: 'var(--admin-accent-soft)' }}>
              <div
                className="h-full transition-all duration-700 flex items-center px-2"
                style={{
                  width: `${pct}%`,
                  minWidth: stage.count > 0 ? '4%' : '0',
                  background: `linear-gradient(90deg, rgba(255,255,255,${intensity * 0.95}), rgba(255,255,255,${intensity * 0.6}))`,
                  boxShadow: `0 0 16px rgba(255,255,255,${intensity * 0.25})`,
                }}
              >
                {pct > 12 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--admin-bg-deep)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
                    {stage.count}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ServicesBreakdown({ services }: { services: CeoDashboardData['services'] }) {
  const visible = services.filter(s => s.contracts > 0 || s.cases > 0).slice(0, 8)
  const totalRevenue = visible.reduce((s, x) => s + x.revenue_signed, 0)
  const maxRevenue = Math.max(...visible.map(s => s.revenue_signed), 1)

  if (visible.length === 0) {
    return <p className="text-center py-6" style={{ fontSize: 13, color: 'var(--admin-fg-subtle)' }}>Sin servicios con actividad</p>
  }

  return (
    <div className="space-y-3">
      {visible.map(s => {
        const pct = (s.revenue_signed / maxRevenue) * 100
        const sharePct = totalRevenue > 0 ? (s.revenue_signed / totalRevenue) * 100 : 0
        return (
          <div key={s.slug}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }} className="truncate flex-1 mr-3">
                {s.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--admin-fg-muted)' }}>
                {s.contracts} contratos · <span style={{ fontWeight: 700, color: 'var(--admin-fg)', fontVariantNumeric: 'tabular-nums' }}>${s.revenue_signed.toLocaleString()}</span>
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--admin-accent-soft)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, pct)}%`,
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.5), #FFFFFF)',
                  boxShadow: '0 0 8px rgba(255,255,255,0.3)',
                }}
              />
            </div>
            {sharePct > 0 && (
              <p style={{ fontSize: 10, color: 'var(--admin-fg-subtle)', marginTop: 3, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
                {sharePct.toFixed(1)}% DE INGRESOS FIRMADOS
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TrendChart({ points }: { points: CeoDashboardData['trend'] }) {
  const maxRev = Math.max(...points.map(p => Math.max(p.revenue_collected, p.revenue_expected)), 1)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-2 h-36">
        {points.map((p, i) => {
          const expectedH = (p.revenue_expected / maxRev) * 100
          const collectedH = (p.revenue_collected / maxRev) * 100
          const isHover = hoverIdx === i
          return (
            <div
              key={p.month}
              className="relative flex items-end justify-center gap-0.5 cursor-pointer"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <div
                className="w-2.5 rounded-t transition-all"
                style={{
                  height: `${Math.max(2, expectedH)}%`,
                  background: 'rgba(255,255,255,0.12)',
                  border: '0.5px solid rgba(255,255,255,0.18)',
                }}
              />
              <div
                className="w-2.5 rounded-t transition-all"
                style={{
                  height: `${Math.max(2, collectedH)}%`,
                  background: isHover ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                  boxShadow: isHover ? '0 0 16px rgba(255,255,255,0.5)' : 'none',
                }}
              />
              {isHover && (
                <div
                  className="absolute bottom-full mb-2 px-3 py-2 rounded-lg whitespace-nowrap z-10"
                  style={{
                    background: 'rgba(20,20,20,0.98)',
                    border: '0.5px solid rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.6)',
                  }}
                >
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-fg)', textTransform: 'capitalize' }}>{p.label}</p>
                  <p style={{ fontSize: 10, color: 'var(--admin-fg)', marginTop: 2 }}>
                    Cobrado: <span style={{ fontWeight: 700 }}>${p.revenue_collected.toLocaleString()}</span>
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--admin-fg-muted)' }}>
                    Esperado: ${p.revenue_expected.toLocaleString()}
                  </p>
                  <p style={{ fontSize: 9, color: 'var(--admin-fg-subtle)', marginTop: 4, fontFamily: 'var(--font-mono-tech)' }}>
                    {p.contracts_signed}/{p.contracts_created} FIRMADOS/CREADOS
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-6 gap-2">
        {points.map(p => (
          <div key={p.month} className="text-center" style={{ fontSize: 9, color: 'var(--admin-fg-subtle)', textTransform: 'capitalize', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.1em' }}>
            {p.label}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 pt-3" style={{ fontSize: 10, color: 'var(--admin-fg-muted)', borderTop: '0.5px solid var(--admin-accent-soft)' }}>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--admin-bg-elev)' }} />
          Cobrado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.12)', border: '0.5px solid rgba(255,255,255,0.18)' }} />
          Esperado
        </span>
      </div>
    </div>
  )
}

function OpStatCard({
  icon, label, value, hint, link,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  hint?: string
  link: string
}) {
  return (
    <Link
      href={link}
      className="group block rounded-xl p-4 transition-all duration-500"
      style={{
        background: 'var(--admin-accent-soft)',
        border: '0.5px solid var(--admin-border)',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2" style={{ color: 'var(--admin-fg-muted)' }}>
          {icon}
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>{label}</span>
        </div>
        <ArrowRight className="w-3 h-3 transition-transform duration-500 group-hover:translate-x-0.5" style={{ color: 'var(--admin-fg-subtle)' }} />
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--admin-fg)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {hint && (
        <p style={{ fontSize: 10, color: 'var(--admin-fg-subtle)', marginTop: 2, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
          {hint}
        </p>
      )}
    </Link>
  )
}

function PendingSignatureList({ items }: { items: CeoDashboardData['ops']['pending_signature'] }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '0.5px solid var(--admin-border)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', color: 'var(--admin-fg-muted)' }}>
          ESPERANDO FIRMA · TOP {items.length}
        </p>
        <Link href="/admin/contratos" style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, color: 'var(--admin-fg-subtle)', letterSpacing: '0.15em' }}>
          VER →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-center py-3" style={{ fontSize: 11, color: 'var(--admin-fg-subtle)' }}>
          Sin contratos pendientes
        </p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2">
              <span className="truncate flex-1" style={{ fontSize: 12, fontWeight: 500, color: 'var(--admin-fg)' }}>
                {c.client_name}
              </span>
              <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 700, color: 'var(--admin-fg-muted)', whiteSpace: 'nowrap' }}>
                {c.days_waiting}D · ${c.total_price.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OverdueClientsList({ items }: { items: CeoDashboardData['ops']['overdue_clients'] }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '0.5px solid var(--admin-border)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', color: 'var(--admin-fg)' }}>
          ◆ CLIENTES CON DEUDA
        </p>
        <Link href="/admin/payments" style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, color: 'var(--admin-fg-subtle)', letterSpacing: '0.15em' }}>
          VER →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-center py-3" style={{ fontSize: 11, color: 'var(--admin-fg-subtle)' }}>
          Sin deuda pendiente
        </p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map(c => (
            <div key={c.client_id} className="flex items-center justify-between gap-2">
              <span className="truncate flex-1" style={{ fontSize: 12, fontWeight: 500, color: 'var(--admin-fg)' }}>
                {c.name}
                <span style={{ fontSize: 10, color: 'var(--admin-fg-subtle)', marginLeft: 6 }}>({c.installments_overdue})</span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 700, color: 'var(--admin-fg)', whiteSpace: 'nowrap' }}>
                ${c.total_overdue.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AutoPilotCard({
  icon, label, value, description, status,
}: {
  icon: React.ReactNode
  label: string
  value: number
  description: string
  status: 'phase_2' | 'phase_3' | 'live'
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '0.5px solid var(--admin-border)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2" style={{ color: 'var(--admin-fg-muted)' }}>
          {icon}
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>{label}</span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.2em',
            padding: '2px 6px',
            borderRadius: 3,
            background: status === 'live' ? '#FFFFFF' : 'var(--admin-border)',
            color: status === 'live' ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
            border: status === 'live' ? 'none' : '0.5px solid rgba(255,255,255,0.12)',
          }}
        >
          {status === 'live' ? 'LIVE' : status === 'phase_2' ? 'FASE 2' : 'FASE 3'}
        </span>
      </div>
      <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--admin-fg)', letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      <p style={{ fontSize: 10, color: 'var(--admin-fg-subtle)', marginTop: 4, lineHeight: 1.5 }}>{description}</p>
    </div>
  )
}

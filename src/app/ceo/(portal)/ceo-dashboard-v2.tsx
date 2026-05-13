'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, ChevronRight, CheckCircle2 } from 'lucide-react'
import type { CeoDashboardData } from '@/lib/ceo-dashboard-data'
import { Sparkline } from '@/components/ceo/sparkline'
import { LiveClock } from '@/components/ceo/live-clock'
import { KpiDrawer, DrawerRow } from '@/components/ceo/kpi-drawer'

interface Props {
  data: CeoDashboardData
  firstName: string
}

type DrawerKey =
  | null
  | 'pending_signature'
  | 'overdue'
  | 'signed_this_month'
  | 'new_contracts'
  | 'paid_this_month'

export function CeoDashboardV2({ data, firstName }: Props) {
  const [openDrawer, setOpenDrawer] = useState<DrawerKey>(null)
  const { kpi, ops, trend, lists } = data

  const monthDelta = useMemo(() => {
    if (!kpi.revenue_last_month) return kpi.revenue_this_month > 0 ? 100 : 0
    return ((kpi.revenue_this_month - kpi.revenue_last_month) / kpi.revenue_last_month) * 100
  }, [kpi.revenue_this_month, kpi.revenue_last_month])

  const signedDelta = useMemo(() => {
    const cur = kpi.contracts_signed_this_month ?? 0
    const prev = kpi.contracts_signed_last_month ?? 0
    if (!prev) return cur > 0 ? 100 : 0
    return ((cur - prev) / prev) * 100
  }, [kpi.contracts_signed_this_month, kpi.contracts_signed_last_month])

  const revenueSpark = trend.map((t) => t.revenue_collected)
  const signedSpark = trend.map((t) => t.contracts_signed)
  const createdSpark = trend.map((t) => t.contracts_created)

  const pendingCount = kpi.contracts_pending_signature_count ?? ops.pending_signature.length
  const overdueCount = kpi.payments_clients_overdue ?? ops.overdue_clients.length

  return (
    <div className="ceo-scope font-sora min-h-screen" style={{ background: 'var(--ceo-bg)' }}>
      <div className="mx-auto w-full max-w-[1240px] px-6 lg:px-10 py-10 lg:py-14">

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-6 flex-wrap mb-12">
          <div>
            <p className="font-mono-ceo text-[10px] uppercase tracking-[0.24em] text-white/75 font-medium">
              Centro de mando
            </p>
            <h1 className="font-display mt-2 text-4xl lg:text-5xl text-white font-light leading-[1.05] tracking-tight">
              {firstName}.
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/70 leading-relaxed">
              La operación de UsaLatino Prime en este momento. Cada número aquí es lo que tu
              equipo está moviendo.
            </p>
          </div>
          <LiveClock />
        </header>

        {/* ── KPI ROW PRINCIPAL ───────────────────────────────────── */}
        {/* Look "terminal financiera": 3 columnas separadas por líneas
            verticales, números tabulares grandes, espaciado generoso. */}
        <section className="mb-12">
          <div
            className="grid grid-cols-1 lg:grid-cols-3 border-y border-white/[0.06]"
            style={{ gap: '1px', background: 'rgba(255,255,255,0.06)' }}
          >
            <KpiCellHero
              label="Cobrado este mes"
              value={`$${kpi.revenue_this_month.toLocaleString()}`}
              deltaPct={monthDelta}
              deltaLabel={`vs $${kpi.revenue_last_month.toLocaleString()} mes pasado`}
              sparkline={revenueSpark}
              accent="var(--ceo-gold)"
              footnote={
                kpi.collection_rate_this_month != null
                  ? `${kpi.collection_rate_this_month}% del esperado del mes`
                  : undefined
              }
              onClick={() => setOpenDrawer('paid_this_month')}
            />
            <KpiCell
              label="Firmados este mes"
              value={String(kpi.contracts_signed_this_month ?? 0)}
              deltaPct={signedDelta}
              deltaLabel={`${kpi.contracts_signed_last_month ?? 0} mes pasado`}
              sparkline={signedSpark}
              accent="var(--ceo-good)"
              onClick={() => setOpenDrawer('signed_this_month')}
            />
            <KpiCell
              label="Contratos nuevos"
              value={String(kpi.contracts_new_this_month ?? 0)}
              deltaPct={null}
              deltaLabel="creados este mes"
              sparkline={createdSpark}
              accent="rgba(255,255,255,0.55)"
              onClick={() => setOpenDrawer('new_contracts')}
            />
          </div>
        </section>

        {/* ── ALERT ROW — 4 micro-KPIs en línea ────────────────────── */}
        <section className="mb-16">
          <SectionLabel>Métricas operativas</SectionLabel>
          <div
            className="grid grid-cols-2 lg:grid-cols-4 border-y border-white/[0.06]"
            style={{ gap: '1px', background: 'rgba(255,255,255,0.06)' }}
          >
            <MicroKpi
              label="Faltan firmar"
              value={String(pendingCount)}
              tone={pendingCount > 5 ? 'bad' : pendingCount > 0 ? 'warn' : 'good'}
              subline={
                ops.pending_signature.length > 0
                  ? `${ops.pending_signature[0].days_waiting}d el más antiguo`
                  : 'todo al día'
              }
              onClick={() => setOpenDrawer('pending_signature')}
            />
            <MicroKpi
              label="Pagos vencidos"
              value={`$${kpi.revenue_overdue.toLocaleString()}`}
              tone={kpi.revenue_overdue > 0 ? 'bad' : 'good'}
              subline={`${overdueCount} clientes`}
              onClick={() => setOpenDrawer('overdue')}
            />
            <MicroKpi
              label="Pagaron este mes"
              value={String(kpi.payments_clients_this_month ?? 0)}
              tone="neutral"
              subline="clientes únicos"
              onClick={() => setOpenDrawer('paid_this_month')}
            />
            <MicroKpi
              label="Tiempo firma"
              value={
                kpi.avg_days_create_to_sign != null
                  ? `${kpi.avg_days_create_to_sign}d`
                  : '—'
              }
              tone={
                (kpi.avg_days_create_to_sign ?? 0) > 14
                  ? 'bad'
                  : (kpi.avg_days_create_to_sign ?? 0) > 7
                    ? 'warn'
                    : 'good'
              }
              subline="promedio crear → firmar"
            />
          </div>
        </section>

        {/* ── OPERACIÓN — 3 cards de prioridades ───────────────────── */}
        <section className="mb-16">
          <SectionLabel
            subline="Lo que Andrium está gestionando hoy. Si algo se acumula, ahí está."
          >
            Pendientes en curso
          </SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white/[0.06] border-y border-white/[0.06]">
            <PriorityCard
              tone="warn"
              title={`${ops.pending_signature.length} esperando firma`}
              description={
                ops.pending_signature.length > 0
                  ? `${ops.pending_signature[0].client_name} — ${ops.pending_signature[0].days_waiting}d`
                  : 'Sin pendientes'
              }
              cta="Ver lista"
              onClick={() => setOpenDrawer('pending_signature')}
              disabled={ops.pending_signature.length === 0}
            />
            <PriorityCard
              tone="bad"
              title={`$${kpi.revenue_overdue.toLocaleString()} sin cobrar`}
              description={
                ops.overdue_clients.length > 0
                  ? `${ops.overdue_clients.length} clientes — top: $${ops.overdue_clients[0].total_overdue.toLocaleString()}`
                  : 'Sin pagos vencidos'
              }
              cta="Ver clientes"
              onClick={() => setOpenDrawer('overdue')}
              disabled={ops.overdue_clients.length === 0}
            />
            <PriorityCard
              tone="info"
              title={`${ops.upcoming_payments_7d_count} pagos próximos`}
              description={
                ops.upcoming_payments_7d_count > 0
                  ? `$${ops.upcoming_payments_7d_amount.toLocaleString()} esperados en 7 días`
                  : 'Ningún pago esperado esta semana'
              }
              cta="Pendiente cobranza"
              disabled
            />
          </div>
        </section>

        {/* ── CAPA: SERVICIOS — qué se demanda más ────────────────────── */}
        <section className="mb-16">
          <SectionLabel
            subline="Ranking por clientes únicos — qué se vende, cuál genera más ingreso."
          >
            Servicios
          </SectionLabel>
          <div
            className="border-y border-white/[0.06]"
            style={{ background: 'var(--ceo-bg)' }}
          >
            <ServicesRanking items={data.services_ranking ?? []} />
          </div>
        </section>

        {/* ── CAPA: PIPELINE DE CONTRATOS por estado ──────────────────── */}
        <section className="mb-16">
          <SectionLabel
            subline="Estado actual de TODOS los contratos. Cada barra muestra dónde están parados."
          >
            Pipeline de contratos
          </SectionLabel>
          <div
            className="border-y border-white/[0.06] p-7 lg:p-8"
            style={{ background: 'var(--ceo-bg)' }}
          >
            <ContractStatusBar items={data.contracts_by_status ?? []} />
          </div>
        </section>

        {/* ── CAPA: TENDENCIA 6 MESES ─────────────────────────────────── */}
        <section className="mb-16">
          <SectionLabel subline="Cobrado mensual de los últimos 6 meses">
            Evolución del negocio
          </SectionLabel>
          <div
            className="border-y border-white/[0.06] p-7 lg:p-8"
            style={{ background: 'var(--ceo-bg)' }}
          >
            <TrendChart points={trend} />
          </div>
        </section>

        {/* ── CAPA: FUNNEL ─────────────────────────────────────────────── */}
        <section className="mb-16">
          <SectionLabel subline="Desde la primera llamada IA hasta el contrato firmado">
            Funnel del cliente
          </SectionLabel>
          <div
            className="border-y border-white/[0.06] py-7 lg:py-8"
            style={{ background: 'var(--ceo-bg)' }}
          >
            <FunnelChart stages={data.funnel} />
          </div>
        </section>

        <p className="font-mono-ceo text-[10px] uppercase tracking-[0.18em] text-white/50 text-right">
          última actualización ·{' '}
          {new Date(data.generated_at).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })}
        </p>

        {/* ── DRAWERS ──────────────────────────────────────────────── */}
        <KpiDrawer
          open={openDrawer === 'pending_signature'}
          onClose={() => setOpenDrawer(null)}
          eyebrow="Operación · pendiente"
          title="Esperando firma"
          bigNumber={String(ops.pending_signature.length)}
          subtitle="Top 10 por antigüedad. Andrium debería estar haciendo seguimiento."
          accent="var(--ceo-gold)"
        >
          {ops.pending_signature.length === 0 ? (
            <EmptyState text="Sin pendientes. Todo firmado." />
          ) : (
            <div>
              {ops.pending_signature.map((c) => (
                <DrawerRow
                  key={c.id}
                  name={c.client_name}
                  subtitle={`${humanizeService(c.service_name)} · creado hace ${c.days_waiting}d`}
                  amount={`$${c.total_price.toLocaleString()}`}
                  daysLabel={`${c.days_waiting}d`}
                  daysTone={c.days_waiting > 7 ? 'bad' : c.days_waiting > 3 ? 'warn' : 'good'}
                />
              ))}
            </div>
          )}
        </KpiDrawer>

        <KpiDrawer
          open={openDrawer === 'overdue'}
          onClose={() => setOpenDrawer(null)}
          eyebrow="Cobranza · atrasado"
          title="Pagos vencidos"
          bigNumber={`$${kpi.revenue_overdue.toLocaleString()}`}
          subtitle={`${ops.overdue_clients.length} clientes con cuotas vencidas.`}
          accent="var(--ceo-bad)"
        >
          {ops.overdue_clients.length === 0 ? (
            <EmptyState text="Sin pagos vencidos." />
          ) : (
            <div>
              {ops.overdue_clients.map((c) => {
                const daysOver = Math.floor(
                  (Date.now() - new Date(c.oldest_due_date).getTime()) / 86400_000,
                )
                return (
                  <DrawerRow
                    key={c.client_id}
                    name={c.name}
                    subtitle={`${c.installments_overdue} cuota(s) · ${c.phone ?? 'sin teléfono'}`}
                    amount={`$${c.total_overdue.toLocaleString()}`}
                    daysLabel={`${daysOver}d`}
                    daysTone={daysOver > 30 ? 'bad' : daysOver > 14 ? 'warn' : 'neutral'}
                  />
                )
              })}
            </div>
          )}
        </KpiDrawer>

        <KpiDrawer
          open={openDrawer === 'signed_this_month'}
          onClose={() => setOpenDrawer(null)}
          eyebrow="Este mes · firmados"
          title="Contratos firmados"
          bigNumber={String(lists?.signed_this_month?.length ?? 0)}
          subtitle="Cada firma es venta cerrada."
          accent="var(--ceo-good)"
        >
          {(lists?.signed_this_month ?? []).length === 0 ? (
            <EmptyState text="Ninguno firmado este mes todavía." />
          ) : (
            <div>
              {lists!.signed_this_month.map((c) => (
                <DrawerRow
                  key={c.id}
                  name={c.client_name}
                  subtitle={`${humanizeService(c.service_name)} · ${formatDate(c.signed_at)}`}
                  amount={`$${c.total_price.toLocaleString()}`}
                />
              ))}
            </div>
          )}
        </KpiDrawer>

        <KpiDrawer
          open={openDrawer === 'new_contracts'}
          onClose={() => setOpenDrawer(null)}
          eyebrow="Este mes · creados"
          title="Contratos nuevos"
          bigNumber={String(lists?.new_contracts_this_month?.length ?? 0)}
          subtitle="Volumen de entrada del mes."
          accent="rgba(255,255,255,0.55)"
        >
          {(lists?.new_contracts_this_month ?? []).length === 0 ? (
            <EmptyState text="Ningún contrato nuevo este mes." />
          ) : (
            <div>
              {lists!.new_contracts_this_month.map((c) => (
                <DrawerRow
                  key={c.id}
                  name={c.client_name}
                  subtitle={`${humanizeService(c.service_name)} · ${c.status} · hace ${c.days_old}d`}
                  amount={`$${c.total_price.toLocaleString()}`}
                  daysLabel={c.status}
                  daysTone={c.status === 'firmado' ? 'good' : c.status === 'borrador' ? 'warn' : 'neutral'}
                />
              ))}
            </div>
          )}
        </KpiDrawer>

        <KpiDrawer
          open={openDrawer === 'paid_this_month'}
          onClose={() => setOpenDrawer(null)}
          eyebrow="Este mes · cobrado"
          title="Pagos recibidos"
          bigNumber={`$${kpi.revenue_this_month.toLocaleString()}`}
          subtitle={`${lists?.paid_this_month?.length ?? 0} pagos · ${kpi.payments_clients_this_month ?? 0} clientes únicos.`}
          accent="var(--ceo-gold)"
        >
          {(lists?.paid_this_month ?? []).length === 0 ? (
            <EmptyState text="Sin pagos cobrados este mes." />
          ) : (
            <div>
              {lists!.paid_this_month.map((p) => (
                <DrawerRow
                  key={p.payment_id || `${p.client_id}-${p.paid_at}`}
                  name={p.client_name}
                  subtitle={`Pagó el ${formatDate(p.paid_at)}`}
                  amount={`$${p.amount.toLocaleString()}`}
                />
              ))}
            </div>
          )}
        </KpiDrawer>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Sub-componentes
// ══════════════════════════════════════════════════════════════════════

/**
 * Cell del KPI principal — fondo plano, sin sombras, hover sutil con
 * borde superior dorado.
 */
function KpiCellHero({
  label, value, deltaPct, deltaLabel, sparkline, accent, footnote, onClick,
}: {
  label: string
  value: string
  deltaPct: number
  deltaLabel: string
  sparkline: number[]
  accent: string
  footnote?: string
  onClick?: () => void
}) {
  const positive = deltaPct >= 0
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative text-left px-7 py-7 lg:py-8 transition-colors"
      style={{ background: 'var(--ceo-bg)' }}
    >
      {/* Línea dorada en hover (top accent) */}
      <span
        className="absolute top-0 left-0 right-0 h-px opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: accent }}
      />
      <p className="font-mono-ceo text-[10px] uppercase tracking-[0.22em] text-white/65 font-medium">
        {label}
      </p>
      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="font-display text-5xl text-white font-light leading-none tabular-nums tracking-tight">
          {value}
        </p>
        <Sparkline data={sparkline} width={120} height={32} stroke={accent} />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 font-mono-ceo text-[10px] uppercase tracking-wider font-medium"
          style={{ color: positive ? 'var(--ceo-good)' : 'var(--ceo-bad)' }}
        >
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(deltaPct).toFixed(0)}%
        </span>
        <span className="font-mono-ceo text-[10px] uppercase tracking-wider text-white/75">
          {deltaLabel}
        </span>
      </div>
      {footnote && (
        <p className="mt-3 font-mono-ceo text-[10px] uppercase tracking-wider text-white/75">
          {footnote}
        </p>
      )}
    </button>
  )
}

function KpiCell({
  label, value, deltaPct, deltaLabel, sparkline, accent, onClick,
}: {
  label: string
  value: string
  deltaPct: number | null
  deltaLabel: string
  sparkline: number[]
  accent: string
  onClick?: () => void
}) {
  const positive = deltaPct !== null && deltaPct >= 0
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative text-left px-7 py-7 lg:py-8 transition-colors"
      style={{ background: 'var(--ceo-bg)' }}
    >
      <span
        className="absolute top-0 left-0 right-0 h-px opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono-ceo text-[10px] uppercase tracking-[0.22em] text-white/65 font-medium">
          {label}
        </p>
        <ChevronRight className="w-3.5 h-3.5 text-white/40 transition-all group-hover:translate-x-0.5 group-hover:text-white/70" />
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="font-display text-5xl text-white font-light leading-none tabular-nums tracking-tight">
          {value}
        </p>
        <Sparkline data={sparkline} width={90} height={28} stroke={accent} />
      </div>
      <div className="mt-4 flex items-center gap-2">
        {deltaPct !== null && (
          <span
            className="inline-flex items-center gap-1 font-mono-ceo text-[10px] uppercase tracking-wider font-medium"
            style={{ color: positive ? 'var(--ceo-good)' : 'var(--ceo-bad)' }}
          >
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(deltaPct).toFixed(0)}%
          </span>
        )}
        <span className="font-mono-ceo text-[10px] uppercase tracking-wider text-white/75">
          {deltaLabel}
        </span>
      </div>
    </button>
  )
}

function MicroKpi({
  label, value, tone, subline, onClick,
}: {
  label: string
  value: string
  tone: 'good' | 'warn' | 'bad' | 'neutral'
  subline?: string
  onClick?: () => void
}) {
  const toneColor = {
    good: 'var(--ceo-good)',
    warn: 'var(--ceo-gold)',
    bad: 'var(--ceo-bad)',
    neutral: 'var(--ceo-text-2)',
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="group relative text-left px-6 py-6 transition-colors disabled:cursor-default enabled:hover:bg-white/[0.012]"
      style={{ background: 'var(--ceo-bg)' }}
    >
      {onClick && (
        <span
          className="absolute top-0 left-0 right-0 h-px opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: toneColor }}
        />
      )}
      <p className="font-mono-ceo text-[10px] uppercase tracking-[0.22em] text-white/65 font-medium">
        {label}
      </p>
      <p
        className="font-display mt-4 text-3xl font-light leading-none tabular-nums tracking-tight"
        style={{ color: tone === 'neutral' ? 'var(--ceo-text)' : toneColor }}
      >
        {value}
      </p>
      {subline && (
        <p className="mt-3 font-mono-ceo text-[10px] uppercase tracking-wider text-white/75">
          {subline}
        </p>
      )}
    </button>
  )
}

function PriorityCard({
  tone, title, description, cta, onClick, disabled,
}: {
  tone: 'warn' | 'bad' | 'good' | 'info'
  title: string
  description: string
  cta: string
  onClick?: () => void
  disabled?: boolean
}) {
  const accent = {
    warn: 'var(--ceo-gold)',
    bad: 'var(--ceo-bad)',
    good: 'var(--ceo-good)',
    info: 'rgba(255,255,255,0.55)',
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative text-left px-7 py-7 transition-colors disabled:cursor-default disabled:opacity-60 enabled:hover:bg-white/[0.012]"
      style={{ background: 'var(--ceo-bg)' }}
    >
      {!disabled && (
        <span
          className="absolute top-0 left-0 right-0 h-px opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: accent }}
        />
      )}
      <div className="flex items-start gap-3 mb-1">
        <span
          className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: accent }}
        />
        <h4 className="font-display text-lg text-white font-medium leading-tight tracking-tight">
          {title}
        </h4>
      </div>
      <p className="mt-3 text-xs text-white/70 leading-relaxed pl-[18px]">{description}</p>
      <div
        className="mt-5 flex items-center gap-1.5 pl-[18px] font-mono-ceo text-[10px] uppercase tracking-[0.18em] font-medium transition-all"
        style={{ color: disabled ? 'rgba(255,255,255,0.25)' : accent }}
      >
        {cta}
        {!disabled && (
          <ChevronRight className="w-3 h-3 transition-transform group-enabled:group-hover:translate-x-0.5" />
        )}
      </div>
    </button>
  )
}

function SectionLabel({
  children, subline, inline,
}: {
  children: React.ReactNode
  subline?: string
  inline?: boolean
}) {
  return (
    <div className={inline ? 'mb-5' : 'mb-5'}>
      <p className="font-mono-ceo text-[10px] uppercase tracking-[0.24em] text-white/65 font-medium">
        {children}
      </p>
      {subline && <p className="mt-1.5 text-xs text-white/75">{subline}</p>}
    </div>
  )
}

function TrendChart({ points }: { points: CeoDashboardData['trend'] }) {
  if (!points.length) return <p className="text-xs text-white/75">Sin datos</p>
  const maxRev = Math.max(...points.map((p) => p.revenue_collected), 1)
  return (
    <div>
      <div className="grid grid-cols-6 gap-3 h-36 items-end mb-3">
        {points.map((p) => {
          const height = (p.revenue_collected / maxRev) * 100
          const isLast = p === points[points.length - 1]
          return (
            <div key={p.month} className="flex flex-col items-center gap-2 group">
              <div
                className="w-full transition-all"
                style={{
                  height: `${Math.max(2, height)}%`,
                  background: isLast ? 'var(--ceo-gold)' : 'rgba(232,184,74,0.35)',
                  opacity: isLast ? 1 : 0.7,
                }}
                title={`$${p.revenue_collected.toLocaleString()}`}
              />
              <span
                className="font-mono-ceo text-[9px] uppercase tracking-wider text-white/65 capitalize"
                style={{ color: isLast ? 'var(--ceo-text)' : undefined }}
              >
                {p.label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 pt-5 border-t border-white/[0.06]">
        <Stat
          label="Firmados (últ. 6m)"
          value={points.reduce((s, p) => s + p.contracts_signed, 0).toString()}
        />
        <Stat
          label="Cobrado (últ. 6m)"
          value={`$${points.reduce((s, p) => s + p.revenue_collected, 0).toLocaleString()}`}
        />
      </div>
    </div>
  )
}

/**
 * Ranking de servicios — qué se demanda más. Tabla minimal estilo Apple:
 * rank tipográfico + nombre del servicio + clientes + contratos firmados +
 * ingreso firmado + barra horizontal de share %.
 */
function ServicesRanking({ items }: { items: NonNullable<CeoDashboardData['services_ranking']> }) {
  if (!items.length) {
    return (
      <div className="px-7 py-10 text-center text-xs text-white/65">
        Sin actividad por servicio todavía.
      </div>
    )
  }
  const maxClients = Math.max(...items.map((s) => s.unique_clients), 1)
  return (
    <div className="px-7 lg:px-8">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 border-b border-white/[0.06] py-3.5 font-mono-ceo text-[10px] uppercase tracking-[0.18em] text-white/55 font-medium">
        <div className="col-span-1">#</div>
        <div className="col-span-5">Servicio</div>
        <div className="col-span-2 text-right">Clientes</div>
        <div className="col-span-2 text-right">Firmados</div>
        <div className="col-span-2 text-right">Ingreso</div>
      </div>
      {/* Rows */}
      {items.map((s, idx) => {
        const widthPct = (s.unique_clients / maxClients) * 100
        return (
          <div
            key={s.slug}
            className="group grid grid-cols-12 gap-4 border-b border-white/[0.04] py-4 items-center transition-colors hover:bg-white/[0.012] relative"
          >
            {/* Barra de fondo (% de clientes vs el top) */}
            <span
              className="pointer-events-none absolute inset-y-0 left-0 transition-opacity"
              style={{
                width: `${widthPct}%`,
                background:
                  'linear-gradient(90deg, rgba(232,184,74,0.07) 0%, rgba(232,184,74,0.01) 100%)',
              }}
            />
            <div className="col-span-1 relative font-mono-ceo text-xs text-white/65 tabular-nums">
              {String(idx + 1).padStart(2, '0')}
            </div>
            <div className="col-span-5 relative">
              <p className="text-sm text-white font-medium leading-tight truncate">{s.name}</p>
              <p className="mt-0.5 font-mono-ceo text-[10px] uppercase tracking-wider text-white/55">
                {s.share_pct}% de la demanda
              </p>
            </div>
            <div className="col-span-2 relative text-right font-display text-lg text-white tabular-nums font-light">
              {s.unique_clients}
            </div>
            <div className="col-span-2 relative text-right font-display text-lg text-white tabular-nums font-light">
              {s.contracts_signed}
            </div>
            <div className="col-span-2 relative text-right font-display text-lg text-white tabular-nums font-light">
              ${s.revenue_signed.toLocaleString()}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Pipeline de contratos — stack horizontal proporcional + breakdown
 * numérico debajo (cards minimalistas, una por estado).
 *
 * Cada estado tiene su color (borrador=blanco apagado, pendiente=dorado,
 * firmado=verde, activo=cyan, completado=blanco fuerte, cancelado=rojo).
 */
function ContractStatusBar({
  items,
}: {
  items: NonNullable<CeoDashboardData['contracts_by_status']>
}) {
  if (!items.length) {
    return <p className="text-xs text-white/65">Sin contratos en el pipeline.</p>
  }
  const totalCount = items.reduce((s, x) => s + x.count, 0) || 1
  const totalValue = items.reduce((s, x) => s + x.total_value, 0)

  const colorFor = (status: string): string => {
    switch (status) {
      case 'borrador': return 'rgba(255, 255, 255, 0.30)'
      case 'pendiente_firma': return '#E8B84A'
      case 'firmado': return '#4ADE80'
      case 'activo': return '#7DD3FC'
      case 'completado': return '#FFFFFF'
      case 'cancelado': return '#F87171'
      default: return 'rgba(255, 255, 255, 0.45)'
    }
  }

  return (
    <div>
      {/* Stack horizontal proporcional */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <p className="font-mono-ceo text-[10px] uppercase tracking-wider text-white/65 font-medium">
            {totalCount} contratos · ${totalValue.toLocaleString()} valor total
          </p>
          <p className="font-mono-ceo text-[10px] uppercase tracking-wider text-white/55">
            distribución del pipeline
          </p>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-sm bg-white/[0.04]">
          {items.map((s) => {
            const pct = (s.count / totalCount) * 100
            if (pct < 0.5) return null
            return (
              <div
                key={s.status}
                style={{
                  width: `${pct}%`,
                  background: colorFor(s.status),
                  opacity: 0.85,
                }}
                title={`${s.label}: ${s.count} (${pct.toFixed(1)}%)`}
              />
            )
          })}
        </div>
      </div>

      {/* Breakdown numérico por estado — cards en grid */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-y border-white/[0.06]"
        style={{ gap: '1px', background: 'rgba(255,255,255,0.06)' }}
      >
        {items.map((s) => {
          const color = colorFor(s.status)
          const pct = (s.count / totalCount) * 100
          return (
            <div
              key={s.status}
              className="px-4 py-5"
              style={{ background: 'var(--ceo-bg)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
                <p className="font-mono-ceo text-[10px] uppercase tracking-[0.18em] text-white/65 font-medium truncate">
                  {s.label}
                </p>
              </div>
              <p
                className="font-display text-3xl font-light tabular-nums leading-none tracking-tight"
                style={{ color: s.status === 'borrador' ? 'var(--ceo-text)' : color }}
              >
                {s.count}
              </p>
              <p className="mt-2.5 font-mono-ceo text-[10px] uppercase tracking-wider text-white/55 tabular-nums">
                ${s.total_value.toLocaleString()}
              </p>
              <p className="mt-0.5 font-mono-ceo text-[10px] uppercase tracking-wider text-white/40 tabular-nums">
                {pct.toFixed(1)}% del total
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FunnelChart({ stages }: { stages: CeoDashboardData['funnel'] }) {
  const max = Math.max(...stages.map((s) => s.count), 1)
  return (
    <div className="space-y-3.5 px-7 lg:px-8">
      {stages.map((stage, i) => {
        const pct = (stage.count / max) * 100
        const prev = i > 0 ? stages[i - 1] : null
        const conversion = prev && prev.count > 0 ? (stage.count / prev.count) * 100 : null
        return (
          <div key={stage.key}>
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="text-white font-medium">{stage.label}</span>
              <div className="flex items-center gap-3">
                {conversion !== null && (
                  <span
                    className="font-mono-ceo text-[10px] uppercase tracking-wider"
                    style={{
                      color:
                        conversion >= 50
                          ? 'var(--ceo-good)'
                          : conversion >= 20
                            ? 'var(--ceo-gold)'
                            : 'var(--ceo-bad)',
                    }}
                  >
                    {conversion.toFixed(0)}%
                  </span>
                )}
                <span className="font-display text-base text-white tabular-nums w-12 text-right">
                  {stage.count}
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-white/[0.04] overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.max(1, pct)}%`,
                  background: 'var(--ceo-gold)',
                  opacity: 0.5 + (i * 0.08),
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono-ceo text-[10px] uppercase tracking-wider text-white/75 font-medium">
        {label}
      </p>
      <p className="font-display text-lg text-white mt-1 tabular-nums font-light">{value}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <CheckCircle2 className="w-8 h-8 text-emerald-400/40 mb-3" />
      <p className="text-xs text-white/70">{text}</p>
    </div>
  )
}

function humanizeService(slug: string): string {
  if (!slug) return ''
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })
  } catch {
    return iso.slice(0, 10)
  }
}

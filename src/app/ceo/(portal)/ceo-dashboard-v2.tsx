'use client'

import { useMemo, useState } from 'react'
import {
  TrendingUp, TrendingDown, FileSignature, AlertTriangle,
  DollarSign, Clock, ArrowRight, Users, Activity, Sparkles,
  Briefcase, Layers, Zap, CheckCircle2, BadgeAlert, Timer,
  Target, ChevronRight,
} from 'lucide-react'
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
  const { kpi, ops, trend, services, lists } = data

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

  return (
    <div className="font-sora relative min-h-screen">
      {/* Atmósfera: glow dorado + grid sutil */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background: `
            radial-gradient(circle at 15% 0%, rgba(242,169,0,0.10) 0%, transparent 45%),
            radial-gradient(circle at 85% 100%, rgba(0,229,160,0.06) 0%, transparent 50%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* HERO ───────────────────────────────────────────────── */}
      <header
        className="mb-8 flex items-start justify-between gap-6 flex-wrap"
        style={{ animation: 'reveal 600ms 50ms ease-out both' }}
      >
        <div className="min-w-0">
          <p
            className="font-mono-ceo text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/80"
          >
            Centro de mando · Sala de control
          </p>
          <h1 className="mt-2 font-display text-5xl lg:text-6xl font-medium text-white leading-[1.05] tracking-tight">
            Hola, <span className="italic text-amber-300/95">{firstName}</span>.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/55 leading-relaxed">
            Esta es la operación de UsaLatino Prime ahora mismo. Cada número refleja lo que tu equipo
            está moviendo —{' '}
            <span className="text-white/80">úsalo para presionar lo que importa.</span>
          </p>
        </div>
        <LiveClock />
      </header>

      {/* KPI HERO — Cobrado este mes (card grande, ocupa 2 cols) ───────── */}
      <section
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4"
        style={{ animation: 'reveal 600ms 150ms ease-out both' }}
      >
        <KpiHero
          eyebrow="Cobrado este mes"
          value={`$${kpi.revenue_this_month.toLocaleString()}`}
          deltaPct={monthDelta}
          deltaLabel={`vs $${kpi.revenue_last_month.toLocaleString()} mes pasado`}
          sparkline={revenueSpark}
          accent="#F2A900"
          footnote={
            kpi.collection_rate_this_month !== null && kpi.collection_rate_this_month !== undefined
              ? `${kpi.collection_rate_this_month}% del esperado del mes`
              : undefined
          }
          onClick={() => setOpenDrawer('paid_this_month')}
        />
        <KpiCard
          icon={<FileSignature className="w-4 h-4" />}
          label="Firmados este mes"
          value={String(kpi.contracts_signed_this_month ?? 0)}
          deltaPct={signedDelta}
          deltaLabel={`${kpi.contracts_signed_last_month ?? 0} mes pasado`}
          sparkline={signedSpark}
          sparklineColor="#00E5A0"
          accent="#00E5A0"
          onClick={() => setOpenDrawer('signed_this_month')}
        />
        <KpiCard
          icon={<Sparkles className="w-4 h-4" />}
          label="Contratos nuevos del mes"
          value={String(kpi.contracts_new_this_month ?? 0)}
          deltaPct={null}
          deltaLabel="creados este mes"
          sparkline={createdSpark}
          sparklineColor="#7DD3FC"
          accent="#7DD3FC"
          onClick={() => setOpenDrawer('new_contracts')}
        />
      </section>

      {/* KPI Row — Alertas operativas (Andrium) ───────────────────────── */}
      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
        style={{ animation: 'reveal 600ms 250ms ease-out both' }}
      >
        <AlertKpi
          icon={<Timer className="w-3.5 h-3.5" />}
          label="Faltan firmar"
          value={String(kpi.contracts_pending_signature_count ?? 0)}
          tone={(kpi.contracts_pending_signature_count ?? 0) > 5 ? 'bad' : 'warn'}
          subline={
            ops.pending_signature.length > 0
              ? `${ops.pending_signature[0].days_waiting}d el más antiguo`
              : 'todo al día'
          }
          onClick={() => setOpenDrawer('pending_signature')}
        />
        <AlertKpi
          icon={<BadgeAlert className="w-3.5 h-3.5" />}
          label="Pagos vencidos"
          value={`$${kpi.revenue_overdue.toLocaleString()}`}
          tone="bad"
          subline={`${kpi.payments_clients_overdue ?? ops.overdue_clients.length} clientes`}
          onClick={() => setOpenDrawer('overdue')}
        />
        <AlertKpi
          icon={<Target className="w-3.5 h-3.5" />}
          label="Pagos del mes"
          value={String(kpi.payments_clients_this_month ?? 0)}
          tone="good"
          subline={`${(kpi.payments_clients_this_month ?? 0)} clientes pagaron`}
          onClick={() => setOpenDrawer('paid_this_month')}
        />
        <AlertKpi
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Tiempo firma"
          value={
            kpi.avg_days_create_to_sign !== null && kpi.avg_days_create_to_sign !== undefined
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
      </section>

      {/* PERFORMANCE BLOCK — Lo que Andrium gestiona ──────────────────── */}
      <section
        className="mb-10"
        style={{ animation: 'reveal 600ms 350ms ease-out both' }}
      >
        <SectionHeader
          icon={<Briefcase className="w-4 h-4" />}
          title="Operación · Performance del equipo"
          subtitle="Lo que Andrium gestiona hoy. Si algo se acumula, presiónalo."
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ActionCard
            tone="warn"
            icon={<FileSignature className="w-4 h-4" />}
            title={`${ops.pending_signature.length} contratos esperando firma`}
            description={
              ops.pending_signature.length > 0
                ? `El más viejo: ${ops.pending_signature[0].client_name} — ${ops.pending_signature[0].days_waiting} días esperando.`
                : 'Sin pendientes. ✓'
            }
            cta="Ver lista"
            onClick={() => setOpenDrawer('pending_signature')}
            disabled={ops.pending_signature.length === 0}
          />
          <ActionCard
            tone="bad"
            icon={<DollarSign className="w-4 h-4" />}
            title={`$${kpi.revenue_overdue.toLocaleString()} en pagos vencidos`}
            description={
              ops.overdue_clients.length > 0
                ? `${ops.overdue_clients.length} clientes adeudan. El más grande: $${ops.overdue_clients[0].total_overdue.toLocaleString()}.`
                : 'Sin pagos vencidos. ✓'
            }
            cta="Ver clientes"
            onClick={() => setOpenDrawer('overdue')}
            disabled={ops.overdue_clients.length === 0}
          />
          <ActionCard
            tone="info"
            icon={<Clock className="w-4 h-4" />}
            title={`${ops.upcoming_payments_7d_count} pagos esperados (7 días)`}
            description={
              ops.upcoming_payments_7d_count > 0
                ? `$${ops.upcoming_payments_7d_amount.toLocaleString()} a cobrar la próxima semana.`
                : 'Sin pagos esperados esta semana.'
            }
            cta="Confirmar cobranza"
            disabled
          />
        </div>
      </section>

      {/* Tendencia y Servicios ────────────────────────────────────────── */}
      <section
        className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-10"
        style={{ animation: 'reveal 600ms 450ms ease-out both' }}
      >
        <Panel className="lg:col-span-3">
          <SectionHeader
            icon={<Activity className="w-4 h-4" />}
            title="Tendencia · últimos 6 meses"
            subtitle="Contratos firmados, creados y cobrado mensual."
            inline
          />
          <TrendChart points={trend} />
        </Panel>
        <Panel className="lg:col-span-2">
          <SectionHeader
            icon={<Layers className="w-4 h-4" />}
            title="Por servicio"
            subtitle="Ingresos firmados, top 6."
            inline
          />
          <ServicesBreakdown services={services.slice(0, 6)} />
        </Panel>
      </section>

      {/* Funnel ──────────────────────────────────────────────────────── */}
      <section
        className="mb-10"
        style={{ animation: 'reveal 600ms 550ms ease-out both' }}
      >
        <Panel>
          <SectionHeader
            icon={<Zap className="w-4 h-4" />}
            title="Funnel del cliente"
            subtitle="Desde la primera llamada IA hasta el contrato firmado."
            inline
          />
          <FunnelChart stages={data.funnel} />
        </Panel>
      </section>

      <p className="font-mono-ceo text-[10px] uppercase tracking-wider text-white/30 text-right">
        Última actualización: {new Date(data.generated_at).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })}
      </p>

      {/* DRAWERS ─────────────────────────────────────────────────────── */}
      <KpiDrawer
        open={openDrawer === 'pending_signature'}
        onClose={() => setOpenDrawer(null)}
        eyebrow="Operación · pendiente"
        title="Contratos esperando firma"
        bigNumber={String(ops.pending_signature.length)}
        subtitle="Top 10 por antigüedad. Andrium debería estar haciendo seguimiento."
        accent="#F2A900"
      >
        <div className="space-y-2">
          {ops.pending_signature.length === 0 ? (
            <EmptyState text="Sin pendientes — todo firmado." />
          ) : (
            ops.pending_signature.map((c) => (
              <DrawerRow
                key={c.id}
                name={c.client_name}
                subtitle={`${humanizeService(c.service_name)} · creado hace ${c.days_waiting}d`}
                amount={`$${c.total_price.toLocaleString()}`}
                daysLabel={`${c.days_waiting}d`}
                daysTone={c.days_waiting > 7 ? 'bad' : c.days_waiting > 3 ? 'warn' : 'good'}
              />
            ))
          )}
        </div>
      </KpiDrawer>

      <KpiDrawer
        open={openDrawer === 'overdue'}
        onClose={() => setOpenDrawer(null)}
        eyebrow="Cobranza · atrasado"
        title="Clientes con pagos vencidos"
        bigNumber={`$${kpi.revenue_overdue.toLocaleString()}`}
        subtitle={`${ops.overdue_clients.length} clientes. Andrium debería estar cobrando.`}
        accent="#FF8AA0"
      >
        <div className="space-y-2">
          {ops.overdue_clients.length === 0 ? (
            <EmptyState text="Sin pagos vencidos. ✓" />
          ) : (
            ops.overdue_clients.map((c) => {
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
            })
          )}
        </div>
      </KpiDrawer>

      <KpiDrawer
        open={openDrawer === 'signed_this_month'}
        onClose={() => setOpenDrawer(null)}
        eyebrow="Este mes · firmados"
        title="Contratos firmados este mes"
        bigNumber={String(lists?.signed_this_month?.length ?? 0)}
        subtitle="Cada firma es venta cerrada — el trabajo de Andrium."
        accent="#00E5A0"
      >
        <div className="space-y-2">
          {(lists?.signed_this_month ?? []).length === 0 ? (
            <EmptyState text="Ninguno firmado este mes todavía." />
          ) : (
            lists!.signed_this_month.map((c) => (
              <DrawerRow
                key={c.id}
                name={c.client_name}
                subtitle={`${humanizeService(c.service_name)} · ${formatDate(c.signed_at)}`}
                amount={`$${c.total_price.toLocaleString()}`}
              />
            ))
          )}
        </div>
      </KpiDrawer>

      <KpiDrawer
        open={openDrawer === 'new_contracts'}
        onClose={() => setOpenDrawer(null)}
        eyebrow="Este mes · creados"
        title="Contratos nuevos del mes"
        bigNumber={String(lists?.new_contracts_this_month?.length ?? 0)}
        subtitle="Volumen de entrada. Si crecen pero no firman, hay un cuello de botella."
        accent="#7DD3FC"
      >
        <div className="space-y-2">
          {(lists?.new_contracts_this_month ?? []).length === 0 ? (
            <EmptyState text="Ningún contrato nuevo este mes." />
          ) : (
            lists!.new_contracts_this_month.map((c) => (
              <DrawerRow
                key={c.id}
                name={c.client_name}
                subtitle={`${humanizeService(c.service_name)} · ${c.status} · hace ${c.days_old}d`}
                amount={`$${c.total_price.toLocaleString()}`}
                daysLabel={c.status}
                daysTone={c.status === 'firmado' ? 'good' : c.status === 'borrador' ? 'warn' : 'neutral'}
              />
            ))
          )}
        </div>
      </KpiDrawer>

      <KpiDrawer
        open={openDrawer === 'paid_this_month'}
        onClose={() => setOpenDrawer(null)}
        eyebrow="Este mes · cobrado"
        title="Pagos recibidos este mes"
        bigNumber={`$${kpi.revenue_this_month.toLocaleString()}`}
        subtitle={`${lists?.paid_this_month?.length ?? 0} pagos de ${kpi.payments_clients_this_month ?? 0} clientes únicos.`}
        accent="#F2A900"
      >
        <div className="space-y-2">
          {(lists?.paid_this_month ?? []).length === 0 ? (
            <EmptyState text="Sin pagos cobrados este mes." />
          ) : (
            lists!.paid_this_month.map((p) => (
              <DrawerRow
                key={p.payment_id || `${p.client_id}-${p.paid_at}`}
                name={p.client_name}
                subtitle={`Pagó el ${formatDate(p.paid_at)}`}
                amount={`$${p.amount.toLocaleString()}`}
              />
            ))
          )}
        </div>
      </KpiDrawer>

      <style>{`
        @keyframes reveal {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Sub-componentes visuales
// ══════════════════════════════════════════════════════════════════════

function KpiHero({
  eyebrow, value, deltaPct, deltaLabel, sparkline, accent, footnote, onClick,
}: {
  eyebrow: string
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
      className="group relative lg:col-span-1 text-left rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition-all hover:border-amber-400/30 hover:bg-white/[0.04] overflow-hidden"
      style={{
        boxShadow: '0 0 0 1px rgba(242,169,0,0.05) inset',
      }}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-50 transition-opacity group-hover:opacity-90"
        style={{ background: `radial-gradient(circle, ${accent}33 0%, transparent 65%)` }}
      />
      <div className="relative">
        <p className="font-mono-ceo text-[10px] uppercase tracking-[0.2em] text-white/45 font-bold">
          {eyebrow}
        </p>
        <p
          className="font-display font-medium mt-2 leading-none tabular-nums tracking-tight"
          style={{ fontSize: '3.5rem', color: '#F5F7FA' }}
        >
          {value}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              borderColor: positive ? 'rgba(0,229,160,0.3)' : 'rgba(255,77,109,0.3)',
              background: positive ? 'rgba(0,229,160,0.08)' : 'rgba(255,77,109,0.08)',
              color: positive ? '#00E5A0' : '#FF8AA0',
            }}
          >
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(deltaPct).toFixed(0)}%
          </span>
          <span className="text-[11px] text-white/40">{deltaLabel}</span>
        </div>
        <div className="mt-4">
          <Sparkline data={sparkline} width={260} height={48} stroke={accent} fill={`${accent}20`} />
        </div>
        {footnote && (
          <p className="mt-3 font-mono-ceo text-[10px] uppercase tracking-wider text-white/50">
            {footnote}
          </p>
        )}
      </div>
    </button>
  )
}

function KpiCard({
  icon, label, value, deltaPct, deltaLabel, sparkline, sparklineColor, accent, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  deltaPct: number | null
  deltaLabel: string
  sparkline: number[]
  sparklineColor: string
  accent: string
  onClick?: () => void
}) {
  const positive = deltaPct !== null && deltaPct >= 0
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative text-left rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition-all hover:border-white/20 hover:bg-white/[0.045] overflow-hidden"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-30 transition-opacity group-hover:opacity-60"
        style={{ background: `radial-gradient(circle, ${accent}30 0%, transparent 70%)` }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
          >
            {icon}
          </span>
          <ChevronRight className="w-4 h-4 text-white/20 transition-transform group-hover:translate-x-0.5 group-hover:text-white/50" />
        </div>
        <p className="font-mono-ceo text-[10px] uppercase tracking-[0.18em] text-white/45 font-bold">
          {label}
        </p>
        <p
          className="font-display font-medium mt-1 leading-none tabular-nums tracking-tight"
          style={{ fontSize: '2.5rem', color: '#F5F7FA' }}
        >
          {value}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[11px]">
          {deltaPct !== null && (
            <span
              className="inline-flex items-center gap-1"
              style={{ color: positive ? '#00E5A0' : '#FF8AA0' }}
            >
              {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(deltaPct).toFixed(0)}%
            </span>
          )}
          <span className="text-white/40">{deltaLabel}</span>
        </div>
        <div className="mt-3 -mx-1">
          <Sparkline data={sparkline} width={160} height={32} stroke={sparklineColor} fill={`${sparklineColor}15`} showDots={false} />
        </div>
      </div>
    </button>
  )
}

function AlertKpi({
  icon, label, value, tone, subline, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'good' | 'warn' | 'bad'
  subline?: string
  onClick?: () => void
}) {
  const tones = {
    good: { color: '#00E5A0', bg: 'rgba(0,229,160,0.06)', border: 'rgba(0,229,160,0.2)' },
    warn: { color: '#F2A900', bg: 'rgba(242,169,0,0.06)', border: 'rgba(242,169,0,0.2)' },
    bad: { color: '#FF8AA0', bg: 'rgba(255,77,109,0.06)', border: 'rgba(255,77,109,0.25)' },
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="text-left rounded-xl border p-4 transition disabled:opacity-100 enabled:hover:translate-y-[-1px] enabled:hover:shadow-lg"
      style={{ borderColor: tones.border, background: tones.bg, color: tones.color }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="opacity-70">{icon}</span>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-90">{label}</p>
      </div>
      <p className="font-display font-medium leading-none tabular-nums" style={{ fontSize: '2rem' }}>
        {value}
      </p>
      {subline && (
        <p className="mt-2 font-mono-ceo text-[10px] uppercase tracking-wider opacity-60">
          {subline}
        </p>
      )}
    </button>
  )
}

function ActionCard({
  icon, title, description, cta, tone, onClick, disabled,
}: {
  icon: React.ReactNode
  title: string
  description: string
  cta: string
  tone: 'warn' | 'bad' | 'good' | 'info'
  onClick?: () => void
  disabled?: boolean
}) {
  const tones = {
    warn: { dot: '#F2A900', border: 'rgba(242,169,0,0.18)' },
    bad: { dot: '#FF8AA0', border: 'rgba(255,77,109,0.22)' },
    good: { dot: '#00E5A0', border: 'rgba(0,229,160,0.2)' },
    info: { dot: '#7DD3FC', border: 'rgba(125,211,252,0.18)' },
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative text-left rounded-2xl border p-5 transition disabled:cursor-default disabled:opacity-60 enabled:hover:translate-y-[-1px] enabled:hover:shadow-xl bg-white/[0.025]"
      style={{ borderColor: tones.border }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          {!disabled && (
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping"
              style={{ background: tones.dot }}
            />
          )}
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ background: tones.dot }}
          />
        </span>
        <span className="text-white/40">{icon}</span>
      </div>
      <h4 className="font-display text-lg text-white font-medium leading-tight tracking-tight">
        {title}
      </h4>
      <p className="mt-2 text-xs text-white/55 leading-relaxed">{description}</p>
      <div className="mt-4 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-300/80">
        {cta}
        <ArrowRight className="w-3 h-3 transition-transform group-enabled:group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 ${className}`}
    >
      {children}
    </div>
  )
}

function SectionHeader({
  icon, title, subtitle, inline,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  inline?: boolean
}) {
  return (
    <div className={`${inline ? 'mb-4' : 'mb-5'}`}>
      <div className="flex items-center gap-2">
        <span className="text-amber-300/80">{icon}</span>
        <h3 className="font-display text-base text-white font-medium tracking-tight">{title}</h3>
      </div>
      {subtitle && <p className="text-[11px] text-white/45 mt-1">{subtitle}</p>}
    </div>
  )
}

function TrendChart({ points }: { points: CeoDashboardData['trend'] }) {
  if (!points.length) return <p className="text-xs text-white/40">Sin datos</p>
  const maxRev = Math.max(...points.map((p) => p.revenue_collected), 1)
  return (
    <div>
      <div className="grid grid-cols-6 gap-2 h-32 items-end">
        {points.map((p) => {
          const height = (p.revenue_collected / maxRev) * 100
          return (
            <div key={p.month} className="flex flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t-md transition-all hover:opacity-100"
                style={{
                  height: `${Math.max(2, height)}%`,
                  background: 'linear-gradient(to top, rgba(242,169,0,0.7), rgba(242,169,0,0.25))',
                  opacity: 0.85,
                }}
                title={`$${p.revenue_collected.toLocaleString()}`}
              />
              <span className="font-mono-ceo text-[9px] uppercase text-white/45 tracking-wide">
                {p.label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
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

function ServicesBreakdown({ services }: { services: CeoDashboardData['services'] }) {
  const visible = services.filter((s) => s.contracts > 0 || s.cases > 0)
  if (!visible.length) return <p className="text-xs text-white/40">Sin servicios con actividad</p>
  const maxRev = Math.max(...visible.map((s) => s.revenue_signed), 1)

  return (
    <div className="space-y-2.5">
      {visible.map((s) => {
        const pct = (s.revenue_signed / maxRev) * 100
        return (
          <div key={s.slug}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-white font-medium truncate flex-1 mr-2">{s.name}</span>
              <span className="font-mono-ceo text-white/70 tabular-nums flex-shrink-0">
                ${s.revenue_signed.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(3, pct)}%`,
                  background: 'linear-gradient(90deg, #F2A900, #FFD56B)',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FunnelChart({ stages }: { stages: CeoDashboardData['funnel'] }) {
  const max = Math.max(...stages.map((s) => s.count), 1)
  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const pct = (stage.count / max) * 100
        const prev = i > 0 ? stages[i - 1] : null
        const conversion = prev && prev.count > 0 ? (stage.count / prev.count) * 100 : null
        return (
          <div key={stage.key}>
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="text-white font-medium">{stage.label}</span>
              <div className="flex items-center gap-2">
                {conversion !== null && (
                  <span
                    className="font-mono-ceo text-[10px]"
                    style={{
                      color:
                        conversion >= 50 ? '#00E5A0' : conversion >= 20 ? '#F2A900' : '#FF8AA0',
                    }}
                  >
                    {conversion.toFixed(0)}%
                  </span>
                )}
                <span className="font-display text-white tabular-nums">{stage.count}</span>
              </div>
            </div>
            <div className="h-6 bg-white/[0.04] rounded-md overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${Math.max(2, pct)}%`,
                  background: `linear-gradient(90deg, rgba(242,169,0,${0.4 + (i * 0.08)}), rgba(255,213,107,${0.4 + (i * 0.08)}))`,
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
      <p className="font-mono-ceo text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="font-display text-base text-white mt-0.5 tabular-nums">{value}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <CheckCircle2 className="w-10 h-10 text-emerald-400/60 mb-3" />
      <p className="text-sm text-white/60">{text}</p>
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
    return new Date(iso).toLocaleDateString('es-US', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, ChevronRight, CheckCircle2 } from 'lucide-react'
import type { CeoDashboardData } from '@/lib/ceo-dashboard-data'
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

type Period = 'today' | 'week' | 'month'

const PERIOD_OPTIONS: { key: Period; label: string; sub: string }[] = [
  { key: 'today', label: 'Hoy', sub: 'lo que pasó hoy' },
  { key: 'week', label: 'Semana', sub: 'últimos 7 días' },
  { key: 'month', label: 'Mes', sub: 'este mes' },
]

type TrendView = 'monthly' | 'yearly'

export function CeoDashboardV2({ data, firstName }: Props) {
  const [period, setPeriod] = useState<Period>('month')
  const [trendView, setTrendView] = useState<TrendView>('monthly')
  // Snapshot al mount para evitar Date.now() en render (react-hooks/purity).
  // Los "días vencidos" se calculan vs este timestamp — se refresca con
  // cada navegación al dashboard, suficiente para los KPIs operativos.
  const [nowMs] = useState(() => Date.now())
  const [openDrawer, setOpenDrawer] = useState<DrawerKey>(null)
  const { kpi, ops, trend, lists } = data

  const trendPoints = trendView === 'yearly' && data.trend_yearly?.length
    ? data.trend_yearly
    : trend

  // Métricas filtradas por el período activo (con fallback a mes pasado si no llegan)
  const currentPeriod = data.periods?.[period] ?? {
    revenue: kpi.revenue_this_month,
    contracts_signed: kpi.contracts_signed_this_month ?? 0,
    contracts_new: kpi.contracts_new_this_month ?? 0,
    payments_count: kpi.payments_clients_this_month ?? 0,
  }

  const monthDelta = useMemo(() => {
    if (period !== 'month') return null
    if (!kpi.revenue_last_month) return kpi.revenue_this_month > 0 ? 100 : 0
    return ((kpi.revenue_this_month - kpi.revenue_last_month) / kpi.revenue_last_month) * 100
  }, [period, kpi.revenue_this_month, kpi.revenue_last_month])

  const pendingCount = kpi.contracts_pending_signature_count ?? ops.pending_signature.length
  const overdueCount = kpi.payments_clients_overdue ?? ops.overdue_clients.length

  const periodLabel = PERIOD_OPTIONS.find((p) => p.key === period)?.label ?? 'Mes'
  const periodSub = PERIOD_OPTIONS.find((p) => p.key === period)?.sub ?? ''

  return (
    <div className="ceo-scope font-sora min-h-screen" style={{ background: 'var(--ceo-bg)' }}>
      <div className="mx-auto w-full max-w-[1320px] px-6 lg:px-12 py-12 lg:py-16">

        {/* ──────────────────────────────────────────────────────────
            SECCIÓN 0 · SALUDO
            ────────────────────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-6 flex-wrap mb-14">
          <div>
            <p className="font-mono-ceo text-[11px] uppercase tracking-[0.28em] text-white/55 font-medium">
              Vista CEO · UsaLatino Prime
            </p>
            <h1 className="font-display mt-3 text-5xl lg:text-7xl text-white font-light leading-[1.05] tracking-[-0.03em]">
              Hola, {firstName}.
            </h1>
            <p className="mt-4 max-w-lg text-base lg:text-lg text-white/75 leading-relaxed">
              Esto es lo que está pasando en tu empresa{' '}
              <span className="text-white">ahora mismo</span>.
            </p>
          </div>
          <LiveClock />
        </header>

        {/* ──────────────────────────────────────────────────────────
            SECCIÓN 1 · TOGGLE DE PERÍODO
            Botones grandes con el período activo destacado.
            ────────────────────────────────────────────────────────── */}
        <section className="mb-10">
          <p className="font-mono-ceo text-[10px] uppercase tracking-[0.24em] text-white/65 font-medium mb-4">
            Ver datos de
          </p>
          <div className="inline-flex items-center gap-2 p-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPeriod(opt.key)}
                  className={`relative px-6 py-3.5 rounded-xl transition-all ${
                    active
                      ? 'bg-white text-black shadow-lg shadow-black/30'
                      : 'text-white/75 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="font-display text-base font-semibold tracking-tight">
                    {opt.label}
                  </span>
                  <span className={`ml-3 font-mono-ceo text-[10px] uppercase tracking-wider ${
                    active ? 'text-black/55' : 'text-white/50'
                  }`}>
                    {opt.sub}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ──────────────────────────────────────────────────────────
            SECCIÓN 2 · LO MÁS IMPORTANTE — 3 KPIs hero
            Números gigantes. Cero distracciones. Click para ver detalle.
            ────────────────────────────────────────────────────────── */}
        <section className="mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <HeroKpi
              label="Cobrado"
              periodLabel={periodLabel}
              value={`$${currentPeriod.revenue.toLocaleString()}`}
              subtext={
                currentPeriod.payments_count > 0
                  ? `de ${currentPeriod.payments_count} ${currentPeriod.payments_count === 1 ? 'pago' : 'pagos'}`
                  : 'sin pagos en este período'
              }
              deltaPct={monthDelta}
              deltaLabel={
                period === 'month' && kpi.revenue_last_month
                  ? `vs $${kpi.revenue_last_month.toLocaleString()} mes pasado`
                  : undefined
              }
              accent="var(--ceo-gold)"
              onClick={() => setOpenDrawer('paid_this_month')}
            />
            <HeroKpi
              label="Contratos firmados"
              periodLabel={periodLabel}
              value={String(currentPeriod.contracts_signed)}
              subtext={
                currentPeriod.contracts_signed === 0
                  ? 'todavía no hay firmas'
                  : currentPeriod.contracts_signed === 1
                    ? 'un contrato cerrado'
                    : `${currentPeriod.contracts_signed} contratos cerrados`
              }
              accent="var(--ceo-good)"
              onClick={() => setOpenDrawer('signed_this_month')}
            />
            <HeroKpi
              label="Contratos nuevos"
              periodLabel={periodLabel}
              value={String(currentPeriod.contracts_new)}
              subtext={
                currentPeriod.contracts_new === 0
                  ? 'sin contratos nuevos'
                  : `${currentPeriod.contracts_new} ${currentPeriod.contracts_new === 1 ? 'nuevo cliente' : 'nuevos clientes'}`
              }
              accent="rgba(255,255,255,0.7)"
              onClick={() => setOpenDrawer('new_contracts')}
            />
          </div>
          <p className="mt-5 font-mono-ceo text-[10px] uppercase tracking-wider text-white/50">
            {periodSub} · click sobre cualquier número para ver detalle
          </p>
        </section>

        {/* ──────────────────────────────────────────────────────────
            SECCIÓN 3 · NECESITAN TU ATENCIÓN
            Solo problemas en curso. Cards grandes, claros.
            ────────────────────────────────────────────────────────── */}
        <section className="mb-20">
          <SectionTitle
            number="01"
            title="Necesitan tu atención"
            subtitle="Lo que Andrium debería estar resolviendo hoy."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <AttentionCard
              tone="warn"
              big={String(pendingCount)}
              label={pendingCount === 1 ? 'Contrato esperando firma' : 'Contratos esperando firma'}
              description={
                ops.pending_signature.length > 0
                  ? `${ops.pending_signature[0].client_name} lleva ${ops.pending_signature[0].days_waiting} días esperando.`
                  : 'Todos los contratos están firmados o aún sin enviar.'
              }
              actionText="Ver lista completa"
              onClick={() => setOpenDrawer('pending_signature')}
              disabled={pendingCount === 0}
            />
            <AttentionCard
              tone="bad"
              big={`$${kpi.revenue_overdue.toLocaleString()}`}
              label={overdueCount === 1 ? 'cliente con pago vencido' : 'clientes con pagos vencidos'}
              labelCountPrefix={String(overdueCount)}
              description={
                ops.overdue_clients.length > 0
                  ? `El mayor adeudo: ${ops.overdue_clients[0].name} — $${ops.overdue_clients[0].total_overdue.toLocaleString()}.`
                  : 'Cero deudas vencidas. ✓'
              }
              actionText="Ver clientes morosos"
              onClick={() => setOpenDrawer('overdue')}
              disabled={overdueCount === 0}
            />
          </div>
        </section>

        {/* ──────────────────────────────────────────────────────────
            SECCIÓN 4 · PIPELINE DE CONTRATOS
            En qué estado están todos los contratos. Visual claro.
            ────────────────────────────────────────────────────────── */}
        <section className="mb-20">
          <SectionTitle
            number="02"
            title="Pipeline de contratos"
            subtitle="Estado actual de todos los contratos en tu empresa."
          />
          <ContractPipeline items={data.contracts_by_status ?? []} />
        </section>

        {/* ──────────────────────────────────────────────────────────
            SECCIÓN 5 · SERVICIOS — qué se demanda más
            ────────────────────────────────────────────────────────── */}
        <section className="mb-20">
          <SectionTitle
            number="03"
            title="Servicios más demandados"
            subtitle="Ranking por clientes — qué pide más gente, cuánto genera cada uno."
          />
          <ServicesTable items={data.services_ranking ?? []} />
        </section>

        {/* ──────────────────────────────────────────────────────────
            SECCIÓN 6 · EVOLUCIÓN HISTÓRICA — con toggle Mensual/Anual
            ────────────────────────────────────────────────────────── */}
        <section className="mb-20">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-7">
            <SectionTitle
              number="04"
              title="Evolución del negocio"
              subtitle={
                trendView === 'monthly'
                  ? 'Cambio porcentual mes a mes de los últimos 6 meses.'
                  : 'Cambio porcentual año a año de los últimos 5 años.'
              }
            />
            {/* Toggle Mensual / Anual */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-white/[0.08] bg-white/[0.02] mb-0">
              <button
                type="button"
                onClick={() => setTrendView('monthly')}
                className={`px-4 py-2 rounded-lg transition-all font-mono-ceo text-[11px] uppercase tracking-[0.18em] font-medium ${
                  trendView === 'monthly'
                    ? 'bg-white text-black'
                    : 'text-white/65 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setTrendView('yearly')}
                disabled={!data.trend_yearly?.length}
                className={`px-4 py-2 rounded-lg transition-all font-mono-ceo text-[11px] uppercase tracking-[0.18em] font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                  trendView === 'yearly'
                    ? 'bg-white text-black'
                    : 'text-white/65 enabled:hover:text-white enabled:hover:bg-white/[0.04]'
                }`}
              >
                Anual
              </button>
            </div>
          </div>
          <div
            className="rounded-2xl border border-white/[0.08] p-7 lg:p-9"
            style={{ background: 'rgba(255,255,255,0.012)' }}
          >
            <TrendChart points={trendPoints} view={trendView} />
          </div>
        </section>

        {/* ──────────────────────────────────────────────────────────
            SECCIÓN 7 · FUNNEL DEL CLIENTE
            ────────────────────────────────────────────────────────── */}
        <section className="mb-12">
          <SectionTitle
            number="05"
            title="Funnel del cliente"
            subtitle="Desde la primera llamada IA hasta el contrato firmado."
          />
          <div
            className="rounded-2xl border border-white/[0.08] p-7 lg:p-9"
            style={{ background: 'rgba(255,255,255,0.012)' }}
          >
            <FunnelChart stages={data.funnel} />
          </div>
        </section>

        <p className="font-mono-ceo text-[11px] uppercase tracking-[0.18em] text-white/50 text-right">
          última actualización ·{' '}
          {new Date(data.generated_at).toLocaleTimeString('es-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>

        {/* ── DRAWERS ──────────────────────────────────────────────── */}
        <KpiDrawer
          open={openDrawer === 'pending_signature'}
          onClose={() => setOpenDrawer(null)}
          eyebrow="Pendiente firma"
          title="Esperando firma del cliente"
          bigNumber={String(ops.pending_signature.length)}
          subtitle="Andrium debería estar haciendo seguimiento."
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
          eyebrow="Pagos vencidos"
          title="Clientes con deudas"
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
                  (nowMs - new Date(c.oldest_due_date).getTime()) / 86400_000,
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
 * Encabezado numerado por sección. Estilo Apple landing page —
 * número grande gris arriba + título grande + subtítulo.
 */
function SectionTitle({
  number, title, subtitle,
}: {
  number: string
  title: string
  subtitle: string
}) {
  return (
    <div className="mb-7 flex items-baseline gap-5">
      <span className="font-display text-3xl lg:text-4xl font-light text-white/40 tabular-nums leading-none">
        {number}
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-2xl lg:text-3xl text-white font-medium leading-tight tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-sm lg:text-base text-white/65 leading-relaxed">{subtitle}</p>
      </div>
    </div>
  )
}

/**
 * KPI hero — número MUY grande, label arriba pequeño, click para drill-down.
 * Estilo Apple feature card (rounded-2xl, padding generoso, hover sutil).
 */
function HeroKpi({
  label, periodLabel, value, subtext, deltaPct, deltaLabel, accent, onClick,
}: {
  label: string
  periodLabel: string
  value: string
  subtext: string
  deltaPct?: number | null
  deltaLabel?: string
  accent: string
  onClick?: () => void
}) {
  const positive = deltaPct != null && deltaPct >= 0
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative text-left rounded-2xl border border-white/[0.08] p-7 lg:p-9 transition-all hover:border-white/20 overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.012)' }}
    >
      {/* Línea dorada arriba en hover */}
      <span
        className="absolute top-0 left-7 right-7 h-px opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: accent }}
      />

      {/* Top label + chevron */}
      <div className="flex items-start justify-between gap-3 mb-8">
        <div>
          <p className="font-mono-ceo text-[11px] uppercase tracking-[0.22em] text-white/65 font-medium">
            {label}
          </p>
          <p className="mt-1.5 font-mono-ceo text-[10px] uppercase tracking-wider text-white/45">
            {periodLabel}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-white/40 transition-all group-hover:translate-x-0.5 group-hover:text-white" />
      </div>

      {/* Número GIGANTE */}
      <p
        className="font-display font-light leading-none tabular-nums tracking-[-0.03em] text-white"
        style={{ fontSize: 'clamp(3rem, 5.5vw, 4.75rem)' }}
      >
        {value}
      </p>

      {/* Subtexto */}
      <p className="mt-5 text-sm text-white/75 leading-relaxed">{subtext}</p>

      {/* Delta % opcional */}
      {deltaPct != null && deltaLabel && (
        <div className="mt-4 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 font-mono-ceo text-[11px] uppercase tracking-wider font-medium"
            style={{ color: positive ? 'var(--ceo-good)' : 'var(--ceo-bad)' }}
          >
            {positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(deltaPct).toFixed(0)}%
          </span>
          <span className="font-mono-ceo text-[11px] uppercase tracking-wider text-white/55">
            {deltaLabel}
          </span>
        </div>
      )}
    </button>
  )
}

/**
 * Card de "necesita atención" — número grande con label dentro de la
 * misma línea. Look Apple banner card.
 */
function AttentionCard({
  tone, big, label, labelCountPrefix, description, actionText, onClick, disabled,
}: {
  tone: 'warn' | 'bad'
  big: string
  label: string
  labelCountPrefix?: string
  description: string
  actionText: string
  onClick?: () => void
  disabled?: boolean
}) {
  const accent = tone === 'warn' ? 'var(--ceo-gold)' : 'var(--ceo-bad)'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative text-left rounded-2xl border p-7 lg:p-9 transition-all overflow-hidden disabled:cursor-default disabled:opacity-50 enabled:hover:bg-white/[0.025]"
      style={{
        background: 'rgba(255,255,255,0.012)',
        borderColor: disabled ? 'var(--admin-border)' : 'rgba(255,255,255,0.10)',
      }}
    >
      {/* Línea de acento arriba (cuando no disabled) */}
      {!disabled && (
        <span
          className="absolute top-0 left-7 right-7 h-px"
          style={{ background: accent, opacity: 0.5 }}
        />
      )}

      <div className="flex items-baseline gap-5 mb-5 flex-wrap">
        <span
          className="font-display font-light leading-none tabular-nums tracking-[-0.03em]"
          style={{ fontSize: 'clamp(2.75rem, 5vw, 4.25rem)', color: accent }}
        >
          {big}
        </span>
        <span className="text-base lg:text-lg text-white/85 leading-tight font-medium">
          {labelCountPrefix && (
            <span className="font-display text-2xl font-light text-white/95 mr-2 tabular-nums">
              {labelCountPrefix}
            </span>
          )}
          {label}
        </span>
      </div>

      <p className="text-sm lg:text-base text-white/75 leading-relaxed mb-5">{description}</p>

      <div
        className="inline-flex items-center gap-2 font-mono-ceo text-[11px] uppercase tracking-[0.2em] font-medium"
        style={{ color: disabled ? 'rgba(255,255,255,0.35)' : accent }}
      >
        {actionText}
        {!disabled && (
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-enabled:group-hover:translate-x-0.5" />
        )}
      </div>
    </button>
  )
}

/**
 * Pipeline de contratos — stack horizontal + 6 cards numéricas debajo
 * (una por estado). Grid responsive con tipografía grande.
 */
function ContractPipeline({
  items,
}: {
  items: NonNullable<CeoDashboardData['contracts_by_status']>
}) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-white/[0.08] p-9 text-center text-base text-white/65"
        style={{ background: 'rgba(255,255,255,0.012)' }}>
        Sin contratos en el pipeline todavía.
      </div>
    )
  }
  const totalCount = items.reduce((s, x) => s + x.count, 0) || 1
  const totalValue = items.reduce((s, x) => s + x.total_value, 0)

  const colorFor = (status: string): string => {
    switch (status) {
      case 'borrador': return 'rgba(255, 255, 255, 0.35)'
      case 'pendiente_firma': return '#E8B84A'
      case 'firmado': return '#4ADE80'
      case 'activo': return '#7DD3FC'
      case 'completado': return '#FFFFFF'
      case 'cancelado': return '#F87171'
      default: return 'rgba(255, 255, 255, 0.45)'
    }
  }

  return (
    <div
      className="rounded-2xl border border-white/[0.08] p-7 lg:p-9"
      style={{ background: 'rgba(255,255,255,0.012)' }}
    >
      {/* Totales arriba */}
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="font-mono-ceo text-[11px] uppercase tracking-[0.22em] text-white/65 font-medium">
            Total en el pipeline
          </p>
          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
            <span className="font-display text-4xl lg:text-5xl text-white font-light tabular-nums tracking-tight">
              {totalCount}
            </span>
            <span className="text-base text-white/75">contratos</span>
            <span className="text-white/30 mx-1">·</span>
            <span className="font-display text-2xl lg:text-3xl text-white/85 font-light tabular-nums tracking-tight">
              ${totalValue.toLocaleString()}
            </span>
            <span className="text-sm text-white/65">en valor</span>
          </div>
        </div>
      </div>

      {/* Stack horizontal grande */}
      <div className="flex h-4 w-full overflow-hidden rounded-md bg-white/[0.04] mb-8">
        {items.map((s) => {
          const pct = (s.count / totalCount) * 100
          if (pct < 0.5) return null
          return (
            <div
              key={s.status}
              style={{ width: `${pct}%`, background: colorFor(s.status), opacity: 0.9 }}
              title={`${s.label}: ${s.count}`}
            />
          )
        })}
      </div>

      {/* Cards numéricas — una por estado */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px"
        style={{ background: 'var(--admin-accent-soft)' }}>
        {items.map((s) => {
          const color = colorFor(s.status)
          const pct = (s.count / totalCount) * 100
          return (
            <div key={s.status} className="px-5 py-6"
              style={{ background: 'rgba(20, 20, 22, 1)' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <p className="font-mono-ceo text-[11px] uppercase tracking-[0.18em] text-white/75 font-medium truncate">
                  {s.label}
                </p>
              </div>
              <p
                className="font-display text-4xl lg:text-5xl font-light tabular-nums leading-none tracking-[-0.02em]"
                style={{ color: s.status === 'borrador' ? 'var(--ceo-text)' : color }}
              >
                {s.count}
              </p>
              <p className="mt-3 text-sm text-white/75 tabular-nums">
                ${s.total_value.toLocaleString()}
              </p>
              <p className="mt-1 font-mono-ceo text-[10px] uppercase tracking-wider text-white/55 tabular-nums">
                {pct.toFixed(1)}% del total
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Servicios — mobile-first. En pantallas chicas cada servicio es una
 * card apilada con métricas en grid 3x1. En desktop se convierte en
 * tabla horizontal con columnas alineadas. Sin truncate forzado en
 * mobile — el nombre completo es visible aunque ocupe 2 líneas.
 */
function ServicesTable({
  items,
}: {
  items: NonNullable<CeoDashboardData['services_ranking']>
}) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-white/[0.08] p-9 text-center text-base text-white/65"
        style={{ background: 'rgba(255,255,255,0.012)' }}>
        Sin actividad por servicio todavía.
      </div>
    )
  }
  const maxClients = Math.max(...items.map((s) => s.unique_clients), 1)
  return (
    <div
      className="rounded-2xl border border-white/[0.08] overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.012)' }}
    >
      {/* HEADER — visible solo en desktop. En mobile lo ocultamos porque
          cada card tiene sus propios labels. */}
      <div className="hidden lg:grid lg:grid-cols-[40px_1fr_140px_140px_180px] gap-6 border-b border-white/[0.08] px-8 py-4 font-mono-ceo text-[11px] uppercase tracking-[0.18em] text-white/65 font-medium">
        <div>#</div>
        <div>Servicio</div>
        <div className="text-right">Clientes</div>
        <div className="text-right">Firmados</div>
        <div className="text-right">Ingreso</div>
      </div>

      {/* ROWS */}
      {items.map((s, idx) => {
        const widthPct = (s.unique_clients / maxClients) * 100
        return (
          <div
            key={s.slug}
            className="group relative border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] last:border-b-0"
          >
            {/* Barra de fondo proporcional (visible en ambos breakpoints) */}
            <span
              className="pointer-events-none absolute inset-y-0 left-0"
              style={{
                width: `${widthPct}%`,
                background:
                  'linear-gradient(90deg, rgba(232,184,74,0.06) 0%, rgba(232,184,74,0.01) 100%)',
              }}
            />

            {/* ── MOBILE: stack vertical (oculto en lg+) ────────────── */}
            <div className="relative lg:hidden px-5 py-6">
              {/* Top row: rank + nombre */}
              <div className="flex items-start gap-3 mb-4">
                <span className="font-mono-ceo text-sm text-white/65 tabular-nums flex-shrink-0 mt-1">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base sm:text-lg text-white font-medium leading-snug break-words">
                    {s.name}
                  </p>
                  <p className="mt-1.5 font-mono-ceo text-[11px] uppercase tracking-wider text-white/55">
                    {s.share_pct}% de la demanda
                  </p>
                </div>
              </div>

              {/* Métricas: grid 3 columnas con labels propios */}
              <div className="grid grid-cols-3 gap-3 mt-5">
                <MobileMetric
                  label="Clientes"
                  value={String(s.unique_clients)}
                />
                <MobileMetric
                  label="Firmados"
                  value={String(s.contracts_signed)}
                />
                <MobileMetric
                  label="Ingreso"
                  value={`$${s.revenue_signed.toLocaleString()}`}
                  small
                />
              </div>
            </div>

            {/* ── DESKTOP: tabla horizontal (oculto en mobile) ──────── */}
            <div className="relative hidden lg:grid lg:grid-cols-[40px_1fr_140px_140px_180px] gap-6 px-8 py-5 items-center">
              <div className="font-mono-ceo text-base text-white/75 tabular-nums">
                {String(idx + 1).padStart(2, '0')}
              </div>
              <div className="min-w-0">
                <p className="text-lg text-white font-medium leading-tight truncate">
                  {s.name}
                </p>
                <p className="mt-1 font-mono-ceo text-[11px] uppercase tracking-wider text-white/55">
                  {s.share_pct}% de la demanda
                </p>
              </div>
              <div className="text-right font-display text-2xl text-white tabular-nums font-light tracking-tight">
                {s.unique_clients}
              </div>
              <div className="text-right font-display text-2xl text-white tabular-nums font-light tracking-tight">
                {s.contracts_signed}
              </div>
              <div className="text-right font-display text-2xl text-white tabular-nums font-light tracking-tight">
                ${s.revenue_signed.toLocaleString()}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MobileMetric({
  label, value, small,
}: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <p className="font-mono-ceo text-[10px] uppercase tracking-wider text-white/55 font-medium mb-1.5">
        {label}
      </p>
      <p
        className={`font-display font-light text-white tabular-nums leading-none tracking-tight ${
          small ? 'text-base' : 'text-2xl'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

/**
 * Evolución basada en % de cambio. Acepta puntos mensuales (6 meses)
 * o anuales (5 años) según el toggle. Look minimalista Apple:
 *  - KPI grande arriba: crecimiento total del período (+X%)
 *  - 3 stats secundarias: mejor / peor / promedio
 *  - Lista detalle con % vs el período anterior + ingreso pequeño
 */
function TrendChart({
  points,
  view = 'monthly',
}: {
  points: CeoDashboardData['trend']
  view?: 'monthly' | 'yearly'
}) {
  if (!points.length) return <p className="text-base text-white/65">Sin datos</p>

  const isYearly = view === 'yearly'
  const unitLabel = isYearly ? 'año' : 'mes'
  const unitLabelPlural = isYearly ? 'años' : 'meses'
  const totalPeriodLabel = isYearly
    ? `Crecimiento últimos ${points.length} ${unitLabelPlural}`
    : `Crecimiento últimos ${points.length} ${unitLabelPlural}`

  // Calcular crecimiento punto a punto
  const changes = points.map((p, i) => {
    const prev = i > 0 ? points[i - 1].revenue_collected : 0
    const cur = p.revenue_collected
    const pct = prev > 0 ? ((cur - prev) / prev) * 100 : (cur > 0 ? 100 : 0)
    return { ...p, pct, prev }
  })

  // Excluir el primer punto (no tiene comparación) para los stats
  const withDelta = changes.slice(1)
  const totalGrowth = (() => {
    const first = points[0].revenue_collected
    const last = points[points.length - 1].revenue_collected
    if (first === 0) return last > 0 ? 100 : 0
    return ((last - first) / first) * 100
  })()

  const avgGrowth = withDelta.length > 0
    ? withDelta.reduce((s, p) => s + p.pct, 0) / withDelta.length
    : 0

  const best = withDelta.length > 0
    ? withDelta.reduce((max, p) => (p.pct > max.pct ? p : max), withDelta[0])
    : null

  const worst = withDelta.length > 0
    ? withDelta.reduce((min, p) => (p.pct < min.pct ? p : min), withDelta[0])
    : null

  const totalIsPositive = totalGrowth >= 0
  const fromLabel = points[0].label

  return (
    <div>
      {/* HERO: crecimiento total del período */}
      <div className="flex items-start justify-between gap-6 flex-wrap mb-10">
        <div>
          <p className="font-mono-ceo text-[11px] uppercase tracking-[0.22em] text-white/65 font-medium">
            {totalPeriodLabel}
          </p>
          <div className="mt-3 flex items-baseline gap-3 flex-wrap">
            <span
              className="font-display font-light leading-none tabular-nums tracking-[-0.03em]"
              style={{
                fontSize: 'clamp(3rem, 6vw, 5rem)',
                color: totalIsPositive ? 'var(--ceo-good)' : 'var(--ceo-bad)',
              }}
            >
              {totalIsPositive ? '+' : ''}{totalGrowth.toFixed(0)}%
            </span>
            <div className="flex items-center gap-1.5">
              {totalIsPositive ? (
                <ArrowUpRight className="w-5 h-5" style={{ color: 'var(--ceo-good)' }} />
              ) : (
                <ArrowDownRight className="w-5 h-5" style={{ color: 'var(--ceo-bad)' }} />
              )}
            </div>
          </div>
          <p className="mt-4 text-sm lg:text-base text-white/75 leading-relaxed max-w-md">
            {totalIsPositive
              ? `Tu negocio creció ${totalGrowth.toFixed(0)}% desde ${fromLabel}.`
              : `Tu negocio cayó ${Math.abs(totalGrowth).toFixed(0)}% desde ${fromLabel}.`}
          </p>
        </div>

        {/* Stats secundarias: mejor / peor / promedio */}
        <div className="grid grid-cols-3 gap-4 lg:gap-6 w-full lg:w-auto lg:min-w-[420px]">
          <CompactStat
            label={`Mejor ${unitLabel}`}
            value={best ? `${best.pct >= 0 ? '+' : ''}${best.pct.toFixed(0)}%` : '—'}
            hint={best?.label}
            tone={best && best.pct >= 0 ? 'good' : 'bad'}
          />
          <CompactStat
            label={`Peor ${unitLabel}`}
            value={worst ? `${worst.pct >= 0 ? '+' : ''}${worst.pct.toFixed(0)}%` : '—'}
            hint={worst?.label}
            tone={worst && worst.pct >= 0 ? 'good' : 'bad'}
          />
          <CompactStat
            label="Promedio"
            value={`${avgGrowth >= 0 ? '+' : ''}${avgGrowth.toFixed(0)}%`}
            hint={isYearly ? 'anual' : 'mensual'}
            tone={avgGrowth >= 0 ? 'good' : 'bad'}
          />
        </div>
      </div>

      {/* Lista período a período con % de cambio */}
      <div className="border-t border-white/[0.06] pt-6">
        <p className="font-mono-ceo text-[11px] uppercase tracking-[0.22em] text-white/65 font-medium mb-5">
          {isYearly ? 'Detalle año a año' : 'Detalle mes a mes'}
        </p>
        <div className="space-y-3">
          {changes.map((m, i) => {
            const hasDelta = i > 0
            const positive = m.pct >= 0
            const barWidth = hasDelta ? Math.min(100, Math.abs(m.pct)) : 0
            return (
              <div
                key={m.month}
                className="grid grid-cols-[80px_1fr_120px] sm:grid-cols-[120px_1fr_160px] gap-3 sm:gap-5 items-center"
              >
                <span className="font-mono-ceo text-xs sm:text-sm uppercase tracking-wider text-white/85 capitalize font-medium">
                  {m.label}
                </span>

                {/* Barra de % desde el centro */}
                <div className="relative h-7 flex items-center">
                  {hasDelta ? (
                    <>
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.10]" />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-sm transition-all"
                        style={{
                          left: positive ? '50%' : `${50 - (barWidth / 2)}%`,
                          width: `${barWidth / 2}%`,
                          background: positive ? 'var(--ceo-good)' : 'var(--ceo-bad)',
                          opacity: 0.85,
                        }}
                      />
                    </>
                  ) : (
                    <span className="font-mono-ceo text-[10px] uppercase tracking-wider text-white/40">
                      {isYearly ? 'año base' : 'mes base'}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  {hasDelta ? (
                    <span
                      className="font-display text-lg sm:text-xl tabular-nums font-light tracking-tight"
                      style={{ color: positive ? 'var(--ceo-good)' : 'var(--ceo-bad)' }}
                    >
                      {positive ? '+' : ''}{m.pct.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="font-display text-base sm:text-lg text-white/65 tabular-nums font-light">
                      —
                    </span>
                  )}
                  <p className="mt-0.5 font-mono-ceo text-[10px] uppercase tracking-wider text-white/55 tabular-nums">
                    ${m.revenue_collected.toLocaleString()}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CompactStat({
  label, value, hint, tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'good' | 'bad' | 'neutral'
}) {
  const color =
    tone === 'good' ? 'var(--ceo-good)' :
    tone === 'bad'  ? 'var(--ceo-bad)'  :
    'var(--ceo-text)'
  return (
    <div>
      <p className="font-mono-ceo text-[10px] uppercase tracking-wider text-white/65 font-medium mb-1.5">
        {label}
      </p>
      <p
        className="font-display text-xl lg:text-2xl tabular-nums font-light tracking-tight leading-none"
        style={{ color }}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 font-mono-ceo text-[10px] uppercase tracking-wider text-white/55 capitalize">
          {hint}
        </p>
      )}
    </div>
  )
}

function FunnelChart({ stages }: { stages: CeoDashboardData['funnel'] }) {
  const max = Math.max(...stages.map((s) => s.count), 1)
  return (
    <div className="space-y-4">
      {stages.map((stage, i) => {
        const pct = (stage.count / max) * 100
        const prev = i > 0 ? stages[i - 1] : null
        const conversion = prev && prev.count > 0 ? (stage.count / prev.count) * 100 : null
        return (
          <div key={stage.key}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-base text-white font-medium">{stage.label}</span>
              <div className="flex items-center gap-4">
                {conversion !== null && (
                  <span
                    className="font-mono-ceo text-[11px] uppercase tracking-wider"
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
                <span className="font-display text-2xl text-white tabular-nums w-16 text-right font-light">
                  {stage.count}
                </span>
              </div>
            </div>
            <div className="h-2 bg-white/[0.04] overflow-hidden rounded-sm">
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CheckCircle2 className="w-10 h-10 text-emerald-400/55 mb-4" />
      <p className="text-base text-white/75">{text}</p>
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

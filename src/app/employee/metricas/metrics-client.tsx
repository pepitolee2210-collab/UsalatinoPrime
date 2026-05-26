'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, AlertTriangle, Clock, Users, DollarSign, Timer, Target, Trophy } from 'lucide-react'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

interface Payment {
  id: string
  amount: number
  status: string
  due_date: string | null
  paid_at: string | null
  client_id: string
  client: { first_name: string; last_name: string; phone: string | null } | null
}

interface Contract {
  id: string
  client_full_name: string
  service_name: string
  total_price: number
  status: string
  created_at: string
  signed_at: string | null
}

interface Props {
  payments: Payment[]
  contracts: Contract[]
}

type Filter = 'all' | 'overdue' | 'upcoming' | 'paid'

// ─── Card / Pill helpers ───────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border)',
        boxShadow: 'var(--admin-shadow, 0 1px 3px rgba(11,31,58,0.04))',
      }}
    >
      {children}
    </div>
  )
}

function Pill({ tone, children }: { tone: 'green' | 'red'; children: React.ReactNode }) {
  const map = {
    green: { bg: 'var(--admin-green-soft)', text: 'var(--admin-green)', border: 'var(--admin-green)' },
    red:   { bg: 'var(--admin-red-soft)',   text: 'var(--admin-red)',   border: 'var(--admin-red)' },
  }[tone]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full"
      style={{
        background: map.bg,
        color: map.text,
        border: `0.5px solid ${map.border}`,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  )
}

export function MetricsClient({ payments, contracts }: Props) {
  const [filter, setFilter] = useState<Filter>('overdue')

  // Snapshot al mount: estabiliza `now` para que los useMemo no recalculen
  // por construir un Date nuevo en cada render. Las métricas no necesitan
  // ticker — refrescan al navegar.
  const [now] = useState(() => new Date())
  const todayStr = now.toISOString().slice(0, 10)
  const sevenDays = new Date(now.getTime() + 7 * 86400_000)
  const sevenDaysStr = sevenDays.toISOString().slice(0, 10)

  // Agregación mensual de cobros (últimos 6 meses)
  const monthlyData = useMemo(() => {
    const months: { label: string; key: string; paid: number; due: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('es-US', { month: 'short', year: '2-digit' })
      months.push({ label, key, paid: 0, due: 0 })
    }

    for (const p of payments) {
      if (p.status === 'completed' && p.paid_at) {
        const d = new Date(p.paid_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const m = months.find(x => x.key === key)
        if (m) m.paid += Number(p.amount)
      }
      if (p.due_date) {
        const key = p.due_date.slice(0, 7)
        const m = months.find(x => x.key === key)
        if (m) m.due += Number(p.amount)
      }
    }

    return months
  }, [payments, now])

  const maxValue = Math.max(1, ...monthlyData.map(m => Math.max(m.paid, m.due)))

  // Filtrado de cuotas
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (filter === 'overdue') return p.status === 'pending' && p.due_date && p.due_date < todayStr
      if (filter === 'upcoming') return p.status === 'pending' && p.due_date && p.due_date >= todayStr && p.due_date <= sevenDaysStr
      if (filter === 'paid') return p.status === 'completed'
      return true
    }).slice(0, 100)
  }, [payments, filter, todayStr, sevenDaysStr])

  // Stats totales
  const totalPaid = payments.filter(p => p.status === 'completed').reduce((s, p) => s + Number(p.amount), 0)
  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0)
  const totalOverdue = payments.filter(p => p.status === 'pending' && p.due_date && p.due_date < todayStr).reduce((s, p) => s + Number(p.amount), 0)

  const activeContracts = contracts.filter(c => ['firmado', 'activo'].includes(c.status)).length
  const contractsRevenue = contracts.filter(c => ['firmado', 'activo', 'completado'].includes(c.status)).reduce((s, c) => s + Number(c.total_price), 0)

  // ────────────────── Métricas personales (PR5) ──────────────────
  // 1. Tiempo promedio creación → firma
  const signedContracts = useMemo(
    () => contracts.filter(c => c.signed_at != null),
    [contracts]
  )
  const avgDaysToSign = useMemo(() => {
    if (signedContracts.length === 0) return null
    const totalDays = signedContracts.reduce((sum, c) => {
      const created = new Date(c.created_at).getTime()
      const signed = new Date(c.signed_at!).getTime()
      return sum + Math.max(0, (signed - created) / 86400_000)
    }, 0)
    return totalDays / signedContracts.length
  }, [signedContracts])

  // 2. Closing rate (% contratos enviados que se firmaron)
  const sentContracts = contracts.filter(
    c => c.status !== 'borrador' || c.signed_at != null
  )
  const closingRate = sentContracts.length === 0
    ? null
    : (signedContracts.length / sentContracts.length) * 100

  // 3. Contratos firmados este mes
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const signedThisMonth = signedContracts.filter(
    c => new Date(c.signed_at!) >= monthStart
  ).length
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const signedPrevMonth = signedContracts.filter(c => {
    const d = new Date(c.signed_at!)
    return d >= prevMonthStart && d < monthStart
  }).length
  const monthDelta = signedThisMonth - signedPrevMonth

  // 4. Top 5 clientes morosos
  interface MoroseEntry {
    clientId: string
    name: string
    overdueAmount: number
    overdueCount: number
    daysOldest: number
  }
  const topMorose = useMemo<MoroseEntry[]>(() => {
    const map = new Map<string, MoroseEntry>()
    for (const p of payments) {
      if (p.status !== 'pending' || !p.due_date || p.due_date >= todayStr) continue
      const days = Math.floor((now.getTime() - new Date(p.due_date).getTime()) / 86400_000)
      const name = p.client ? `${p.client.first_name} ${p.client.last_name}`.trim() : 'Cliente'
      const existing = map.get(p.client_id)
      if (existing) {
        existing.overdueAmount += Number(p.amount)
        existing.overdueCount += 1
        if (days > existing.daysOldest) existing.daysOldest = days
      } else {
        map.set(p.client_id, {
          clientId: p.client_id,
          name,
          overdueAmount: Number(p.amount),
          overdueCount: 1,
          daysOldest: days,
        })
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.overdueAmount - a.overdueAmount)
      .slice(0, 5)
  }, [payments, todayStr, now])

  return (
    <div className="space-y-6 max-w-6xl">
      <AdminKeyframes />
      <PageHeader
        eyebrow="MÉTRICAS · COBRANZA"
        title="Métricas"
        accentDot
        description="Análisis de cobros, contratos firmados y retención de clientes."
        telemetry={[
          { label: 'Cobrado total', value: `$${totalPaid.toLocaleString()}` },
          { label: 'Vencido', value: `$${totalOverdue.toLocaleString()}` },
          { label: 'Contratos activos', value: activeContracts.toString() },
        ]}
      />

      {/* KPIs financieros */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI icon={<TrendingUp className="w-5 h-5" style={{ color: 'var(--admin-green)' }} />} label="COBRADO · TOTAL" value={`$${totalPaid.toLocaleString()}`} valueColor="var(--admin-green)" />
        <KPI icon={<Clock className="w-5 h-5" style={{ color: 'var(--admin-gold)' }} />} label="PENDIENTE" value={`$${totalPending.toLocaleString()}`} valueColor="var(--admin-gold)" />
        <KPI icon={<AlertTriangle className="w-5 h-5" style={{ color: 'var(--admin-red)' }} />} label="VENCIDO" value={`$${totalOverdue.toLocaleString()}`} valueColor="var(--admin-red)" />
        <KPI icon={<DollarSign className="w-5 h-5" style={{ color: 'var(--admin-blue)' }} />} label="FACTURACIÓN · CONTRATOS" value={`$${contractsRevenue.toLocaleString()}`} valueColor="var(--admin-blue)" />
        <KPI icon={<Users className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />} label="CONTRATOS · ACTIVOS" value={String(activeContracts)} valueColor="var(--admin-fg)" />
      </div>

      {/* Métricas personales de productividad */}
      <Card className="p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-fg)' }}>
            Tu productividad
          </h2>
          <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)' }}>
            Cómo vas cerrando contratos y cobrando este mes
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Tiempo promedio creación → firma */}
          <ProductivityTile
            tone="blue"
            icon={<Timer className="w-4 h-4" style={{ color: 'var(--admin-blue)' }} />}
            label="Tiempo creación → firma"
            value={avgDaysToSign != null ? `${avgDaysToSign.toFixed(1)} días` : '—'}
            hint={signedContracts.length > 0
              ? `Promedio sobre ${signedContracts.length} contratos firmados`
              : 'Aún no hay contratos firmados'}
          />

          {/* Closing rate */}
          <ProductivityTile
            tone="green"
            icon={<Target className="w-4 h-4" style={{ color: 'var(--admin-green)' }} />}
            label="Tasa de cierre"
            value={closingRate != null ? `${closingRate.toFixed(0)}%` : '—'}
            hint={`${signedContracts.length} firmados de ${sentContracts.length} enviados`}
          />

          {/* Contratos firmados este mes */}
          <ProductivityTile
            tone="gold"
            icon={<Trophy className="w-4 h-4" style={{ color: 'var(--admin-gold)' }} />}
            label="Firmados este mes"
            value={signedThisMonth.toString()}
            hint={
              monthDelta === 0
                ? 'Igual que el mes pasado'
                : monthDelta > 0
                  ? `↑ ${monthDelta} vs. mes pasado`
                  : `↓ ${Math.abs(monthDelta)} vs. mes pasado`
            }
            hintColor={
              monthDelta === 0
                ? 'var(--admin-fg-subtle)'
                : monthDelta > 0
                  ? 'var(--admin-green)'
                  : 'var(--admin-red)'
            }
          />
        </div>
      </Card>

      {/* Top 5 clientes morosos */}
      {topMorose.length > 0 && (
        <Card className="p-5" >
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
            <h2
              className="flex items-center gap-2"
              style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-fg)' }}
            >
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--admin-red)' }} />
              Top 5 deudas pendientes
            </h2>
            <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)' }}>
              Prioriza el contacto de mayor a menor
            </p>
          </div>
          <div className="space-y-2">
            {topMorose.map((m, idx) => (
              <a
                key={m.clientId}
                href={`/employee/clientes/${m.clientId}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:shadow-sm"
                style={{
                  background: 'var(--admin-bg-elev)',
                  border: '0.5px solid var(--admin-red)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--admin-red-soft)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--admin-bg-elev)')}
              >
                <span
                  className="flex-shrink-0 h-7 w-7 rounded-full inline-flex items-center justify-center"
                  style={{
                    background: 'var(--admin-red-soft)',
                    color: 'var(--admin-red)',
                    fontSize: 12,
                    fontWeight: 700,
                    border: '0.5px solid var(--admin-red)',
                  }}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate"
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)' }}
                  >
                    {m.name}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)' }}>
                    {m.overdueCount} cuota{m.overdueCount !== 1 ? 's' : ''} vencida{m.overdueCount !== 1 ? 's' : ''} · más vieja: {m.daysOldest}d
                  </p>
                </div>
                <p
                  className="flex-shrink-0"
                  style={{ fontSize: 14, fontWeight: 700, color: 'var(--admin-red)' }}
                >
                  ${m.overdueAmount.toLocaleString()}
                </p>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Gráfico mensual */}
      <Card className="p-5">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-fg)', marginBottom: 16 }}>
          Cobros — últimos 6 meses
        </h2>
        <div className="space-y-3">
          {monthlyData.map(m => (
            <div key={m.key}>
              <div className="flex items-center justify-between mb-1" style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 500, color: 'var(--admin-fg)', textTransform: 'capitalize' }}>
                  {m.label}
                </span>
                <span style={{ color: 'var(--admin-fg-subtle)' }}>
                  Cobrado{' '}
                  <span style={{ color: 'var(--admin-green)', fontWeight: 700 }}>
                    ${m.paid.toLocaleString()}
                  </span>
                  {' '}de esperado{' '}
                  <span style={{ color: 'var(--admin-gold)', fontWeight: 700 }}>
                    ${m.due.toLocaleString()}
                  </span>
                </span>
              </div>
              <div
                className="relative h-6 rounded-md overflow-hidden"
                style={{ background: 'var(--admin-bg-elev-2)' }}
              >
                <div
                  className="absolute left-0 top-0 h-full"
                  style={{
                    width: `${(m.due / maxValue) * 100}%`,
                    background: 'var(--admin-gold-soft)',
                  }}
                />
                <div
                  className="absolute left-0 top-0 h-full"
                  style={{
                    width: `${(m.paid / maxValue) * 100}%`,
                    background: 'var(--admin-green)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4" style={{ fontSize: 11, color: 'var(--admin-fg-subtle)' }}>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ background: 'var(--admin-green)' }} /> Cobrado
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ background: 'var(--admin-gold-soft)' }} /> Esperado
          </span>
        </div>
      </Card>

      {/* Tabla de cuotas */}
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-fg)' }}>Cuotas</h2>
          <div className="flex gap-1">
            {([
              { key: 'overdue', label: 'Vencidas' },
              { key: 'upcoming', label: 'Próx. 7 días' },
              { key: 'paid', label: 'Pagadas' },
              { key: 'all', label: 'Todas' },
            ] as const).map(t => {
              const active = filter === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  className="px-3 h-8 rounded-full transition-colors"
                  style={
                    active
                      ? {
                          background: 'var(--admin-accent)',
                          color: 'var(--admin-bg-elev)',
                          fontSize: 12,
                          fontWeight: 600,
                          border: '0.5px solid var(--admin-accent)',
                        }
                      : {
                          background: 'var(--admin-bg-elev-2)',
                          color: 'var(--admin-fg-muted)',
                          fontSize: 12,
                          fontWeight: 500,
                          border: '0.5px solid var(--admin-border)',
                        }
                  }
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {filteredPayments.length === 0 ? (
          <p
            className="text-center py-8"
            style={{ fontSize: 13, color: 'var(--admin-fg-subtle)' }}
          >
            Sin cuotas en esta categoría.
          </p>
        ) : (
          <div>
            {filteredPayments.map((p, idx) => {
              const overdueDays = p.due_date
                ? Math.floor((now.getTime() - new Date(p.due_date).getTime()) / 86400_000)
                : 0
              const isOverdue = p.status === 'pending' && p.due_date && p.due_date < todayStr
              return (
                <div
                  key={p.id}
                  className="py-3 flex items-center justify-between gap-3"
                  style={{
                    borderBottom: idx < filteredPayments.length - 1
                      ? '0.5px solid var(--admin-border)'
                      : 'none',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate"
                      style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)' }}
                    >
                      {p.client ? `${p.client.first_name} ${p.client.last_name}` : '—'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)' }}>
                      {p.due_date && `Vence ${p.due_date}`}
                      {p.paid_at && ` · Pagada ${new Date(p.paid_at).toLocaleDateString('es-US')}`}
                      {p.client?.phone && ` · ${p.client.phone}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isOverdue && (
                      <Pill tone="red">{overdueDays}d vencida</Pill>
                    )}
                    {p.status === 'completed' && (
                      <Pill tone="green">Pagada</Pill>
                    )}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: p.status === 'completed' ? 'var(--admin-green)' : 'var(--admin-fg)',
                      }}
                    >
                      ${Number(p.amount).toLocaleString()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

function KPI({
  icon, label, value, valueColor,
}: { icon: React.ReactNode; label: string; value: string; valueColor: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.18em',
          color: 'var(--admin-fg-subtle)',
          fontFamily: 'var(--font-mono-tech)',
        }}>
          {label}
        </p>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color: valueColor }}>{value}</p>
    </Card>
  )
}

function ProductivityTile({
  tone, icon, label, value, hint, hintColor,
}: {
  tone: 'blue' | 'green' | 'gold'
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  hintColor?: string
}) {
  const palette = {
    blue:  { bg: 'var(--admin-blue-soft)',  border: 'var(--admin-blue)',  value: 'var(--admin-blue)' },
    green: { bg: 'var(--admin-green-soft)', border: 'var(--admin-green)', value: 'var(--admin-green)' },
    gold:  { bg: 'var(--admin-gold-soft)',  border: 'var(--admin-gold-border, var(--admin-gold))', value: 'var(--admin-gold)' },
  }[tone]
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: palette.bg,
        border: `0.5px solid ${palette.border}`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-fg-muted)' }}>
          {label}
        </p>
      </div>
      <p style={{ fontSize: 24, fontWeight: 700, color: palette.value }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: hintColor || 'var(--admin-fg-subtle)', marginTop: 4 }}>
        {hint}
      </p>
    </div>
  )
}

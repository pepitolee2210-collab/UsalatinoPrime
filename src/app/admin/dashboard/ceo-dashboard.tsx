'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp, TrendingDown, Users, FileSignature, DollarSign,
  AlertTriangle, Clock, ArrowRight, Bot, PhoneCall, CheckCircle,
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
    <div className="space-y-6 max-w-7xl">
      {/* ═══ HERO: KPIs principales ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          label="Clientes totales"
          value={kpi.total_clients.toLocaleString()}
          accent="blue"
        />
        <KpiCard
          icon={<FileSignature className="w-5 h-5" />}
          label="Contratos firmados"
          value={kpi.contracts_signed.toLocaleString()}
          hint={`${ops.pending_signature.length} pend. firma`}
          accent="emerald"
        />
        <KpiCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Cobrado este mes"
          value={`$${kpi.revenue_this_month.toLocaleString()}`}
          hint={
            monthDelta === 0
              ? `vs $${kpi.revenue_last_month.toLocaleString()} mes pasado`
              : `${monthDelta > 0 ? '↑' : '↓'} ${Math.abs(monthDelta).toFixed(0)}% vs mes pasado`
          }
          deltaPositive={monthDelta >= 0}
          accent="amber"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Vencido"
          value={`$${kpi.revenue_overdue.toLocaleString()}`}
          hint={`${ops.overdue_clients.length} clientes con deuda`}
          accent={kpi.revenue_overdue > 0 ? 'red' : 'gray'}
        />
      </div>

      {/* ═══ FUNNEL ═══ */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#002855]" />
              <div>
                <h2 className="text-base font-bold text-gray-900">Funnel del cliente</h2>
                <p className="text-[11px] text-gray-500">Desde la primera llamada IA hasta el contrato firmado</p>
              </div>
            </div>
          </div>
          <FunnelChart stages={funnel} />
        </CardContent>
      </Card>

      {/* ═══ Grid 2 columnas: Servicios + Tendencia ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Servicios */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#002855]" />
                <h2 className="text-base font-bold text-gray-900">Servicios</h2>
              </div>
              <Link href="/admin/cases" className="text-[11px] text-blue-600 hover:underline">
                Ver casos →
              </Link>
            </div>
            <ServicesBreakdown services={services} />
          </CardContent>
        </Card>

        {/* Tendencia 6 meses */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#002855]" />
                <h2 className="text-base font-bold text-gray-900">Tendencia · últimos 6 meses</h2>
              </div>
            </div>
            <TrendChart points={trend} />
          </CardContent>
        </Card>
      </div>

      {/* ═══ Operaciones (lo que hace Andrium) ═══ */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <div>
                <h2 className="text-base font-bold text-gray-900">Operaciones diarias</h2>
                <p className="text-[11px] text-gray-500">
                  Lo que el equipo gestiona manualmente. <span className="text-amber-700 font-semibold">Próximamente automatizado</span>.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <OpStatCard
              icon={<FileSignature className="w-4 h-4 text-amber-600" />}
              label="Pendientes de firma"
              value={ops.pending_signature.length}
              hint={ops.pending_signature.length > 0 ? `${ops.pending_signature[0].days_waiting} días el más antiguo` : 'Al día'}
              link="/admin/contratos"
              accent="amber"
            />
            <OpStatCard
              icon={<Clock className="w-4 h-4 text-blue-600" />}
              label="Próximos 7 días"
              value={ops.upcoming_payments_7d_count}
              hint={`$${ops.upcoming_payments_7d_amount.toLocaleString()} a cobrar`}
              link="/admin/payments"
              accent="blue"
            />
            <OpStatCard
              icon={<AlertTriangle className="w-4 h-4 text-gray-600" />}
              label="Casos atascados"
              value={ops.stuck_cases}
              hint="sin movimiento >14d"
              link="/admin/cases"
              accent="gray"
            />
          </div>

          {/* Sub-secciones colapsables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <PendingSignatureList items={ops.pending_signature} />
            <OverdueClientsList items={ops.overdue_clients} />
          </div>
        </CardContent>
      </Card>

      {/* ═══ Auto-pilot (Fase 2-3) ═══ */}
      <Card className="border-2 border-dashed border-amber-200 bg-amber-50/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <div>
                <h2 className="text-base font-bold text-gray-900">Auto-pilot</h2>
                <p className="text-[11px] text-gray-500">Automatización progresiva del trabajo manual</p>
              </div>
            </div>
            <Badge className="bg-amber-100 text-amber-800">Próximamente</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AutoPilotCard
              icon={<FileSignature className="w-4 h-4 text-violet-600" />}
              label="Contratos auto-generados"
              value={autopilot.auto_contracts_this_month}
              description="Cuando Vanessa marca acepta, el sistema genera el draft."
              status="phase_2"
            />
            <AutoPilotCard
              icon={<PhoneCall className="w-4 h-4 text-emerald-600" />}
              label="WhatsApp automáticos"
              value={autopilot.auto_whatsapp_sent_this_month}
              description="Recordatorios de firma + cobranza vía Twilio."
              status="phase_3"
            />
            <AutoPilotCard
              icon={<DollarSign className="w-4 h-4 text-amber-600" />}
              label="Pagos cobrados solos"
              value={autopilot.auto_payments_collected_this_month}
              description="Cron de cobranza diario sin intervención humana."
              status="phase_3"
            />
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-gray-400 text-right">
        Datos actualizados: {new Date(data.generated_at).toLocaleString('es-US')}
      </p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Componentes auxiliares
// ══════════════════════════════════════════════════════════════════════

function KpiCard({
  icon, label, value, hint, accent = 'blue', deltaPositive,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  accent?: 'blue' | 'emerald' | 'amber' | 'red' | 'gray'
  deltaPositive?: boolean
}) {
  const accentMap = {
    blue: 'from-blue-500/10 to-blue-500/0 text-blue-700 ring-blue-100',
    emerald: 'from-emerald-500/10 to-emerald-500/0 text-emerald-700 ring-emerald-100',
    amber: 'from-amber-500/10 to-amber-500/0 text-amber-700 ring-amber-100',
    red: 'from-red-500/10 to-red-500/0 text-red-700 ring-red-100',
    gray: 'from-gray-500/10 to-gray-500/0 text-gray-700 ring-gray-100',
  }
  return (
    <Card className={`relative overflow-hidden ring-1 ${accentMap[accent].split(' ').slice(2).join(' ')}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${accentMap[accent].split(' ').slice(0, 2).join(' ')}`} />
      <CardContent className="p-4 relative">
        <div className={`inline-flex w-9 h-9 rounded-xl items-center justify-center mb-2 ${accentMap[accent].split(' ').slice(2).join(' ')}`}>
          {icon}
        </div>
        <p className="text-[11px] text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {hint && (
          <p className={`text-[10px] mt-1 flex items-center gap-1 ${
            typeof deltaPositive === 'boolean'
              ? deltaPositive ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'
              : 'text-gray-500'
          }`}>
            {typeof deltaPositive === 'boolean' && (deltaPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function FunnelChart({ stages }: { stages: CeoDashboardData['funnel'] }) {
  const max = Math.max(...stages.map(s => s.count), 1)

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const pct = (stage.count / max) * 100
        const prevStage = i > 0 ? stages[i - 1] : null
        const conversion = prevStage && prevStage.count > 0
          ? (stage.count / prevStage.count) * 100
          : null
        const colors = [
          'from-rose-500 to-rose-400',
          'from-orange-500 to-orange-400',
          'from-amber-500 to-amber-400',
          'from-yellow-500 to-yellow-400',
          'from-lime-500 to-lime-400',
          'from-emerald-500 to-emerald-400',
          'from-teal-500 to-teal-400',
        ]
        return (
          <div key={stage.key} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-900">{stage.label}</span>
                <span className="text-[11px] text-gray-400">{stage.description}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                {conversion !== null && (
                  <span className={`font-medium ${
                    conversion >= 50 ? 'text-emerald-700' : conversion >= 20 ? 'text-amber-700' : 'text-red-700'
                  }`}>
                    {conversion.toFixed(0)}%
                  </span>
                )}
                <span className="font-bold text-gray-900 tabular-nums">{stage.count.toLocaleString()}</span>
              </div>
            </div>
            <div className="h-7 bg-gray-50 rounded-md overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${colors[i] || 'from-gray-500 to-gray-400'} transition-all duration-700 flex items-center px-2`}
                style={{ width: `${pct}%`, minWidth: stage.count > 0 ? '4%' : '0' }}
              >
                {pct > 12 && (
                  <span className="text-[10px] text-white font-bold tabular-nums">
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
    return <p className="text-sm text-gray-400 text-center py-6">Sin servicios con actividad</p>
  }

  return (
    <div className="space-y-3">
      {visible.map(s => {
        const pct = (s.revenue_signed / maxRevenue) * 100
        const sharePct = totalRevenue > 0 ? (s.revenue_signed / totalRevenue) * 100 : 0
        return (
          <div key={s.slug}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-900 truncate flex-1 mr-3">{s.name}</span>
              <span className="text-xs text-gray-500 flex-shrink-0">
                {s.contracts} contratos · <span className="font-bold text-gray-900">${s.revenue_signed.toLocaleString()}</span>
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#002855] to-[#F2A900]"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            {sharePct > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">{sharePct.toFixed(1)}% de ingresos firmados</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TrendChart({ points }: { points: CeoDashboardData['trend'] }) {
  const maxRev = Math.max(...points.map(p => Math.max(p.revenue_collected, p.revenue_expected)), 1)
  const maxContracts = Math.max(...points.map(p => Math.max(p.contracts_created, p.contracts_signed)), 1)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      {/* Barras por mes */}
      <div className="grid grid-cols-6 gap-1.5 h-36">
        {points.map((p, i) => {
          const expectedH = (p.revenue_expected / maxRev) * 100
          const collectedH = (p.revenue_collected / maxRev) * 100
          const isHover = hoverIdx === i
          return (
            <div
              key={p.month}
              className="relative flex items-end justify-center gap-0.5 cursor-pointer group"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              {/* Esperado (fondo) */}
              <div
                className="w-3 bg-amber-100 rounded-t transition-all"
                style={{ height: `${Math.max(2, expectedH)}%` }}
              />
              {/* Cobrado (foreground) */}
              <div
                className={`w-3 rounded-t transition-all ${isHover ? 'bg-emerald-700' : 'bg-emerald-500'}`}
                style={{ height: `${Math.max(2, collectedH)}%` }}
              />
              {isHover && (
                <div className="absolute bottom-full mb-1 px-2 py-1 rounded bg-gray-900 text-white text-[10px] whitespace-nowrap z-10 shadow-lg">
                  <p className="font-semibold capitalize">{p.label}</p>
                  <p className="text-emerald-300">Cobrado: ${p.revenue_collected.toLocaleString()}</p>
                  <p className="text-amber-300">Esperado: ${p.revenue_expected.toLocaleString()}</p>
                  <p className="text-gray-300 text-[9px] mt-0.5">
                    {p.contracts_signed}/{p.contracts_created} firmados/creados
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* Labels meses */}
      <div className="grid grid-cols-6 gap-1.5">
        {points.map(p => (
          <div key={p.month} className="text-[10px] text-gray-500 text-center capitalize">
            {p.label}
          </div>
        ))}
      </div>
      {/* Leyenda */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500 pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
          Cobrado
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-amber-100" />
          Esperado
        </span>
      </div>
    </div>
  )
}

function OpStatCard({
  icon, label, value, hint, link, accent,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  hint?: string
  link: string
  accent: 'amber' | 'blue' | 'gray'
}) {
  const colorMap = {
    amber: 'border-amber-100 hover:border-amber-200 bg-amber-50/30',
    blue: 'border-blue-100 hover:border-blue-200 bg-blue-50/30',
    gray: 'border-gray-200 hover:border-gray-300 bg-gray-50/30',
  }
  return (
    <Link href={link} className={`block rounded-xl border ${colorMap[accent]} p-3 transition-colors`}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-gray-700">{label}</span>
        </div>
        <ArrowRight className="w-3 h-3 text-gray-400" />
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {hint && <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>}
    </Link>
  )
}

function PendingSignatureList({ items }: { items: CeoDashboardData['ops']['pending_signature'] }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
          Esperando firma · top {items.length}
        </p>
        <Link href="/admin/contratos" className="text-[10px] text-amber-700 hover:underline">
          Ver todos
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic text-center py-2">
          Sin contratos pendientes 🎉
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 5).map(c => (
            <div key={c.id} className="flex items-center justify-between text-xs gap-2">
              <span className="font-medium text-gray-800 truncate flex-1">{c.client_name}</span>
              <span className="text-[10px] text-amber-700 font-semibold whitespace-nowrap">
                {c.days_waiting}d · ${c.total_price.toLocaleString()}
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
    <div className="rounded-xl border border-red-100 bg-red-50/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-red-900">
          Clientes con deuda
        </p>
        <Link href="/admin/payments" className="text-[10px] text-red-700 hover:underline">
          Ver pagos
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic text-center py-2">
          Sin deuda pendiente 🎉
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 5).map(c => (
            <div key={c.client_id} className="flex items-center justify-between text-xs gap-2">
              <span className="font-medium text-gray-800 truncate flex-1">
                {c.name}
                <span className="text-[10px] text-gray-400 ml-1">({c.installments_overdue})</span>
              </span>
              <span className="text-[10px] text-red-700 font-bold whitespace-nowrap">
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
    <div className="rounded-xl border border-amber-100 bg-white/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold text-gray-700">{label}</span>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
          status === 'live' ? 'bg-emerald-100 text-emerald-800' :
          status === 'phase_2' ? 'bg-violet-100 text-violet-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {status === 'live' ? 'Activo' : status === 'phase_2' ? 'Fase 2' : 'Fase 3'}
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-500 mt-1 leading-snug">{description}</p>
    </div>
  )
}

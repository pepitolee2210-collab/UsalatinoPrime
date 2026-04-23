'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart3, TrendingUp, AlertTriangle, Clock, Users, DollarSign } from 'lucide-react'

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

export function MetricsClient({ payments, contracts }: Props) {
  const [filter, setFilter] = useState<Filter>('overdue')

  const now = new Date()
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
  }, [payments])

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

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-[#F2A900]" />
          Métricas
        </h1>
        <p className="text-sm text-gray-500">
          Análisis de cobros, contratos firmados y retención de clientes.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} label="Cobrado total" value={`$${totalPaid.toLocaleString()}`} accent="emerald" />
        <KPI icon={<Clock className="w-5 h-5 text-amber-600" />} label="Pendiente" value={`$${totalPending.toLocaleString()}`} accent="amber" />
        <KPI icon={<AlertTriangle className="w-5 h-5 text-red-600" />} label="Vencido" value={`$${totalOverdue.toLocaleString()}`} accent="red" />
        <KPI icon={<DollarSign className="w-5 h-5 text-blue-600" />} label="Facturación contratos" value={`$${contractsRevenue.toLocaleString()}`} accent="blue" />
        <KPI icon={<Users className="w-5 h-5 text-purple-600" />} label="Contratos activos" value={String(activeContracts)} accent="purple" />
      </div>

      {/* Gráfico mensual */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">Cobros — últimos 6 meses</h2>
          <div className="space-y-3">
            {monthlyData.map(m => (
              <div key={m.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700 capitalize">{m.label}</span>
                  <span className="text-gray-500">
                    Cobrado <span className="text-emerald-700 font-semibold">${m.paid.toLocaleString()}</span>
                    {' '}de esperado <span className="text-amber-700 font-semibold">${m.due.toLocaleString()}</span>
                  </span>
                </div>
                <div className="relative h-6 rounded-md bg-gray-100 overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-amber-200"
                    style={{ width: `${(m.due / maxValue) * 100}%` }}
                  />
                  <div
                    className="absolute left-0 top-0 h-full bg-emerald-500"
                    style={{ width: `${(m.paid / maxValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-500" /> Cobrado
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-200" /> Esperado
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de cuotas */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="text-base font-bold text-gray-900">Cuotas</h2>
            <div className="flex gap-1">
              {([
                { key: 'overdue', label: 'Vencidas' },
                { key: 'upcoming', label: 'Próx. 7 días' },
                { key: 'paid', label: 'Pagadas' },
                { key: 'all', label: 'Todas' },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  className={`text-xs px-3 h-8 rounded-full font-medium transition-colors ${
                    filter === t.key ? 'bg-[#002855] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {filteredPayments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin cuotas en esta categoría.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredPayments.map(p => {
                const overdueDays = p.due_date ? Math.floor((now.getTime() - new Date(p.due_date).getTime()) / 86400_000) : 0
                return (
                  <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {p.client ? `${p.client.first_name} ${p.client.last_name}` : '—'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.due_date && `Vence ${p.due_date}`}
                        {p.paid_at && ` · Pagada ${new Date(p.paid_at).toLocaleDateString('es-US')}`}
                        {p.client?.phone && ` · ${p.client.phone}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.status === 'pending' && p.due_date && p.due_date < todayStr && (
                        <Badge className="bg-red-100 text-red-700">
                          {overdueDays}d vencida
                        </Badge>
                      )}
                      {p.status === 'completed' && (
                        <Badge className="bg-emerald-100 text-emerald-700">Pagada</Badge>
                      )}
                      <span className={`text-sm font-bold ${p.status === 'completed' ? 'text-emerald-700' : 'text-gray-900'}`}>
                        ${Number(p.amount).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KPI({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: 'emerald' | 'amber' | 'red' | 'blue' | 'purple' }) {
  const bg = {
    emerald: 'bg-emerald-50 border-emerald-100',
    amber: 'bg-amber-50 border-amber-100',
    red: 'bg-red-50 border-red-100',
    blue: 'bg-blue-50 border-blue-100',
    purple: 'bg-purple-50 border-purple-100',
  }[accent]

  return (
    <Card className={`${bg} border`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <p className="text-xs text-gray-600 font-medium">{label}</p>
        </div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  )
}

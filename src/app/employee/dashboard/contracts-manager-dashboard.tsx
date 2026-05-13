'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  FileSignature, DollarSign, AlertTriangle, Clock,
  TrendingUp, CreditCard, CheckCircle, Send, Users, ArrowRight, Calendar,
  Briefcase,
} from 'lucide-react'
import { MarkPaidModal, type OverduePayment } from '@/components/payments/mark-paid-modal'
import { WhatsAppTemplates } from '@/components/communication/whatsapp-templates'

interface Contract {
  id: string
  client_full_name: string
  service_name: string
  total_price: number
  status: string
  signing_token: string | null
  signed_at: string | null
  client_phone: string | null
  created_at: string
  has_installments: boolean
  initial_payment: number
  installment_count: number
}

interface Payment {
  id: string
  amount: number
  status: string
  due_date: string | null
  paid_at: string | null
  installment_number: number | null
  total_installments: number | null
  client_id: string
  client: { first_name: string; last_name: string; phone: string | null } | null
}

interface Props {
  firstName: string
  contracts: Contract[]
  payments: Payment[]
  todayAppointments: Array<{
    id: string
    scheduled_at: string
    client: { first_name: string; last_name: string } | null
    case: { case_number: string } | null
  }>
  activeCasesCount: number
  totalClientsCount: number
}

export function ContractsManagerDashboard({
  firstName, contracts, payments, todayAppointments, activeCasesCount, totalClientsCount,
}: Props) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const sevenDays = new Date(now.getTime() + 7 * 86400_000)
  const todayStr = now.toISOString().slice(0, 10)

  // Contratos pendientes de firma (enviados pero sin firmar)
  const pendingSignature = contracts.filter(c =>
    c.status === 'pendiente_firma' || (c.signing_token && !c.signed_at && c.status !== 'firmado')
  )
  // Contratos firmados en el mes
  const signedThisMonth = contracts.filter(c =>
    c.signed_at && new Date(c.signed_at) >= monthStart
  )
  // Contratos en borrador (nunca enviados)
  const drafts = contracts.filter(c => c.status === 'borrador' && !c.signing_token)

  // Pagos
  const paidThisMonth = payments
    .filter(p => p.status === 'completed' && p.paid_at && new Date(p.paid_at) >= monthStart)
    .reduce((s, p) => s + Number(p.amount), 0)

  const overdue = payments.filter(p =>
    p.status === 'pending' && p.due_date && p.due_date < todayStr
  )
  const overdueSum = overdue.reduce((s, p) => s + Number(p.amount), 0)

  const upcomingWeek = payments.filter(p =>
    p.status === 'pending' && p.due_date && p.due_date >= todayStr && new Date(p.due_date) <= sevenDays
  )
  const upcomingWeekSum = upcomingWeek.reduce((s, p) => s + Number(p.amount), 0)

  const totalCollected = payments
    .filter(p => p.status === 'completed')
    .reduce((s, p) => s + Number(p.amount), 0)

  // Clientes con cuotas vencidas — agrupado pero conservando los pagos
  // individuales para poder pasarlos al modal de "Marcar pagado".
  interface ClientOverdue {
    name: string
    phone: string | null
    total: number
    payments: OverduePayment[]
  }
  const clientsWithOverdue = new Map<string, ClientOverdue>()
  overdue.forEach(p => {
    const existing = clientsWithOverdue.get(p.client_id)
    const name = p.client ? `${p.client.first_name} ${p.client.last_name}` : 'Cliente desconocido'
    const phone = p.client?.phone ?? null
    const paymentItem: OverduePayment = {
      id: p.id,
      amount: Number(p.amount),
      due_date: p.due_date,
      installment_number: p.installment_number,
      total_installments: p.total_installments,
    }
    if (existing) {
      existing.total += Number(p.amount)
      existing.payments.push(paymentItem)
    } else {
      clientsWithOverdue.set(p.client_id, {
        name,
        phone,
        total: Number(p.amount),
        payments: [paymentItem],
      })
    }
  })

  // Estado del modal "Marcar pagado"
  const [markPaidTarget, setMarkPaidTarget] = useState<{
    clientName: string
    payments: OverduePayment[]
  } | null>(null)

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileSignature className="w-6 h-6 text-[#F2A900]" />
          Hola, {firstName}
        </h1>
        <p className="text-sm text-gray-500">
          Control de contratos, cobros y retención de clientes.
        </p>
      </div>

      {/* ZONA 1: ACCIONES DE HOY */}
      {(pendingSignature.length > 0 || todayAppointments.length > 0) && (
        <Card className="border-2 border-[#F2A900]/30 bg-gradient-to-r from-[#F2A900]/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="w-5 h-5 text-[#F2A900]" />
              Acciones urgentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSignature.length > 0 && (
              <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">
                    Contratos esperando firma del cliente
                  </span>
                  <Badge className="bg-amber-100 text-amber-800">{pendingSignature.length}</Badge>
                </div>
                <div className="space-y-2">
                  {pendingSignature.slice(0, 4).map(c => {
                    const firstName = c.client_full_name.split(' ')[0]
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 text-sm bg-white rounded-md border border-amber-100/60 px-2.5 py-2 flex-wrap"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 truncate">{c.client_full_name}</p>
                          <p className="text-[11px] text-gray-500">
                            {c.service_name} · ${Number(c.total_price).toLocaleString()}
                          </p>
                        </div>
                        <WhatsAppTemplates
                          context={{
                            client_name: c.client_full_name,
                            client_first_name: firstName,
                            client_phone: c.client_phone,
                            service_name: c.service_name,
                            signing_url: c.signing_token
                              ? `${typeof window !== 'undefined' ? window.location.origin : ''}/contrato/${c.signing_token}`
                              : undefined,
                          }}
                          triggerLabel="Recordar"
                        />
                      </div>
                    )
                  })}
                  {pendingSignature.length > 4 && (
                    <Link
                      href="/employee/contratos"
                      className="block text-xs text-[#F2A900] hover:underline text-right pt-1"
                    >
                      Ver {pendingSignature.length - 4} más →
                    </Link>
                  )}
                </div>
              </div>
            )}
            {todayAppointments.length > 0 && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">Citas de hoy</span>
                  <Badge className="bg-blue-100 text-blue-800">{todayAppointments.length}</Badge>
                </div>
                <div className="space-y-2">
                  {todayAppointments.map(apt => {
                    const c = apt.client
                    const fullName = c ? `${c.first_name} ${c.last_name}` : 'Cliente sin nombre'
                    const timeStr = new Date(apt.scheduled_at).toLocaleTimeString('en-US', {
                      timeZone: 'America/Denver', hour: 'numeric', minute: '2-digit', hour12: true,
                    })
                    const dateStr = new Date(apt.scheduled_at).toLocaleDateString('es-US', {
                      timeZone: 'America/Denver', day: 'numeric', month: 'long',
                    })
                    return (
                      <div
                        key={apt.id}
                        className="flex items-center justify-between gap-2 text-sm bg-white rounded-md border border-blue-100/60 px-2.5 py-2 flex-wrap"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 truncate">{fullName}</p>
                          <p className="text-[11px] text-gray-500">
                            {timeStr}
                            {apt.case?.case_number && ` · #${apt.case.case_number}`}
                          </p>
                        </div>
                        <WhatsAppTemplates
                          context={{
                            client_name: fullName,
                            client_first_name: c?.first_name,
                            client_phone: null, // las citas de hoy no traen phone en el query
                            appointment_date: dateStr,
                            appointment_time: timeStr,
                            case_number: apt.case?.case_number,
                          }}
                          triggerLabel="Confirmar"
                        />
                      </div>
                    )
                  })}
                  <Link
                    href="/employee/citas"
                    className="block text-xs text-blue-600 hover:underline text-right pt-1"
                  >
                    Ver todas las citas →
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ZONA 2: FINANZAS */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-xs text-gray-500">Cobrado este mes</p>
                <p className="text-xl font-bold text-emerald-700">${paidThisMonth.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${overdueSum > 0 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-5 h-5 ${overdueSum > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              <div>
                <p className="text-xs text-gray-500">Vencido</p>
                <p className={`text-xl font-bold ${overdueSum > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                  ${overdueSum.toLocaleString()}
                </p>
                {overdue.length > 0 && (
                  <p className="text-[10px] text-red-500 mt-0.5">{overdue.length} cuota{overdue.length !== 1 ? 's' : ''}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-xs text-gray-500">Próx. 7 días</p>
                <p className="text-xl font-bold text-amber-700">${upcomingWeekSum.toLocaleString()}</p>
                {upcomingWeek.length > 0 && (
                  <p className="text-[10px] text-amber-600 mt-0.5">{upcomingWeek.length} pago{upcomingWeek.length !== 1 ? 's' : ''}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-500">Cobrado total</p>
                <p className="text-xl font-bold text-blue-700">${totalCollected.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ZONA 3: RESUMEN DE CONTRATOS */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Firmados este mes</p>
                <p className="text-2xl font-bold text-gray-900">{signedThisMonth.length}</p>
              </div>
              <CheckCircle className="w-7 h-7 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Pendiente firma</p>
                <p className="text-2xl font-bold text-gray-900">{pendingSignature.length}</p>
              </div>
              <Send className="w-7 h-7 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Borradores</p>
                <p className="text-2xl font-bold text-gray-900">{drafts.length}</p>
              </div>
              <FileSignature className="w-7 h-7 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Casos activos</p>
                <p className="text-2xl font-bold text-gray-900">{activeCasesCount}</p>
              </div>
              <Users className="w-7 h-7 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ZONA 4: CLIENTES A RETENER (cuotas vencidas) */}
      {clientsWithOverdue.size > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5" />
              Clientes con cuotas vencidas
            </CardTitle>
            <p className="text-xs text-red-700">
              Contactar para retención. Marca pagados sin salir de aquí — se notifica al cliente y queda en bitácora.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from(clientsWithOverdue.entries())
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 6)
                .map(([clientId, info]) => {
                  // El pago más viejo (para el template "vencida")
                  const oldestPayment = info.payments
                    .slice()
                    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))[0]
                  return (
                    <div key={clientId} className="bg-white rounded-lg border border-red-100 p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{info.name}</p>
                        <p className="text-xs text-gray-500">
                          {info.payments.length} cuota{info.payments.length !== 1 ? 's' : ''} vencida{info.payments.length !== 1 ? 's' : ''} · {info.phone || 'sin teléfono'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-sm font-bold text-red-700 mr-1">
                          ${info.total.toLocaleString()}
                        </p>
                        <button
                          type="button"
                          onClick={() => setMarkPaidTarget({ clientName: info.name, payments: info.payments })}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-2.5 py-1.5 transition-colors"
                          title="Marcar como pagado"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Pagado
                        </button>
                        <WhatsAppTemplates
                          context={{
                            client_name: info.name,
                            client_first_name: info.name.split(' ')[0],
                            client_phone: info.phone,
                            amount: info.total,
                            due_date: oldestPayment?.due_date ?? undefined,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              {clientsWithOverdue.size > 6 && (
                <p className="text-xs text-gray-500 text-center pt-2">+{clientsWithOverdue.size - 6} más</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal "Marcar pagado" */}
      <MarkPaidModal
        open={markPaidTarget !== null}
        onClose={() => setMarkPaidTarget(null)}
        clientName={markPaidTarget?.clientName ?? ''}
        payments={markPaidTarget?.payments ?? []}
      />

      {/* ZONA 5: ACCESOS RÁPIDOS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <QuickLink href="/employee/contratos" icon={<FileSignature className="w-5 h-5" />} label="Contratos" hint={`${contracts.length} total`} color="bg-amber-50 text-amber-700 border-amber-100" />
        <QuickLink href="/employee/clientes" icon={<Users className="w-5 h-5" />} label="Clientes" hint={`${totalClientsCount}`} color="bg-emerald-50 text-emerald-700 border-emerald-100" />
        <QuickLink href="/employee/cases" icon={<Briefcase className="w-5 h-5" />} label="Casos" hint={`${activeCasesCount} activos`} color="bg-blue-50 text-blue-700 border-blue-100" />
        <QuickLink href="/employee/citas" icon={<Calendar className="w-5 h-5" />} label="Citas" color="bg-purple-50 text-purple-700 border-purple-100" />
        <QuickLink href="/employee/metricas" icon={<CreditCard className="w-5 h-5" />} label="Métricas" color="bg-gray-50 text-gray-700 border-gray-200" />
      </div>
    </div>
  )
}

function QuickLink({ href, icon, label, hint, color }: { href: string; icon: React.ReactNode; label: string; hint?: string; color: string }) {
  return (
    <Link href={href} className={`rounded-xl border ${color} p-4 flex flex-col gap-1 hover:shadow-sm transition-shadow`}>
      <div className="flex items-center justify-between">
        {icon}
        <ArrowRight className="w-4 h-4 opacity-40" />
      </div>
      <p className="text-sm font-semibold mt-1">{label}</p>
      {hint && <p className="text-[11px] opacity-70">{hint}</p>}
    </Link>
  )
}

'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  FileSignature, DollarSign, AlertTriangle, Clock,
  TrendingUp, CreditCard, CheckCircle, Send, Users, ArrowRight, Calendar,
  Briefcase,
} from 'lucide-react'
import { MarkPaidModal, type OverduePayment } from '@/components/payments/mark-paid-modal'
import { WhatsAppTemplates } from '@/components/communication/whatsapp-templates'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

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

// ─── Card base reutilizable ────────────────────────────────────
function AdminCard({
  children, className = '', padding = 'md', accent,
}: {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg' | 'none'
  /** Cinta vertical en el borde izquierdo (4px) */
  accent?: 'green' | 'gold' | 'blue' | 'red' | 'fg-faint'
}) {
  const pad = padding === 'none' ? '' : padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-6' : 'p-5'
  const accentColor = accent
    ? {
        green: 'var(--admin-green)',
        gold: 'var(--admin-gold)',
        blue: 'var(--admin-blue)',
        red: 'var(--admin-red)',
        'fg-faint': 'var(--admin-fg-faint)',
      }[accent]
    : null
  return (
    <div
      className={`rounded-2xl transition-shadow hover:shadow-lg ${pad} ${className}`}
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border)',
        boxShadow: 'var(--admin-shadow, 0 1px 3px rgba(11,31,58,0.04))',
        ...(accentColor ? { borderLeft: `4px solid ${accentColor}` } : null),
      }}
    >
      {children}
    </div>
  )
}

// ─── Pill / badge tokenizado ───────────────────────────────────
function Pill({
  tone, children,
}: { tone: 'gold' | 'blue' | 'green' | 'red' | 'neutral'; children: React.ReactNode }) {
  const map = {
    gold:    { bg: 'var(--admin-gold-soft)',   text: 'var(--admin-gold)',   border: 'var(--admin-gold-border, var(--admin-gold))' },
    blue:    { bg: 'var(--admin-blue-soft)',   text: 'var(--admin-blue)',   border: 'var(--admin-blue)' },
    green:   { bg: 'var(--admin-green-soft)',  text: 'var(--admin-green)',  border: 'var(--admin-green)' },
    red:     { bg: 'var(--admin-red-soft)',    text: 'var(--admin-red)',    border: 'var(--admin-red)' },
    neutral: { bg: 'var(--admin-accent-soft)', text: 'var(--admin-fg-muted)', border: 'var(--admin-border-strong)' },
  }[tone]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
      style={{
        background: map.bg,
        color: map.text,
        border: `0.5px solid ${map.border}`,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  )
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
      <AdminKeyframes />
      <PageHeader
        eyebrow="CONTRATOS · COBRANZA"
        title={`Hola, ${firstName}`}
        accentDot
        description="Control de contratos, cobros y retención de clientes."
        telemetry={[
          { label: 'Pendiente firma', value: pendingSignature.length.toString() },
          { label: 'Cobrado mes', value: `$${paidThisMonth.toLocaleString()}` },
          { label: 'Vencido', value: `$${overdueSum.toLocaleString()}` },
        ]}
      />

      {/* ZONA 1: ACCIONES DE HOY */}
      {(pendingSignature.length > 0 || todayAppointments.length > 0) && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, var(--admin-gold-soft), var(--admin-panel-grad))',
            border: '0.5px solid var(--admin-gold-border, var(--admin-gold))',
            boxShadow: 'var(--admin-shadow-gold, 0 8px 24px rgba(164,115,10,0.10))',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-5 h-5" style={{ color: 'var(--admin-gold)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-fg)' }}>
              Acciones urgentes
            </h2>
          </div>
          <div className="space-y-3">
            {pendingSignature.length > 0 && (
              <div
                className="rounded-xl p-3"
                style={{
                  background: 'var(--admin-bg-elev)',
                  border: '0.5px solid var(--admin-gold-border, var(--admin-gold))',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)' }}>
                    Contratos esperando firma del cliente
                  </span>
                  <Pill tone="gold">{pendingSignature.length}</Pill>
                </div>
                <div className="space-y-2">
                  {pendingSignature.slice(0, 4).map(c => {
                    const firstNameStr = c.client_full_name.split(' ')[0]
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 flex-wrap"
                        style={{
                          background: 'var(--admin-bg-elev-2)',
                          border: '0.5px solid var(--admin-border)',
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate"
                            style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-fg)' }}
                          >
                            {c.client_full_name}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)' }}>
                            {c.service_name} · ${Number(c.total_price).toLocaleString()}
                          </p>
                        </div>
                        <WhatsAppTemplates
                          context={{
                            client_name: c.client_full_name,
                            client_first_name: firstNameStr,
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
                      className="block text-right pt-1 hover:underline"
                      style={{ fontSize: 12, color: 'var(--admin-gold)', fontWeight: 600 }}
                    >
                      Ver {pendingSignature.length - 4} más →
                    </Link>
                  )}
                </div>
              </div>
            )}
            {todayAppointments.length > 0 && (
              <div
                className="rounded-xl p-3"
                style={{
                  background: 'var(--admin-bg-elev)',
                  border: '0.5px solid var(--admin-blue)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)' }}>
                    Citas de hoy
                  </span>
                  <Pill tone="blue">{todayAppointments.length}</Pill>
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
                        className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 flex-wrap"
                        style={{
                          background: 'var(--admin-bg-elev-2)',
                          border: '0.5px solid var(--admin-border)',
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate"
                            style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-fg)' }}
                          >
                            {fullName}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)' }}>
                            {timeStr}
                            {apt.case?.case_number && ` · #${apt.case.case_number}`}
                          </p>
                        </div>
                        <WhatsAppTemplates
                          context={{
                            client_name: fullName,
                            client_first_name: c?.first_name,
                            client_phone: null,
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
                    className="block text-right pt-1 hover:underline"
                    style={{ fontSize: 12, color: 'var(--admin-blue)', fontWeight: 600 }}
                  >
                    Ver todas las citas →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ZONA 2: FINANZAS */}
      <div className="grid gap-4 md:grid-cols-4">
        <AdminCard accent="green" padding="sm">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5" style={{ color: 'var(--admin-green)' }} />
            <div>
              <p style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
                color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)',
              }}>
                COBRADO · MES
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--admin-green)', marginTop: 2 }}>
                ${paidThisMonth.toLocaleString()}
              </p>
            </div>
          </div>
        </AdminCard>

        <AdminCard accent={overdueSum > 0 ? 'red' : 'fg-faint'} padding="sm">
          <div className="flex items-center gap-3">
            <AlertTriangle
              className="w-5 h-5"
              style={{ color: overdueSum > 0 ? 'var(--admin-red)' : 'var(--admin-fg-subtle)' }}
            />
            <div>
              <p style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
                color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)',
              }}>
                VENCIDO
              </p>
              <p style={{
                fontSize: 22, fontWeight: 700,
                color: overdueSum > 0 ? 'var(--admin-red)' : 'var(--admin-fg-subtle)',
                marginTop: 2,
              }}>
                ${overdueSum.toLocaleString()}
              </p>
              {overdue.length > 0 && (
                <p style={{ fontSize: 10, color: 'var(--admin-red)', marginTop: 2 }}>
                  {overdue.length} cuota{overdue.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard accent="gold" padding="sm">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5" style={{ color: 'var(--admin-gold)' }} />
            <div>
              <p style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
                color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)',
              }}>
                PRÓX · 7 DÍAS
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--admin-gold)', marginTop: 2 }}>
                ${upcomingWeekSum.toLocaleString()}
              </p>
              {upcomingWeek.length > 0 && (
                <p style={{ fontSize: 10, color: 'var(--admin-gold)', marginTop: 2 }}>
                  {upcomingWeek.length} pago{upcomingWeek.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard accent="blue" padding="sm">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5" style={{ color: 'var(--admin-blue)' }} />
            <div>
              <p style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
                color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)',
              }}>
                COBRADO · TOTAL
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--admin-blue)', marginTop: 2 }}>
                ${totalCollected.toLocaleString()}
              </p>
            </div>
          </div>
        </AdminCard>
      </div>

      {/* ZONA 3: RESUMEN DE CONTRATOS */}
      <div className="grid gap-4 md:grid-cols-4">
        <ContractStat icon={<CheckCircle className="w-7 h-7" style={{ color: 'var(--admin-green)' }} />} label="Firmados este mes" value={signedThisMonth.length} />
        <ContractStat icon={<Send className="w-7 h-7" style={{ color: 'var(--admin-gold)' }} />} label="Pendiente firma" value={pendingSignature.length} />
        <ContractStat icon={<FileSignature className="w-7 h-7" style={{ color: 'var(--admin-fg-subtle)' }} />} label="Borradores" value={drafts.length} />
        <ContractStat icon={<Users className="w-7 h-7" style={{ color: 'var(--admin-blue)' }} />} label="Casos activos" value={activeCasesCount} />
      </div>

      {/* ZONA 4: CLIENTES A RETENER (cuotas vencidas) */}
      {clientsWithOverdue.size > 0 && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, var(--admin-red-soft), var(--admin-panel-grad))',
            border: '0.5px solid var(--admin-red)',
          }}
        >
          <div className="mb-4">
            <h2
              className="flex items-center gap-2"
              style={{ fontSize: 16, fontWeight: 700, color: 'var(--admin-red)' }}
            >
              <AlertTriangle className="w-5 h-5" />
              Clientes con cuotas vencidas
            </h2>
            <p style={{ fontSize: 12, color: 'var(--admin-red)', opacity: 0.8, marginTop: 4 }}>
              Contactar para retención. Marca pagados sin salir de aquí — se notifica al cliente y queda en bitácora.
            </p>
          </div>
          <div className="space-y-2">
            {Array.from(clientsWithOverdue.entries())
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 6)
              .map(([clientId, info]) => {
                const oldestPayment = info.payments
                  .slice()
                  .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))[0]
                return (
                  <div
                    key={clientId}
                    className="rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap"
                    style={{
                      background: 'var(--admin-bg-elev)',
                      border: '0.5px solid var(--admin-red)',
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)' }}>
                        {info.name}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)' }}>
                        {info.payments.length} cuota{info.payments.length !== 1 ? 's' : ''} vencida{info.payments.length !== 1 ? 's' : ''} · {info.phone || 'sin teléfono'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--admin-red)', marginRight: 4 }}>
                        ${info.total.toLocaleString()}
                      </p>
                      <button
                        type="button"
                        onClick={() => setMarkPaidTarget({ clientName: info.name, payments: info.payments })}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-opacity hover:opacity-90"
                        style={{
                          background: 'linear-gradient(135deg, var(--admin-green), color-mix(in srgb, var(--admin-green) 80%, black))',
                          color: '#FFFFFF',
                          fontSize: 11,
                          fontWeight: 700,
                          boxShadow: '0 6px 16px rgba(21,128,61,0.20)',
                        }}
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
              <p
                className="text-center pt-2"
                style={{ fontSize: 12, color: 'var(--admin-fg-subtle)' }}
              >
                +{clientsWithOverdue.size - 6} más
              </p>
            )}
          </div>
        </div>
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
        <QuickLink href="/employee/contratos" icon={<FileSignature className="w-5 h-5" />} label="Contratos" hint={`${contracts.length} total`} tone="gold" />
        <QuickLink href="/employee/clientes" icon={<Users className="w-5 h-5" />} label="Clientes" hint={`${totalClientsCount}`} tone="green" />
        <QuickLink href="/employee/cases" icon={<Briefcase className="w-5 h-5" />} label="Casos" hint={`${activeCasesCount} activos`} tone="blue" />
        <QuickLink href="/employee/citas" icon={<Calendar className="w-5 h-5" />} label="Citas" tone="accent" />
        <QuickLink href="/employee/metricas" icon={<CreditCard className="w-5 h-5" />} label="Métricas" tone="neutral" />
      </div>
    </div>
  )
}

function ContractStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <AdminCard padding="md">
      <div className="flex items-center justify-between">
        <div>
          <p style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
            color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)',
            marginBottom: 4,
          }}>
            {label.toUpperCase()}
          </p>
          <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--admin-fg)' }}>
            {value}
          </p>
        </div>
        {icon}
      </div>
    </AdminCard>
  )
}

function QuickLink({
  href, icon, label, hint, tone,
}: {
  href: string
  icon: React.ReactNode
  label: string
  hint?: string
  tone: 'gold' | 'green' | 'blue' | 'accent' | 'neutral'
}) {
  const palette = {
    gold:    { bg: 'var(--admin-gold-soft)',   text: 'var(--admin-gold)',   border: 'var(--admin-gold-border, var(--admin-gold))' },
    green:   { bg: 'var(--admin-green-soft)',  text: 'var(--admin-green)',  border: 'var(--admin-green)' },
    blue:    { bg: 'var(--admin-blue-soft)',   text: 'var(--admin-blue)',   border: 'var(--admin-blue)' },
    accent:  { bg: 'var(--admin-accent-soft)', text: 'var(--admin-accent)', border: 'var(--admin-border-strong)' },
    neutral: { bg: 'var(--admin-bg-elev-2)',   text: 'var(--admin-fg-muted)', border: 'var(--admin-border)' },
  }[tone]
  return (
    <Link
      href={href}
      className="rounded-xl p-4 flex flex-col gap-1 transition-shadow hover:shadow-lg"
      style={{
        background: palette.bg,
        border: `0.5px solid ${palette.border}`,
        color: palette.text,
      }}
    >
      <div className="flex items-center justify-between">
        {icon}
        <ArrowRight className="w-4 h-4" style={{ opacity: 0.5 }} />
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{label}</p>
      {hint && <p style={{ fontSize: 11, opacity: 0.7 }}>{hint}</p>}
    </Link>
  )
}

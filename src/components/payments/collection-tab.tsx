'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle, Clock, FileSignature, DollarSign } from 'lucide-react'
import { MarkPaidModal, type OverduePayment } from './mark-paid-modal'
import { WhatsAppTemplates } from '@/components/communication/whatsapp-templates'

export interface CollectionContract {
  id: string
  case_id: string | null
  service_name: string | null
  total_price: number
  status: string
  signed_at: string | null
  signing_token: string | null
  has_installments: boolean
  initial_payment: number | null
  installment_count: number | null
}

export interface CollectionPayment {
  id: string
  amount: number
  status: string
  due_date: string | null
  paid_at: string | null
  installment_number: number | null
  total_installments: number | null
  payment_method: string | null
  case_id: string | null
}

interface Props {
  caseId: string
  clientName: string
  clientPhone: string | null
  contracts: CollectionContract[]
  payments: CollectionPayment[]
}

/**
 * Tab "Cobranza" — vista unificada por caso para Andrium.
 * Muestra resumen del contrato + cronograma completo de pagos con
 * botones inline para marcar pagado y enviar WhatsApp.
 */
export function CollectionTab({
  caseId, clientName, clientPhone, contracts, payments,
}: Props) {
  const [markPaidTarget, setMarkPaidTarget] = useState<OverduePayment[] | null>(null)

  // Asumimos 1 contrato por caso (el sistema ya migró a esa relación).
  // Si hay varios, tomamos el más reciente firmado primero.
  const contract = useMemo(() => {
    const sorted = [...contracts].sort((a, b) => {
      if (a.signed_at && b.signed_at) return b.signed_at.localeCompare(a.signed_at)
      if (a.signed_at) return -1
      if (b.signed_at) return 1
      return 0
    })
    return sorted[0] ?? null
  }, [contracts])

  // Ordenar pagos por número de cuota (vencido primero si está pending)
  const orderedPayments = useMemo(() => {
    return [...payments].sort((a, b) => {
      const an = a.installment_number ?? 999
      const bn = b.installment_number ?? 999
      return an - bn
    })
  }, [payments])

  const collected = orderedPayments
    .filter((p) => p.status === 'completed')
    .reduce((s, p) => s + Number(p.amount), 0)
  const pendingTotal = orderedPayments
    .filter((p) => p.status === 'pending')
    .reduce((s, p) => s + Number(p.amount), 0)
  const total = collected + pendingTotal
  const pct = total > 0 ? Math.round((collected / total) * 100) : 0

  const todayStr = new Date().toISOString().slice(0, 10)
  const overduePayments: OverduePayment[] = orderedPayments
    .filter((p) => p.status === 'pending' && p.due_date && p.due_date < todayStr)
    .map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      due_date: p.due_date,
      installment_number: p.installment_number,
      total_installments: p.total_installments,
    }))

  return (
    <div className="space-y-5">
      {/* Resumen del contrato */}
      {contract ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-[#F2A900]" />
              Contrato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCell label="Servicio" value={contract.service_name || '—'} small />
              <KpiCell
                label="Monto total"
                value={`$${Number(contract.total_price).toLocaleString()}`}
              />
              <KpiCell label="Estado" value={statusLabel(contract.status)} small />
              <KpiCell
                label="Firmado"
                value={contract.signed_at ? formatDate(contract.signed_at) : 'Pendiente'}
                small
              />
            </div>

            {/* Barra de progreso de cobranza */}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-xs font-medium text-gray-700">
                  Cobrado: ${collected.toLocaleString()} de ${total.toLocaleString()}
                </p>
                <span className="font-mono text-xs text-emerald-700 font-semibold">
                  {pct}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {pendingTotal > 0 && (
                <p className="mt-2 text-[11px] text-gray-500">
                  Pendiente por cobrar: ${pendingTotal.toLocaleString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-gray-500">
            Este caso aún no tiene contrato registrado.
          </CardContent>
        </Card>
      )}

      {/* Acciones rápidas globales del caso */}
      {(overduePayments.length > 0 || clientPhone) && (
        <Card className={overduePayments.length > 0 ? 'border-red-200 bg-red-50/30' : ''}>
          <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              {overduePayments.length > 0 ? (
                <span className="text-red-800 font-medium">
                  {overduePayments.length} cuota{overduePayments.length !== 1 ? 's' : ''} vencida
                  {overduePayments.length !== 1 ? 's' : ''}.
                </span>
              ) : (
                <span className="text-gray-700">Sin pagos vencidos en este caso.</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {overduePayments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMarkPaidTarget(overduePayments)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Marcar pagado
                </button>
              )}
              <WhatsAppTemplates
                context={{
                  client_name: clientName,
                  client_first_name: clientName.split(' ')[0],
                  client_phone: clientPhone,
                  amount: overduePayments.length > 0
                    ? overduePayments.reduce((s, p) => s + p.amount, 0)
                    : undefined,
                  due_date: overduePayments[0]?.due_date ?? undefined,
                  signing_url:
                    contract?.signing_token && typeof window !== 'undefined'
                      ? `${window.location.origin}/contrato/${contract.signing_token}`
                      : undefined,
                  service_name: contract?.service_name ?? undefined,
                }}
                variant="button"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cronograma de pagos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Cronograma de pagos
          </CardTitle>
          <p className="text-xs text-gray-500">
            {orderedPayments.length} cuotas en total
          </p>
        </CardHeader>
        <CardContent>
          {orderedPayments.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              Este caso aún no tiene cuotas registradas. Probablemente el cliente pagó al
              contado o el contrato aún no se firmó.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {orderedPayments.map((p) => {
                const isOverdue =
                  p.status === 'pending' && p.due_date && p.due_date < todayStr
                const isPaid = p.status === 'completed'
                const single: OverduePayment = {
                  id: p.id,
                  amount: Number(p.amount),
                  due_date: p.due_date,
                  installment_number: p.installment_number,
                  total_installments: p.total_installments,
                }
                return (
                  <div
                    key={p.id}
                    className="py-3 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Status indicator */}
                      {isPaid ? (
                        <span className="flex-shrink-0 h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </span>
                      ) : isOverdue ? (
                        <span className="flex-shrink-0 h-7 w-7 rounded-full bg-red-100 text-red-700 inline-flex items-center justify-center">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="flex-shrink-0 h-7 w-7 rounded-full bg-gray-100 text-gray-500 inline-flex items-center justify-center">
                          <Clock className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          Cuota {p.installment_number ?? '?'}/{p.total_installments ?? '?'}
                          <span className="ml-2 font-mono font-normal text-gray-700">
                            ${Number(p.amount).toLocaleString()}
                          </span>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {isPaid && p.paid_at && (
                            <>Pagada el {formatDate(p.paid_at)}{p.payment_method ? ` · ${p.payment_method}` : ''}</>
                          )}
                          {!isPaid && p.due_date && (
                            <>
                              {isOverdue ? 'Vencía' : 'Vence'} {p.due_date}
                            </>
                          )}
                          {!isPaid && !p.due_date && 'Sin fecha de vencimiento'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isPaid && (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                          Pagada
                        </Badge>
                      )}
                      {isOverdue && (
                        <Badge className="bg-red-100 text-red-700 text-[10px]">
                          Vencida
                        </Badge>
                      )}
                      {!isPaid && (
                        <button
                          type="button"
                          onClick={() => setMarkPaidTarget([single])}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-2.5 py-1.5 transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Pagado
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <MarkPaidModal
        open={markPaidTarget !== null}
        onClose={() => setMarkPaidTarget(null)}
        clientName={clientName}
        payments={markPaidTarget ?? []}
      />

      {/* avoid unused warning */}
      <div style={{ display: 'none' }}>{caseId}</div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────

function KpiCell({
  label, value, small,
}: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">
        {label}
      </p>
      <p
        className={`font-semibold text-gray-900 tabular-nums leading-tight ${
          small ? 'text-sm' : 'text-xl'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    borrador: 'Borrador',
    pendiente_firma: 'Pendiente firma',
    firmado: 'Firmado',
    activo: 'Activo',
    completado: 'Completado',
    cancelado: 'Cancelado',
  }
  return map[status] || status
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
}

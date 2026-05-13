'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, DollarSign, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export interface OverduePayment {
  id: string
  amount: number
  due_date: string | null
  installment_number: number | null
  total_installments: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  clientName: string
  payments: OverduePayment[]
  /** Callback opcional cuando la marca fue exitosa (default: router.refresh) */
  onMarked?: () => void
}

const PAYMENT_METHODS = [
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'otro', label: 'Otro' },
]

/**
 * Modal para marcar un pago vencido como pagado. Acepta varias cuotas
 * del mismo cliente — Andrium elige cuál confirmar. POST a
 * /api/admin/payments/mark-paid (ya permite contracts_manager).
 */
export function MarkPaidModal({
  open, onClose, clientName, payments, onMarked,
}: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string>(
    () => payments[0]?.id ?? '',
  )
  const [method, setMethod] = useState<string>('zelle')
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const selectedPayment = payments.find((p) => p.id === selectedId) ?? payments[0]
  const canSubmit = !!selectedPayment && !submitting

  async function handleSubmit() {
    if (!selectedPayment) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/payments/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: selectedPayment.id,
          payment_method: method,
          notes: notes.trim() || undefined,
        }),
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || `Error HTTP ${res.status}`)
        return
      }
      toast.success(
        `Pago marcado · cuota ${selectedPayment.installment_number ?? '?'}/${selectedPayment.total_installments ?? '?'} ($${Number(selectedPayment.amount).toLocaleString()})`,
      )
      onMarked ? onMarked() : router.refresh()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => !submitting && onClose()}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">
              Marcar pagado
            </p>
            <h2 className="mt-1 text-lg font-bold text-gray-900 leading-tight">
              {clientName}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Selector de cuota */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Cuota a marcar
            </label>
            {payments.length === 1 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-gray-900">
                    ${Number(payments[0].amount).toLocaleString()}
                  </span>
                  <span className="text-gray-500 ml-2">
                    cuota {payments[0].installment_number ?? '?'}/{payments[0].total_installments ?? '?'}
                  </span>
                  {payments[0].due_date && (
                    <span className="text-red-600 text-xs ml-2">
                      vencía {payments[0].due_date}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {payments.map((p) => (
                  <option key={p.id} value={p.id}>
                    ${Number(p.amount).toLocaleString()} · cuota{' '}
                    {p.installment_number ?? '?'}/{p.total_installments ?? '?'}
                    {p.due_date ? ` · vencía ${p.due_date}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Método de pago
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                    method === m.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notas opcionales */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Nota (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ej. comprobante #1234"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <p className="text-[11px] text-gray-500 leading-relaxed bg-gray-50 rounded-md px-3 py-2.5">
            Esta acción registra el pago como recibido, notifica al cliente y
            queda en la bitácora con tu nombre y la fecha de hoy.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Marcando…
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Confirmar pago
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

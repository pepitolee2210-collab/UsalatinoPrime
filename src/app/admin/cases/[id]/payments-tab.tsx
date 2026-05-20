'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { Loader2, Plus, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface Payment {
  id: string
  installment_number: number
  total_installments: number
  amount: number | string
  status: string
  due_date: string | null
  paid_at: string | null
  payment_method: string | null
}

interface PaymentsTabProps {
  caseId: string
  totalCost: number | string | null
  payments: Payment[]
}

/**
 * Pestaña de pagos para el panel admin. Tabla con cuotas + dialog "Crear Plan
 * de Cuotas". Reside en `/admin/cases/[id]/` porque solo Henry la ve (Diana no
 * gestiona cobros). Si en el futuro Diana necesita verla, exponer en
 * `dashboard-tabs.ts` con `requiresRole: 'any'`.
 */
export function PaymentsTab({ caseId, totalCost, payments }: PaymentsTabProps) {
  const router = useRouter()
  const [markPaidLoading, setMarkPaidLoading] = useState<string | null>(null)
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)
  const [planForm, setPlanForm] = useState({
    total_amount: String(totalCost || ''),
    num_installments: '10',
    payment_method: 'manual',
    first_payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const totalPaid = payments
    .filter((p) => p.status === 'completed')
    .reduce((s, p) => s + Number(p.amount), 0)
  const totalPending = payments
    .filter((p) => p.status === 'pending')
    .reduce((s, p) => s + Number(p.amount), 0)

  async function handleMarkInstallmentPaid(paymentId: string) {
    setMarkPaidLoading(paymentId)
    try {
      const res = await fetch('/api/admin/payments/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId, payment_method: 'manual' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      toast.success('Pago marcado como completado')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al marcar pago')
    } finally {
      setMarkPaidLoading(null)
    }
  }

  async function handleCreatePaymentPlan() {
    if (!planForm.total_amount || !planForm.num_installments) {
      toast.error('Complete los campos requeridos')
      return
    }
    setPlanLoading(true)
    try {
      const res = await fetch('/api/admin/payments/create-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          total_amount: Number(planForm.total_amount),
          num_installments: Number(planForm.num_installments),
          payment_method: planForm.payment_method,
          first_payment_date: planForm.first_payment_date,
          notes: planForm.notes,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      toast.success('Plan de cuotas creado')
      setPlanDialogOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al crear plan')
    } finally {
      setPlanLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">Total del Servicio</p>
            <p className="text-lg font-bold text-gray-900">${Number(totalCost || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">Pagado</p>
            <p className="text-lg font-bold text-green-600">${totalPaid.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">Pendiente</p>
            <p className="text-lg font-bold text-yellow-600">${totalPending.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {payments.length === 0 && (
        <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1" /> Crear Plan de Cuotas
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Plan de Cuotas</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Monto Total ($)</Label>
                <Input
                  type="number"
                  value={planForm.total_amount}
                  onChange={(e) => setPlanForm({ ...planForm, total_amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Numero de cuotas</Label>
                <Select
                  value={planForm.num_installments}
                  onValueChange={(v) => setPlanForm({ ...planForm, num_installments: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (pago unico)</SelectItem>
                    <SelectItem value="3">3 cuotas</SelectItem>
                    <SelectItem value="5">5 cuotas</SelectItem>
                    <SelectItem value="10">10 cuotas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha del primer pago</Label>
                <Input
                  type="date"
                  value={planForm.first_payment_date}
                  onChange={(e) => setPlanForm({ ...planForm, first_payment_date: e.target.value })}
                />
                <p className="text-xs text-gray-500">Cuotas siguientes se calculan mensualmente desde esta fecha</p>
              </div>
              <div className="space-y-1.5">
                <Label>Metodo de pago</Label>
                <Select
                  value={planForm.payment_method}
                  onValueChange={(v) => setPlanForm({ ...planForm, payment_method: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="zelle">Zelle</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreatePaymentPlan} disabled={planLoading} className="w-full">
                {planLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Crear Plan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {payments.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuota</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Pagado</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const isOverdue =
                    p.status === 'pending' && p.due_date && new Date(p.due_date) < new Date()
                  return (
                    <TableRow key={p.id} className={isOverdue ? 'bg-red-50/50' : ''}>
                      <TableCell className="text-sm font-medium">
                        {p.installment_number}/{p.total_installments}
                      </TableCell>
                      <TableCell className="text-sm font-semibold">
                        ${Number(p.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            isOverdue
                              ? 'bg-red-100 text-red-800'
                              : p.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : p.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {isOverdue
                            ? 'Vencido'
                            : p.status === 'completed'
                              ? 'Pagado'
                              : 'Pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {p.due_date ? format(new Date(p.due_date), 'd MMM yyyy', { locale: es }) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {p.paid_at ? format(new Date(p.paid_at), 'd MMM yyyy', { locale: es }) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {p.payment_method || '—'}
                      </TableCell>
                      <TableCell>
                        {p.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkInstallmentPaid(p.id)}
                            disabled={markPaidLoading === p.id}
                          >
                            {markPaidLoading === p.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            )}
                            Pagado
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-gray-500">No hay pagos registrados. Cree un plan de cuotas para este caso.</p>
      )}
    </div>
  )
}

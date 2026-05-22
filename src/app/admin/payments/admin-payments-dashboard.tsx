'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  DollarSign, Clock, AlertTriangle, CheckCircle,
  Plus, CreditCard, Loader2,
} from 'lucide-react'

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  overdue: 'bg-red-100 text-red-800',
  processing: 'bg-blue-100 text-blue-800',
  refunded: 'bg-gray-100 text-gray-800',
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  completed: 'Completado',
  failed: 'Fallido',
  overdue: 'Vencido',
  processing: 'Procesando',
  refunded: 'Reembolsado',
}

interface AdminPaymentsDashboardProps {
  initialPayments: any[]
  cases: any[]
}

export function AdminPaymentsDashboard({ initialPayments, cases }: AdminPaymentsDashboardProps) {
  const [payments] = useState(initialPayments)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterMethod, setFilterMethod] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [markPaidLoading, setMarkPaidLoading] = useState<string | null>(null)

  // Register payment dialog state
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registerForm, setRegisterForm] = useState({
    case_id: '',
    amount: '',
    payment_method: 'manual',
    notes: '',
  })
  const [registerLoading, setRegisterLoading] = useState(false)

  // Create plan dialog state
  const [planOpen, setPlanOpen] = useState(false)
  const [planForm, setPlanForm] = useState({
    case_id: '',
    total_amount: '',
    num_installments: '10',
    payment_method: 'manual',
    first_payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [planLoading, setPlanLoading] = useState(false)

  const router = useRouter()

  // Stats
  const totalCollected = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const pendingPayments = payments.filter(p => p.status === 'pending')
  const overduePayments = payments.filter(p => {
    if (p.status !== 'pending') return false
    return p.due_date && new Date(p.due_date) < new Date()
  })

  const now = new Date()
  const thisMonth = payments.filter(p =>
    p.status === 'completed' &&
    p.paid_at &&
    new Date(p.paid_at).getMonth() === now.getMonth() &&
    new Date(p.paid_at).getFullYear() === now.getFullYear()
  ).reduce((sum, p) => sum + Number(p.amount), 0)

  // Filtering
  const filteredPayments = payments.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (filterMethod !== 'all') {
      if (filterMethod === 'stripe' && p.payment_method !== 'stripe') return false
      if (filterMethod === 'manual' && p.payment_method === 'stripe') return false
    }
    if (searchTerm) {
      const clientName = `${p.client?.first_name || ''} ${p.client?.last_name || ''}`.toLowerCase()
      const caseNum = p.case?.case_number || ''
      if (!clientName.includes(searchTerm.toLowerCase()) && !caseNum.includes(searchTerm)) return false
    }
    return true
  })

  async function handleMarkPaid(paymentId: string) {
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
    } catch (error: any) {
      toast.error(error.message || 'Error al marcar pago')
    } finally {
      setMarkPaidLoading(null)
    }
  }

  async function handleRegisterPayment() {
    if (!registerForm.case_id || !registerForm.amount) {
      toast.error('Seleccione un caso y monto')
      return
    }
    setRegisterLoading(true)
    try {
      const res = await fetch('/api/admin/payments/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: registerForm.case_id,
          amount: Number(registerForm.amount),
          payment_method: registerForm.payment_method,
          notes: registerForm.notes,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      toast.success('Pago registrado')
      setRegisterOpen(false)
      setRegisterForm({ case_id: '', amount: '', payment_method: 'manual', notes: '' })
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al registrar pago')
    } finally {
      setRegisterLoading(false)
    }
  }

  async function handleCreatePlan() {
    if (!planForm.case_id || !planForm.total_amount || !planForm.num_installments) {
      toast.error('Complete todos los campos requeridos')
      return
    }
    setPlanLoading(true)
    try {
      const res = await fetch('/api/admin/payments/create-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: planForm.case_id,
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
      setPlanOpen(false)
      setPlanForm({ case_id: '', total_amount: '', num_installments: '10', payment_method: 'manual', first_payment_date: new Date().toISOString().split('T')[0], notes: '' })
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al crear plan')
    } finally {
      setPlanLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
        <div className="flex gap-2">
          {/* Register Single Payment */}
          <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" /> Registrar Pago
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Pago Manual</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Caso</Label>
                  <Select value={registerForm.case_id} onValueChange={(v) => setRegisterForm({ ...registerForm, case_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar caso" /></SelectTrigger>
                    <SelectContent>
                      {cases.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          #{c.case_number} - {c.client?.first_name} {c.client?.last_name} ({c.service?.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Monto ($)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={registerForm.amount}
                    onChange={(e) => setRegisterForm({ ...registerForm, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Metodo de pago</Label>
                  <Select value={registerForm.payment_method} onValueChange={(v) => setRegisterForm({ ...registerForm, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="zelle">Zelle</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Notas (opcional)</Label>
                  <Textarea
                    placeholder="Notas sobre el pago..."
                    value={registerForm.notes}
                    onChange={(e) => setRegisterForm({ ...registerForm, notes: e.target.value })}
                  />
                </div>
                <Button onClick={handleRegisterPayment} disabled={registerLoading} className="w-full">
                  {registerLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Registrar Pago
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Create Payment Plan */}
          <Dialog open={planOpen} onOpenChange={setPlanOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <CreditCard className="w-4 h-4 mr-1" /> Crear Plan de Cuotas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Plan de Cuotas</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Caso</Label>
                  <Select value={planForm.case_id} onValueChange={(v) => setPlanForm({ ...planForm, case_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar caso" /></SelectTrigger>
                    <SelectContent>
                      {cases.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          #{c.case_number} - {c.client?.first_name} {c.client?.last_name} ({c.service?.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Monto Total ($)</Label>
                  <Input
                    type="number"
                    placeholder="Ej: 1500"
                    value={planForm.total_amount}
                    onChange={(e) => setPlanForm({ ...planForm, total_amount: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Numero de cuotas</Label>
                  <Select value={planForm.num_installments} onValueChange={(v) => setPlanForm({ ...planForm, num_installments: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 (pago unico)</SelectItem>
                      <SelectItem value="3">3 cuotas</SelectItem>
                      <SelectItem value="5">5 cuotas</SelectItem>
                      <SelectItem value="10">10 cuotas</SelectItem>
                    </SelectContent>
                  </Select>
                  {planForm.total_amount && Number(planForm.num_installments) > 1 && (
                    <p className="text-xs text-gray-500">
                      Cuota mensual: ${Math.round(Number(planForm.total_amount) / Number(planForm.num_installments)).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha del primer pago</Label>
                  <Input
                    type="date"
                    value={planForm.first_payment_date}
                    onChange={(e) => setPlanForm({ ...planForm, first_payment_date: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">Las cuotas siguientes se calculan mensualmente desde esta fecha</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Metodo de pago del primer pago</Label>
                  <Select value={planForm.payment_method} onValueChange={(v) => setPlanForm({ ...planForm, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="zelle">Zelle</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Notas (opcional)</Label>
                  <Textarea
                    placeholder="Notas..."
                    value={planForm.notes}
                    onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })}
                  />
                </div>
                <Button onClick={handleCreatePlan} disabled={planLoading} className="w-full">
                  {planLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Crear Plan de Cuotas
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Cobrado</p>
              <p className="text-xl font-bold text-gray-900">${totalCollected.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-100">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pagos Pendientes</p>
              <p className="text-xl font-bold text-gray-900">{pendingPayments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pagos Vencidos</p>
              <p className="text-xl font-bold text-gray-900">{overduePayments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Cobrado Este Mes</p>
              <p className="text-xl font-bold text-gray-900">${thisMonth.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por cliente o caso..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
            <SelectItem value="failed">Fallido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Metodo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="stripe">Stripe</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caso</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Cuota</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Metodo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Pagado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((p: any) => {
                const isOverdue = p.status === 'pending' && p.due_date && new Date(p.due_date) < new Date()
                const displayStatus = isOverdue ? 'overdue' : p.status
                return (
                  <TableRow key={p.id} className={isOverdue ? 'bg-red-50/50' : ''}>
                    <TableCell className="text-sm">#{p.case?.case_number}</TableCell>
                    <TableCell className="text-sm">
                      {p.client?.first_name} {p.client?.last_name}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {p.case?.service?.name || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.installment_number}/{p.total_installments}
                    </TableCell>
                    <TableCell className="text-sm font-semibold">
                      ${Number(p.amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {p.payment_method || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[displayStatus] || ''}>
                        {statusLabels[displayStatus] || displayStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {p.due_date
                        ? format(new Date(p.due_date), 'd MMM yyyy', { locale: es })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {p.paid_at
                        ? format(new Date(p.paid_at), 'd MMM yyyy', { locale: es })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {p.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkPaid(p.id)}
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
              {filteredPayments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                    No hay pagos que coincidan con los filtros
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

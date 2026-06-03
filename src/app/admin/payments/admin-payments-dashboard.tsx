'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  DollarSign, Clock, AlertTriangle, CheckCircle,
  Plus, CreditCard, Loader2, Search,
} from 'lucide-react'

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
  /** Cuando true, oculta el h1 interno (el padre renderiza un PageHeader). */
  hideHeader?: boolean
}

export function AdminPaymentsDashboard({ initialPayments, cases, hideHeader }: AdminPaymentsDashboardProps) {
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
        {!hideHeader && <h1 className="text-2xl font-bold text-[var(--admin-fg)]">Pagos</h1>}
        {hideHeader && <span />}
        <div className="flex gap-2">
          {/* Register Single Payment */}
          <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
            <DialogTrigger asChild>
              <button className={DARK_BTN_GHOST}>
                <Plus className="w-3.5 h-3.5" /> Registrar Pago
              </button>
            </DialogTrigger>
            <DialogContent className={DARK_DIALOG_CLS}>
              <DialogHeader>
                <DialogTitle className="text-[var(--admin-fg)]" style={DARK_DIALOG_TITLE}>Registrar Pago Manual</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Field label="Caso">
                  <DarkSelect
                    value={registerForm.case_id}
                    onChange={(v) => setRegisterForm({ ...registerForm, case_id: v })}
                    placeholder="Seleccionar caso"
                    options={cases.map((c: any) => ({
                      value: c.id,
                      label: `#${c.case_number} · ${c.client?.first_name} ${c.client?.last_name} (${c.service?.name})`,
                    }))}
                  />
                </Field>
                <Field label="Monto ($)">
                  <DarkInput
                    type="number"
                    placeholder="0.00"
                    value={registerForm.amount}
                    onChange={(v) => setRegisterForm({ ...registerForm, amount: v })}
                  />
                </Field>
                <Field label="Método de pago">
                  <DarkSelect
                    value={registerForm.payment_method}
                    onChange={(v) => setRegisterForm({ ...registerForm, payment_method: v })}
                    options={[
                      { value: 'manual', label: 'Manual' },
                      { value: 'zelle', label: 'Zelle' },
                      { value: 'efectivo', label: 'Efectivo' },
                      { value: 'transferencia', label: 'Transferencia' },
                    ]}
                  />
                </Field>
                <Field label="Notas (opcional)">
                  <DarkTextarea
                    placeholder="Notas sobre el pago…"
                    value={registerForm.notes}
                    onChange={(v) => setRegisterForm({ ...registerForm, notes: v })}
                  />
                </Field>
                <DarkSubmit onClick={handleRegisterPayment} loading={registerLoading}>
                  Registrar Pago
                </DarkSubmit>
              </div>
            </DialogContent>
          </Dialog>

          {/* Create Payment Plan */}
          <Dialog open={planOpen} onOpenChange={setPlanOpen}>
            <DialogTrigger asChild>
              <button className={DARK_BTN_SOLID}>
                <CreditCard className="w-3.5 h-3.5" /> Crear Plan de Cuotas
              </button>
            </DialogTrigger>
            <DialogContent className={DARK_DIALOG_CLS}>
              <DialogHeader>
                <DialogTitle className="text-[var(--admin-fg)]" style={DARK_DIALOG_TITLE}>Crear Plan de Cuotas</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Field label="Caso">
                  <DarkSelect
                    value={planForm.case_id}
                    onChange={(v) => setPlanForm({ ...planForm, case_id: v })}
                    placeholder="Seleccionar caso"
                    options={cases.map((c: any) => ({
                      value: c.id,
                      label: `#${c.case_number} · ${c.client?.first_name} ${c.client?.last_name} (${c.service?.name})`,
                    }))}
                  />
                </Field>
                <Field label="Monto Total ($)">
                  <DarkInput
                    type="number"
                    placeholder="Ej: 1500"
                    value={planForm.total_amount}
                    onChange={(v) => setPlanForm({ ...planForm, total_amount: v })}
                  />
                </Field>
                <Field label="Número de cuotas">
                  <DarkSelect
                    value={planForm.num_installments}
                    onChange={(v) => setPlanForm({ ...planForm, num_installments: v })}
                    options={[
                      { value: '1', label: '1 (pago único)' },
                      { value: '3', label: '3 cuotas' },
                      { value: '5', label: '5 cuotas' },
                      { value: '10', label: '10 cuotas' },
                    ]}
                  />
                  {planForm.total_amount && Number(planForm.num_installments) > 1 && (
                    <p style={{ fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 6, fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
                      CUOTA MENSUAL: ${Math.round(Number(planForm.total_amount) / Number(planForm.num_installments)).toLocaleString()}
                    </p>
                  )}
                </Field>
                <Field label="Fecha del primer pago" hint="Las cuotas siguientes se calculan mensualmente desde esta fecha">
                  <DarkInput
                    type="date"
                    value={planForm.first_payment_date}
                    onChange={(v) => setPlanForm({ ...planForm, first_payment_date: v })}
                  />
                </Field>
                <Field label="Método de pago del primer pago">
                  <DarkSelect
                    value={planForm.payment_method}
                    onChange={(v) => setPlanForm({ ...planForm, payment_method: v })}
                    options={[
                      { value: 'manual', label: 'Manual' },
                      { value: 'zelle', label: 'Zelle' },
                      { value: 'efectivo', label: 'Efectivo' },
                      { value: 'transferencia', label: 'Transferencia' },
                    ]}
                  />
                </Field>
                <Field label="Notas (opcional)">
                  <DarkTextarea
                    placeholder="Notas…"
                    value={planForm.notes}
                    onChange={(v) => setPlanForm({ ...planForm, notes: v })}
                  />
                </Field>
                <DarkSubmit onClick={handleCreatePlan} loading={planLoading}>
                  Crear Plan de Cuotas
                </DarkSubmit>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DarkStat
          icon={<DollarSign className="w-4 h-4" />}
          label="Total Cobrado"
          value={`$${totalCollected.toLocaleString()}`}
          tone="success"
        />
        <DarkStat
          icon={<Clock className="w-4 h-4" />}
          label="Pendientes"
          value={pendingPayments.length}
          tone="warning"
        />
        <DarkStat
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Vencidos"
          value={overduePayments.length}
          tone="danger"
        />
        <DarkStat
          icon={<CheckCircle className="w-4 h-4" />}
          label="Cobrado Este Mes"
          value={`$${thisMonth.toLocaleString()}`}
          tone="info"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--admin-fg-subtle)' }} />
          <input
            type="text"
            placeholder="Buscar por cliente o caso…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/25"
            style={{
              background: 'var(--admin-veil-1)',
              border: '0.5px solid var(--admin-border-strong)',
              color: 'var(--admin-fg)',
              fontSize: 13,
              letterSpacing: '-0.005em',
            }}
          />
        </div>
        <FilterChips
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'pending', label: 'Pendiente' },
            { value: 'completed', label: 'Completado' },
            { value: 'overdue', label: 'Vencido' },
            { value: 'failed', label: 'Fallido' },
          ]}
        />
        <FilterChips
          value={filterMethod}
          onChange={setFilterMethod}
          options={[
            { value: 'all', label: 'Método: Todos' },
            { value: 'stripe', label: 'Stripe' },
            { value: 'manual', label: 'Manual' },
          ]}
        />
      </div>

      {/* Payments Table — dark techno */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border-strong)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--admin-border)', background: 'var(--admin-veil-1)' }}>
                <DarkTh>Caso</DarkTh>
                <DarkTh>Cliente</DarkTh>
                <DarkTh>Servicio</DarkTh>
                <DarkTh>Cuota</DarkTh>
                <DarkTh>Monto</DarkTh>
                <DarkTh>Método</DarkTh>
                <DarkTh>Estado</DarkTh>
                <DarkTh>Vencimiento</DarkTh>
                <DarkTh>Pagado</DarkTh>
                <DarkTh></DarkTh>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p: any, idx: number) => {
                const isOverdue = p.status === 'pending' && p.due_date && new Date(p.due_date) < new Date()
                const displayStatus = isOverdue ? 'overdue' : p.status
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: idx < filteredPayments.length - 1 ? '0.5px solid var(--admin-accent-soft)' : 'none',
                      background: 'transparent',
                      boxShadow: isOverdue ? 'inset 3px 0 0 var(--admin-red)' : 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--admin-veil-1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <DarkTd>
                      <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 12, fontWeight: 700, color: 'var(--admin-fg)', letterSpacing: '0.02em' }}>
                        #{p.case?.case_number}
                      </span>
                    </DarkTd>
                    <DarkTd>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>
                        {p.client?.first_name} {p.client?.last_name}
                      </span>
                    </DarkTd>
                    <DarkTd>
                      <span style={{ fontSize: 12, color: 'var(--admin-fg-muted)' }}>{p.case?.service?.name || '—'}</span>
                    </DarkTd>
                    <DarkTd>
                      <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 11, fontWeight: 700, color: 'var(--admin-fg-muted)' }}>
                        {p.installment_number}/{p.total_installments}
                      </span>
                    </DarkTd>
                    <DarkTd>
                      <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 13, fontWeight: 700, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>
                        ${Number(p.amount).toLocaleString()}
                      </span>
                    </DarkTd>
                    <DarkTd>
                      <span style={{ fontSize: 11, color: 'var(--admin-fg-muted)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
                        {(p.payment_method || '—').toUpperCase()}
                      </span>
                    </DarkTd>
                    <DarkTd>
                      <PaymentStatusBadge status={displayStatus} label={statusLabels[displayStatus] || displayStatus} />
                    </DarkTd>
                    <DarkTd>
                      <span style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
                        {p.due_date ? format(new Date(p.due_date), 'd MMM yyyy', { locale: es }).toUpperCase() : '—'}
                      </span>
                    </DarkTd>
                    <DarkTd>
                      <span style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.05em' }}>
                        {p.paid_at ? format(new Date(p.paid_at), 'd MMM yyyy', { locale: es }).toUpperCase() : '—'}
                      </span>
                    </DarkTd>
                    <DarkTd>
                      {p.status === 'pending' && (
                        <button
                          onClick={() => handleMarkPaid(p.id)}
                          disabled={markPaidLoading === p.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 hover:opacity-90 active:scale-95"
                          style={{
                            background: 'var(--primary)',
                            color: 'var(--primary-foreground)',
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '-0.005em',
                            boxShadow: '0 0 12px var(--admin-shadow)',
                          }}
                        >
                          {markPaidLoading === p.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Pagado
                        </button>
                      )}
                    </DarkTd>
                  </tr>
                )
              })}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12">
                    <p style={{ fontSize: 13, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em' }}>
                      SIN PAGOS QUE COINCIDAN CON LOS FILTROS
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// Dark techno helpers
// ════════════════════════════════════════════════════════════════════

type StatTone = 'success' | 'warning' | 'danger' | 'info'

const TONE_STYLES: Record<StatTone, { bg: string; border: string; iconColor: string; valueColor: string }> = {
  success: { bg: 'var(--admin-green-soft)',  border: 'var(--admin-green)',  iconColor: 'var(--admin-green)', valueColor: 'var(--admin-fg)' },
  warning: { bg: 'var(--admin-gold-soft)', border: 'var(--admin-gold)', iconColor: 'var(--admin-gold)', valueColor: 'var(--admin-fg)' },
  danger:  { bg: 'var(--admin-red-soft)', border: 'var(--admin-red)', iconColor: 'var(--admin-red)', valueColor: 'var(--admin-fg)' },
  info:    { bg: 'var(--admin-blue-soft)', border: 'var(--admin-blue)', iconColor: 'var(--admin-blue)', valueColor: 'var(--admin-fg)' },
}

function DarkStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: StatTone }) {
  const s = TONE_STYLES[tone]
  return (
    <div
      className="group relative rounded-2xl p-5 overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px solid var(--admin-border-strong)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at top, ${s.bg}, transparent 60%)` }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
          style={{
            background: s.bg,
            border: `0.5px solid ${s.border}`,
            color: s.iconColor,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--admin-fg-subtle)' }}>
            {label.toUpperCase()}
          </p>
          <p style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', color: s.valueColor, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </p>
        </div>
      </div>
    </div>
  )
}

function DarkTh({ children }: { children?: React.ReactNode }) {
  return (
    <th
      className="px-4 py-3 text-left"
      style={{
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.18em',
        color: 'var(--admin-fg-subtle)',
      }}
    >
      {typeof children === 'string' ? children.toUpperCase() : children}
    </th>
  )
}

function DarkTd({ children }: { children?: React.ReactNode }) {
  return (
    <td className="px-4 py-3" style={{ verticalAlign: 'middle' }}>
      {children}
    </td>
  )
}

function FilterChips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-full"
      style={{
        background: 'var(--admin-accent-soft)',
        border: '0.5px solid var(--admin-border)',
      }}
    >
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="px-3 py-1.5 rounded-full transition-all duration-200"
            style={{
              background: isActive ? 'var(--primary)' : 'transparent',
              color: isActive ? 'var(--primary-foreground)' : 'var(--admin-fg-muted)',
              fontSize: 11,
              fontWeight: isActive ? 700 : 500,
              letterSpacing: '-0.005em',
              boxShadow: isActive ? '0 0 12px var(--admin-shadow)' : 'none',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

const PAY_STATUS_COLORS: Record<string, { bg: string; border: string; dot: string; text: string }> = {
  pending:   { bg: 'var(--admin-gold-soft)', border: 'var(--admin-gold)', dot: 'var(--admin-gold)', text: 'var(--admin-gold-on)' },
  completed: { bg: 'var(--admin-green-soft)',  border: 'var(--admin-green)',  dot: 'var(--admin-green)', text: 'var(--admin-green-on)' },
  failed:    { bg: 'var(--admin-red-soft)', border: 'var(--admin-red)', dot: 'var(--admin-red)', text: 'var(--admin-red-on)' },
  overdue:   { bg: 'var(--admin-red-soft)', border: 'var(--admin-red)', dot: 'var(--admin-red)', text: 'var(--admin-red-on)' },
  processing:{ bg: 'var(--admin-blue-soft)', border: 'var(--admin-blue)', dot: 'var(--admin-blue)', text: 'var(--admin-blue-on)' },
  refunded:  { bg: 'var(--admin-accent-soft)', border: 'var(--admin-border-strong)', dot: 'var(--admin-fg-muted)', text: 'var(--admin-fg-muted)' },
}

function PaymentStatusBadge({ status, label }: { status: string; label: string }) {
  const s = PAY_STATUS_COLORS[status] || PAY_STATUS_COLORS.refunded
  const pulse = status === 'overdue' || status === 'processing'
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
      style={{
        background: s.bg,
        border: `0.5px solid ${s.border}`,
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: s.text,
      }}
    >
      <span className="relative flex items-center justify-center" style={{ width: 5, height: 5 }}>
        {pulse && (
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: s.dot, animation: 'ulp-ping 2s ease-in-out infinite' }}
          />
        )}
        <span
          className="relative rounded-full"
          style={{ width: 5, height: 5, background: s.dot, boxShadow: pulse ? `0 0 6px ${s.dot}` : 'none' }}
        />
      </span>
      {label.toUpperCase()}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════════
// Dark dialog form helpers
// ════════════════════════════════════════════════════════════════════

const DARK_DIALOG_CLS =
  'bg-[var(--admin-bg)] border border-white/10 text-[var(--admin-fg)] shadow-2xl backdrop-blur-xl ' +
  '[&>button]:text-[var(--admin-fg-muted)] [&>button]:hover:text-[var(--admin-fg)]'

const DARK_DIALOG_TITLE: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: '-0.022em',
  color: 'var(--admin-fg)',
}

const DARK_BTN_GHOST =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all duration-200 ' +
  'hover:opacity-90 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-white/[0.06] border border-white/15 text-[var(--admin-fg)]'

const DARK_BTN_SOLID =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-all duration-200 ' +
  'hover:opacity-90 active:scale-95 text-[12px] font-semibold tracking-tight ' +
  'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_4px_20px_rgba(255,255,255,0.18),0_0_0_0.5px_rgba(255,255,255,0.4)_inset]'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.18em',
          color: 'var(--admin-fg-muted)',
        }}
      >
        {label.toUpperCase()}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: 11, color: 'var(--admin-fg-subtle)', marginTop: 4, lineHeight: 1.4 }}>
          {hint}
        </p>
      )}
    </div>
  )
}

function DarkInput({ type = 'text', value, onChange, placeholder }: { type?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/30"
      style={{
        background: 'var(--admin-accent-soft)',
        border: '0.5px solid var(--admin-border-strong)',
        color: 'var(--admin-fg)',
        fontSize: 13,
        letterSpacing: '-0.005em',
        colorScheme: 'dark',
      }}
    />
  )
}

function DarkTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/30 resize-y"
      style={{
        background: 'var(--admin-accent-soft)',
        border: '0.5px solid var(--admin-border-strong)',
        color: 'var(--admin-fg)',
        fontSize: 13,
        letterSpacing: '-0.005em',
        minHeight: 80,
      }}
    />
  )
}

interface DarkSelectOption { value: string; label: string }

function DarkSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: DarkSelectOption[]; placeholder?: string }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none px-3.5 py-2.5 pr-9 rounded-xl text-sm outline-none transition-colors focus:border-white/30 cursor-pointer"
        style={{
          background: 'var(--admin-accent-soft)',
          border: '0.5px solid var(--admin-border-strong)',
          color: value ? 'var(--admin-fg)' : 'var(--admin-fg-subtle)',
          fontSize: 13,
          letterSpacing: '-0.005em',
        }}
      >
        {placeholder && <option value="" style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg-subtle)' }}>{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--admin-fg-subtle)', fontSize: 10 }}
      >
        ▾
      </span>
    </div>
  )
}

function DarkSubmit({ onClick, loading, children }: { onClick: () => void; loading?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
      style={{
        background: 'var(--primary)',
        color: 'var(--primary-foreground)',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '-0.005em',
        boxShadow: 'var(--admin-shadow)',
        marginTop: 8,
      }}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  )
}

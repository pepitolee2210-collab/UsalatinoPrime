import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  FileText, Users, DollarSign, AlertCircle, Clock,
  MessageCircle, CalendarClock, CheckCircle, TrendingUp,
  AlertTriangle, CreditCard, Shield, Baby,
} from 'lucide-react'
import { QuickContractGenerator } from '@/components/admin/QuickContractGenerator'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // ── Metrics ──
  const { count: submittedCount } = await supabase
    .from('cases')
    .select('*', { count: 'exact', head: true })
    .eq('intake_status', 'submitted')

  const { count: activeCount } = await supabase
    .from('cases')
    .select('*', { count: 'exact', head: true })
    .in('intake_status', ['in_progress', 'submitted', 'under_review', 'needs_correction'])

  const { count: clientCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'client')

  // ── Financial data ──
  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount, status, due_date, paid_at, payment_method, installment_number, total_installments, case:cases(case_number, service:service_catalog(name)), client:profiles(first_name, last_name)')
    .order('created_at', { ascending: false })

  const payments = allPayments || []

  const totalCollected = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const now = new Date()
  const totalOverdue = payments
    .filter(p => p.status === 'pending' && p.due_date && new Date(p.due_date) < now)
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const thisMonthCollected = payments
    .filter(p =>
      p.status === 'completed' &&
      p.paid_at &&
      new Date(p.paid_at).getMonth() === now.getMonth() &&
      new Date(p.paid_at).getFullYear() === now.getFullYear()
    )
    .reduce((sum, p) => sum + Number(p.amount), 0)

  // ── Cases needing attention ──
  const { data: attentionCases } = await supabase
    .from('cases')
    .select('*, service:service_catalog(name), client:profiles(first_name, last_name)')
    .in('intake_status', ['submitted', 'needs_correction'])
    .order('updated_at', { ascending: false })
    .limit(10)

  // ── WhatsApp pending: cases without payments and no access ──
  const { data: whatsappPending } = await supabase
    .rpc('get_cases_without_payments')
    .limit(10)

  // Fallback: if RPC doesn't exist, use a manual approach
  let whatsappCases = whatsappPending || []
  if (!whatsappPending || whatsappPending.length === 0) {
    const { data: casesNoAccess } = await supabase
      .from('cases')
      .select('id, created_at, total_cost, service:service_catalog(name), client:profiles(first_name, last_name)')
      .eq('access_granted', false)
      .order('created_at', { ascending: false })
      .limit(20)

    if (casesNoAccess) {
      // Filter out cases that DO have payments
      const caseIds = casesNoAccess.map(c => c.id)
      const { data: casesWithPayments } = await supabase
        .from('payments')
        .select('case_id')
        .in('case_id', caseIds.length > 0 ? caseIds : ['none'])

      const paidCaseIds = new Set((casesWithPayments || []).map(p => p.case_id))
      whatsappCases = casesNoAccess.filter(c => !paidCaseIds.has(c.id))
    }
  }

  // ── Upcoming due payments (next 7 days) ──
  const sevenDaysFromNow = addDays(now, 7).toISOString().split('T')[0]
  const todayStr = now.toISOString().split('T')[0]
  const { data: upcomingPayments } = await supabase
    .from('payments')
    .select('id, amount, due_date, installment_number, total_installments, case:cases(id, case_number, service:service_catalog(name)), client:profiles(first_name, last_name)')
    .eq('status', 'pending')
    .gte('due_date', todayStr)
    .lte('due_date', sevenDaysFromNow)
    .order('due_date', { ascending: true })
    .limit(10)

  // ── Recent payments (last 5 completed) ──
  const { data: recentPayments } = await supabase
    .from('payments')
    .select('id, amount, paid_at, payment_method, installment_number, total_installments, case:cases(case_number, service:service_catalog(name)), client:profiles(first_name, last_name)')
    .eq('status', 'completed')
    .order('paid_at', { ascending: false })
    .limit(5)

  // ── Zelle Pending Payments (Community) ──
  const { count: zellePendingCount } = await supabase
    .from('zelle_payments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  // ── Credible Fear Submissions ──
  const { data: credibleFearSubmissions, count: credibleFearCount } = await supabase
    .from('credible_fear_submissions')
    .select('*', { count: 'exact' })
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10)

  // ── Visa Juvenil Submissions ──
  const { count: visaJuvenilCount } = await supabase
    .from('visa_juvenil_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  // ── Asilo I-589 Submissions ──
  const { count: asiloCount } = await supabase
    .from('asilo_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const methodLabels: Record<string, string> = {
    stripe: 'Stripe',
    manual: 'Manual',
    zelle: 'Zelle',
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
  }

  const methodColors: Record<string, string> = {
    stripe: 'bg-purple-100 text-purple-800',
    manual: 'bg-gray-100 text-gray-800',
    zelle: 'bg-blue-100 text-blue-800',
    efectivo: 'bg-green-100 text-green-800',
    transferencia: 'bg-cyan-100 text-cyan-800',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* ── General Stats ── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Casos Enviados</p>
                <p className="text-3xl font-bold">{submittedCount || 0}</p>
              </div>
              <FileText className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Casos Activos</p>
                <p className="text-3xl font-bold">{activeCount || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Clientes</p>
                <p className="text-3xl font-bold">{clientCount || 0}</p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Cobrado Total</p>
                <p className="text-3xl font-bold">${totalCollected.toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Financial Stats ── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-xs text-gray-500">Cobrado Este Mes</p>
                <p className="text-xl font-bold text-emerald-700">${thisMonthCollected.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-xs text-gray-500">Pendiente de Cobro</p>
                <p className="text-xl font-bold text-yellow-700">${totalPending.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${totalOverdue > 0 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-5 h-5 ${totalOverdue > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              <div>
                <p className="text-xs text-gray-500">Vencido</p>
                <p className={`text-xl font-bold ${totalOverdue > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                  ${totalOverdue.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Link href="/admin/payments">
          <Card className="border-l-4 border-l-blue-500 hover:bg-gray-50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-500">Ver Todos los Pagos</p>
                  <p className="text-sm font-semibold text-blue-700">{payments.length} registros &rarr;</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Quick Contract Generator ── */}
      <QuickContractGenerator />

      {/* ── Zelle Pending Quick Link ── */}
      {(zellePendingCount ?? 0) > 0 && (
        <Link href="/admin/comunidad/zelle">
          <Card className="border-[#F2A900] hover:bg-[#F2A900]/5 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-[#F2A900]" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Pagos Zelle Comunidad</p>
                    <p className="text-xs text-gray-500">{zellePendingCount} comprobante{zellePendingCount! > 1 ? 's' : ''} pendiente{zellePendingCount! > 1 ? 's' : ''} de aprobación</p>
                  </div>
                </div>
                <Badge className="bg-[#F2A900] text-white">{zellePendingCount} &rarr;</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* ── Credible Fear Quick Link ── */}
      {(credibleFearCount ?? 0) > 0 && (
        <Link href="/admin/miedo-creible">
          <Card className="border-amber-200 hover:bg-amber-50/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Formularios de Miedo Cre&iacute;ble</p>
                    <p className="text-xs text-gray-500">{credibleFearCount} pendiente{credibleFearCount! > 1 ? 's' : ''} de revisi&oacute;n</p>
                  </div>
                </div>
                <Badge className="bg-amber-100 text-amber-800">{credibleFearCount} &rarr;</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* ── Visa Juvenil Quick Link ── */}
      {(visaJuvenilCount ?? 0) > 0 && (
        <Link href="/admin/visa-juvenil">
          <Card className="border-blue-200 hover:bg-blue-50/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Baby className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Formularios de Visa Juvenil (SIJS)</p>
                    <p className="text-xs text-gray-500">{visaJuvenilCount} pendiente{visaJuvenilCount! > 1 ? 's' : ''} de revisi&oacute;n</p>
                  </div>
                </div>
                <Badge className="bg-blue-100 text-blue-800">{visaJuvenilCount} &rarr;</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* ── Asilo I-589 Quick Link ── */}
      {(asiloCount ?? 0) > 0 && (
        <Link href="/admin/asilo">
          <Card className="border-indigo-200 hover:bg-indigo-50/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Formularios de Asilo I-589</p>
                    <p className="text-xs text-gray-500">{asiloCount} pendiente{asiloCount! > 1 ? 's' : ''} de revisi&oacute;n</p>
                  </div>
                </div>
                <Badge className="bg-indigo-100 text-indigo-800">{asiloCount} &rarr;</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* ── Attention Items ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Requieren Atenci&oacute;n
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attentionCases && attentionCases.length > 0 ? (
            <div className="space-y-3">
              {attentionCases.map((c: any) => (
                <Link key={c.id} href={`/admin/cases/${c.id}`} className="block">
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="font-medium text-sm">
                        {c.client?.first_name} {c.client?.last_name}
                      </p>
                      <p className="text-xs text-gray-500">{c.service?.name} — #{c.case_number}</p>
                    </div>
                    <Badge className={c.intake_status === 'submitted' ? 'bg-purple-100 text-purple-800' : 'bg-red-100 text-red-800'}>
                      {c.intake_status === 'submitted' ? 'Enviado' : 'Correcci\u00f3n Pendiente'}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No hay casos que requieran atenci&oacute;n inmediata.</p>
          )}
        </CardContent>
      </Card>

      {/* ── WhatsApp Pending Payments ── */}
      {whatsappCases.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
              Pagos por WhatsApp Pendientes
              <Badge className="bg-yellow-100 text-yellow-800 ml-2">{whatsappCases.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {whatsappCases.map((c: any) => (
                <Link key={c.id} href={`/admin/cases/${c.id}`} className="block">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-yellow-100 bg-yellow-50/50 hover:bg-yellow-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366]/10">
                        <MessageCircle className="w-4 h-4 text-[#25D366]" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {c.client?.first_name} {c.client?.last_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {c.service?.name} — ${Number(c.total_cost || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {format(new Date(c.created_at), "d MMM", { locale: es })}
                      </span>
                      <Badge className="bg-yellow-100 text-yellow-800">Registrar Pago</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Upcoming Due Payments ── */}
      {upcomingPayments && upcomingPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-orange-500" />
              Pr&oacute;ximos Vencimientos (7 d&iacute;as)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingPayments.map((p: any) => (
                <Link key={p.id} href={`/admin/cases/${p.case?.id}`} className="block">
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="font-medium text-sm">
                        {p.client?.first_name} {p.client?.last_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.case?.service?.name} — Cuota {p.installment_number}/{p.total_installments}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold">${Number(p.amount).toLocaleString()}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(p.due_date), "d MMM yyyy", { locale: es })}
                        </p>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800">Por vencer</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent Payments ── */}
      {recentPayments && recentPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Pagos Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPayments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-medium text-sm">
                      {p.client?.first_name} {p.client?.last_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.case?.service?.name} — #{p.case?.case_number} — Cuota {p.installment_number}/{p.total_installments}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-green-700">${Number(p.amount).toLocaleString()}</p>
                    <Badge className={methodColors[p.payment_method] || 'bg-gray-100 text-gray-800'}>
                      {methodLabels[p.payment_method] || p.payment_method || 'Manual'}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {p.paid_at ? format(new Date(p.paid_at), "d MMM", { locale: es }) : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  FileText, Users, DollarSign, AlertCircle, Clock,
  CalendarClock, TrendingUp, AlertTriangle, CreditCard,
  Baby, Copy, ClipboardList, MessageCircle,
} from 'lucide-react'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { CopyLinkButton } from './copy-link-button'
import { AssignTaskButton } from './assign-task-button'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // ── All queries in parallel ──
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)
  const sevenDaysFromNow = addDays(now, 7).toISOString().split('T')[0]
  const todayStr = now.toISOString().split('T')[0]

  const [
    submittedRes, activeRes, clientRes,
    paymentsRes, todayAptsRes, attentionRes,
    zellePendingRes, visaJuvenilRes, asiloRes,
    ajusteRes, renunciaRes, cambioRes,
    upcomingPayRes,
    servicesRes, employeesRes,
  ] = await Promise.all([
    supabase.from('cases').select('*', { count: 'exact', head: true }).eq('intake_status', 'submitted'),
    supabase.from('cases').select('*', { count: 'exact', head: true }).in('intake_status', ['in_progress', 'submitted', 'under_review', 'needs_correction']),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    supabase.from('payments').select('amount, status, due_date, paid_at').order('created_at', { ascending: false }),
    supabase.from('appointments')
      .select('id, scheduled_at, client:profiles(first_name, last_name), case:cases(case_number, service:service_catalog(name))')
      .eq('status', 'scheduled')
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())
      .order('scheduled_at', { ascending: true }),
    supabase.from('cases')
      .select('id, case_number, intake_status, service:service_catalog(name), client:profiles(first_name, last_name)')
      .in('intake_status', ['submitted', 'needs_correction'])
      .order('updated_at', { ascending: false })
      .limit(10),
    supabase.from('zelle_payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('visa_juvenil_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('asilo_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('ajuste_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('renuncia_submissions').select('*', { count: 'exact', head: true }).eq('status', 'nuevo'),
    supabase.from('cambio_corte_submissions').select('*', { count: 'exact', head: true }).eq('status', 'nuevo'),
    supabase.from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('due_date', todayStr)
      .lte('due_date', sevenDaysFromNow),
    supabase.from('service_catalog').select('id, name').order('name'),
    supabase.from('profiles').select('id, first_name, last_name').eq('role', 'employee'),
  ])

  const payments = paymentsRes.data || []
  const totalCollected = payments.filter(p => p.status === 'completed').reduce((s, p) => s + Number(p.amount), 0)
  const thisMonthCollected = payments
    .filter(p => p.status === 'completed' && p.paid_at && new Date(p.paid_at).getMonth() === now.getMonth() && new Date(p.paid_at).getFullYear() === now.getFullYear())
    .reduce((s, p) => s + Number(p.amount), 0)
  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0)
  const totalOverdue = payments.filter(p => p.status === 'pending' && p.due_date && new Date(p.due_date) < now).reduce((s, p) => s + Number(p.amount), 0)

  const todayAppointments = todayAptsRes.data || []
  const attentionCases = attentionRes.data || []
  const zellePending = zellePendingRes.count || 0
  const formsPending = (visaJuvenilRes.count || 0) + (asiloRes.count || 0) + (ajusteRes.count || 0) + (renunciaRes.count || 0) + (cambioRes.count || 0)
  const upcomingPayCount = upcomingPayRes.count || 0
  const servicesList = servicesRes.data || []
  const employeesList = employeesRes.data || []

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usalatino-prime-ofew.vercel.app'
  const citaLink = `${baseUrl}/cita`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {employeesList.length > 0 && (
          <AssignTaskButton services={servicesList} employees={employeesList} />
        )}
      </div>

      {/* ══════ ZONA 1: ACCIONES DE HOY ══════ */}
      <Card className="border-2 border-[#002855]/20 bg-gradient-to-r from-[#002855]/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#002855]" />
            Acciones de Hoy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Copy cita link */}
          <CopyLinkButton link={citaLink} />

          {/* Today's appointments */}
          {todayAppointments.length > 0 ? (
            <Link href="/admin/citas" className="block">
              <div className="rounded-lg border border-[#002855]/10 bg-white p-3 hover:bg-blue-50/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">Citas del Día</span>
                  <Badge className="bg-[#002855]/10 text-[#002855]">{todayAppointments.length}</Badge>
                </div>
                <div className="space-y-1.5">
                  {todayAppointments.map((apt: any) => {
                    const c = Array.isArray(apt.client) ? apt.client[0] : apt.client
                    const cs = Array.isArray(apt.case) ? apt.case[0] : apt.case
                    const svc = cs?.service ? (Array.isArray(cs.service) ? cs.service[0] : cs.service) : null
                    return (
                      <div key={apt.id} className="flex items-center justify-between py-1">
                        <div>
                          <span className="text-sm font-medium">{c?.first_name} {c?.last_name}</span>
                          <span className="text-xs text-gray-500 ml-2">#{cs?.case_number} — {svc?.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-[#002855]">
                          {new Date(apt.scheduled_at).toLocaleTimeString('en-US', {
                            timeZone: 'America/Denver', hour: 'numeric', minute: '2-digit', hour12: true,
                          })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Link>
          ) : (
            <div className="rounded-lg border border-gray-100 bg-white p-3 text-center">
              <p className="text-sm text-gray-400">Sin citas programadas para hoy</p>
            </div>
          )}

          {/* Attention cases */}
          {attentionCases.length > 0 && (
            <div className="rounded-lg border border-red-100 bg-white p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-semibold text-gray-900">Requieren Atención</span>
                <Badge className="bg-red-100 text-red-800 text-xs">{attentionCases.length}</Badge>
              </div>
              <div className="space-y-1">
                {attentionCases.slice(0, 5).map((c: any) => (
                  <Link key={c.id} href={`/admin/cases/${c.id}`} className="flex items-center justify-between py-1 hover:bg-gray-50 rounded px-1 transition-colors">
                    <div>
                      <span className="text-sm font-medium">{c.client?.first_name} {c.client?.last_name}</span>
                      <span className="text-xs text-gray-500 ml-2">{c.service?.name}</span>
                    </div>
                    <Badge className={`text-xs ${c.intake_status === 'submitted' ? 'bg-purple-100 text-purple-800' : 'bg-red-100 text-red-800'}`}>
                      {c.intake_status === 'submitted' ? 'Enviado' : 'Corrección'}
                    </Badge>
                  </Link>
                ))}
                {attentionCases.length > 5 && (
                  <Link href="/admin/cases" className="text-xs text-[#002855] hover:underline block text-right">
                    Ver todos ({attentionCases.length})
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Quick badges - Alerts */}
          <div className="flex flex-wrap gap-2">
            {zellePending > 0 && (
              <Link href="/admin/comunidad/zelle">
                <Badge className="bg-[#F2A900] text-white hover:bg-[#F2A900]/90 cursor-pointer px-3 py-1">
                  <DollarSign className="w-3 h-3 mr-1" />
                  {zellePending} Zelle pendiente{zellePending > 1 ? 's' : ''}
                </Badge>
              </Link>
            )}
            {formsPending > 0 && (
              <Link href="/admin/formularios">
                <Badge className="bg-indigo-500 text-white hover:bg-indigo-600 cursor-pointer px-3 py-1">
                  <ClipboardList className="w-3 h-3 mr-1" />
                  {formsPending} formulario{formsPending > 1 ? 's' : ''} nuevo{formsPending > 1 ? 's' : ''}
                </Badge>
              </Link>
            )}
            {upcomingPayCount > 0 && (
              <Link href="/admin/payments">
                <Badge className="bg-orange-500 text-white hover:bg-orange-600 cursor-pointer px-3 py-1">
                  <Clock className="w-3 h-3 mr-1" />
                  {upcomingPayCount} pago{upcomingPayCount > 1 ? 's' : ''} próx. 7 días
                </Badge>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ══════ ZONA 2: FINANZAS ══════ */}
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
          <Card className="border-l-4 border-l-blue-500 hover:bg-gray-50 transition-colors cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-500">Próx. 7 Días</p>
                  <p className="text-xl font-bold text-blue-700">{upcomingPayCount} pagos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ══════ ZONA 3: RESUMEN ══════ */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Casos Enviados</p>
                <p className="text-3xl font-bold">{submittedRes.count || 0}</p>
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
                <p className="text-3xl font-bold">{activeRes.count || 0}</p>
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
                <p className="text-3xl font-bold">{clientRes.count || 0}</p>
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
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EmployeeDashboard } from './employee-dashboard'
import { ConsultantDashboard } from './consultant-dashboard'
import { ContractsManagerDashboard } from './contracts-manager-dashboard'

export default async function EmployeeDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/employee')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, employee_type, first_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'employee') redirect('/employee')

  // ── Consultora Senior (Vanessa) ──
  if (profile.employee_type === 'senior_consultant') {
    const now = new Date()
    const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0)
    const todayEnd = new Date(now); todayEnd.setUTCHours(23, 59, 59, 999)
    const weekStart = new Date(now); weekStart.setUTCDate(weekStart.getUTCDate() - 7)

    const [todayRes, callNowRes, weekRes, acceptedNoContractRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, scheduled_at, guest_name, guest_phone, notes, call_status, client_decision')
        .eq('source', 'voice-agent')
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString())
        .order('scheduled_at'),
      supabase
        .from('appointments')
        .select('id, scheduled_at, guest_name, guest_phone, notes, call_status, created_at')
        .eq('source', 'voice-agent')
        .eq('call_status', 'llamada_ahora')
        .order('created_at', { ascending: false }),
      supabase
        .from('appointments')
        .select('id, client_decision, call_status, created_at')
        .eq('source', 'voice-agent')
        .gte('created_at', weekStart.toISOString()),
      supabase
        .from('appointments')
        .select('id, scheduled_at, guest_name, guest_phone, captured_data, updated_at')
        .eq('source', 'voice-agent')
        .eq('client_decision', 'acepta')
        .in('call_status', ['completada', 'en_curso'])
        .order('updated_at', { ascending: false })
        .limit(20),
    ])

    const weekItems = weekRes.data || []
    const weekStats = {
      total: weekItems.length,
      completadas: weekItems.filter(a => a.call_status === 'completada' || a.client_decision).length,
      acepta: weekItems.filter(a => a.client_decision === 'acepta').length,
      rechaza: weekItems.filter(a => a.client_decision === 'rechaza' || a.client_decision === 'no_procede').length,
    }

    return (
      <ConsultantDashboard
        firstName={profile.first_name || 'Consultora'}
        today={todayRes.data || []}
        callNow={callNowRes.data || []}
        acceptedNoContract={acceptedNoContractRes.data || []}
        weekStats={weekStats}
      />
    )
  }

  // ── Contracts Manager (Andrium) ──
  if (profile.employee_type === 'contracts_manager') {
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)

    const [contractsRes, paymentsRes, todayAptsRes, activeCasesRes, clientsRes] = await Promise.all([
      supabase
        .from('contracts')
        .select('id, client_full_name, service_name, total_price, status, signing_token, signed_at, client_phone, created_at, has_installments, initial_payment, installment_count')
        .order('created_at', { ascending: false }),
      supabase
        .from('payments')
        .select('id, amount, status, due_date, paid_at, installment_number, total_installments, client_id, client:profiles!payments_client_id_fkey(first_name, last_name, phone)')
        .order('due_date', { ascending: true }),
      supabase
        .from('appointments')
        .select('id, scheduled_at, client:profiles!appointments_client_id_fkey(first_name, last_name), case:cases(case_number)')
        .eq('status', 'scheduled')
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString())
        .order('scheduled_at'),
      supabase.from('cases').select('*', { count: 'exact', head: true })
        .in('intake_status', ['in_progress', 'submitted', 'under_review', 'needs_correction']),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    ])

    const contracts = (contractsRes.data || []) as any[]
    const payments = ((paymentsRes.data || []) as any[]).map(p => ({
      ...p,
      client: Array.isArray(p.client) ? p.client[0] : p.client,
    }))
    const todayAppointments = ((todayAptsRes.data || []) as any[]).map(a => ({
      ...a,
      client: Array.isArray(a.client) ? a.client[0] : a.client,
      case: Array.isArray(a.case) ? a.case[0] : a.case,
    }))

    return (
      <ContractsManagerDashboard
        firstName={profile.first_name || 'Andrium'}
        contracts={contracts}
        payments={payments}
        todayAppointments={todayAppointments}
        activeCasesCount={activeCasesRes.count || 0}
        totalClientsCount={clientsRes.count || 0}
      />
    )
  }

  // ── Paralegal (Diana) y legacy ──
  const { data: assignments } = await supabase
    .from('employee_case_assignments')
    .select(`
      id, task_description, status, assigned_at, updated_at, service_type, client_name,
      case:cases(
        id, case_number,
        client:profiles(first_name, last_name),
        service:service_catalog(name)
      )
    `)
    .eq('employee_id', user.id)
    .order('assigned_at', { ascending: false })

  const normalized = (assignments || []).map((a: any) => {
    const rawCase = Array.isArray(a.case) ? a.case[0] : a.case
    return {
      ...a,
      case: rawCase?.id ? {
        ...rawCase,
        client: Array.isArray(rawCase.client) ? rawCase.client[0] : (rawCase.client || null),
        service: Array.isArray(rawCase.service) ? rawCase.service[0] : (rawCase.service || null),
      } : null,
    }
  })

  return <EmployeeDashboard assignments={normalized} />
}

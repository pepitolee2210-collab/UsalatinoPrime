import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/admin/ceo-dashboard
 *
 * Devuelve todas las métricas del dashboard ejecutivo de Henry en un solo
 * payload (~12 queries en paralelo). El admin/dashboard/page.tsx lo
 * consume server-side para evitar waterfalls en el RSC.
 */
async function ensureAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return null
  return createServiceClient()
}

interface FunnelStage {
  key: string
  label: string
  count: number
  description: string
}

interface ServiceBreakdown {
  slug: string
  name: string
  cases: number
  contracts: number
  revenue_signed: number
  unique_clients: number
}

interface MonthlyPoint {
  month: string // YYYY-MM
  label: string // 'Mar 26'
  contracts_created: number
  contracts_signed: number
  revenue_collected: number
  revenue_expected: number
}

interface OperationItem {
  id: string
  client_name: string
  service_name: string
  total_price: number
  status: string
  created_at: string
  days_waiting: number
  has_signing_link: boolean
}

interface OverdueClient {
  client_id: string
  name: string
  phone: string | null
  total_overdue: number
  installments_overdue: number
  oldest_due_date: string
}

export interface CeoDashboardData {
  // KPIs principales
  kpi: {
    total_clients: number
    contracts_signed: number
    revenue_total_collected: number
    revenue_this_month: number
    revenue_last_month: number
    revenue_overdue: number
    active_cases: number
  }
  // Funnel completo
  funnel: FunnelStage[]
  // Servicios
  services: ServiceBreakdown[]
  // Tendencia 6 meses
  trend: MonthlyPoint[]
  // Operaciones (lo que Andrium maneja)
  ops: {
    pending_signature: OperationItem[]
    drafts_old: OperationItem[]
    overdue_clients: OverdueClient[]
    upcoming_payments_7d_count: number
    upcoming_payments_7d_amount: number
    stuck_cases: number
  }
  // Auto-pilot (placeholder por ahora)
  autopilot: {
    auto_contracts_this_month: number
    auto_whatsapp_sent_this_month: number
    auto_payments_collected_this_month: number
    enabled: boolean
  }
  // Meta
  generated_at: string
}

export async function GET(_req: NextRequest) {
  const service = await ensureAdmin()
  if (!service) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const todayStr = now.toISOString().slice(0, 10)
  const sevenDaysStr = new Date(now.getTime() + 7 * 86400_000).toISOString().slice(0, 10)
  const fourteenDaysAgoStr = new Date(now.getTime() - 14 * 86400_000).toISOString()

  // ── 1. KPIs principales ──────────────────────────────────────────
  const [
    clientsRes, contractsAllRes, contractsSignedRes,
    paymentsAllRes,
    activeCasesRes,
  ] = await Promise.all([
    service.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    service.from('contracts').select('id, status, total_price, signed_at, created_at, service_slug, client_full_name, client_id, signing_token'),
    service.from('contracts').select('*', { count: 'exact', head: true }).in('status', ['firmado', 'activo', 'completado']),
    service.from('payments').select('amount, status, due_date, paid_at'),
    service.from('cases').select('*', { count: 'exact', head: true }).in('intake_status', ['in_progress', 'submitted', 'under_review', 'needs_correction']),
  ])

  const allContracts = contractsAllRes.data || []
  const allPayments = paymentsAllRes.data || []

  const revenueCollected = allPayments
    .filter(p => p.status === 'completed')
    .reduce((s, p) => s + Number(p.amount), 0)

  const revenueThisMonth = allPayments
    .filter(p => p.status === 'completed' && p.paid_at && new Date(p.paid_at) >= monthStart)
    .reduce((s, p) => s + Number(p.amount), 0)

  const revenueLastMonth = allPayments
    .filter(p => p.status === 'completed' && p.paid_at &&
      new Date(p.paid_at) >= lastMonthStart && new Date(p.paid_at) < lastMonthEnd)
    .reduce((s, p) => s + Number(p.amount), 0)

  const revenueOverdue = allPayments
    .filter(p => p.status === 'pending' && p.due_date && p.due_date < todayStr)
    .reduce((s, p) => s + Number(p.amount), 0)

  // ── 2. Funnel ─────────────────────────────────────────────────────
  const [
    voiceCallsRes, prospectsTotalRes, prospectsContactedRes,
    prospectsAcceptaRes,
  ] = await Promise.all([
    service.from('voice_calls').select('*', { count: 'exact', head: true }),
    service.from('appointments').select('*', { count: 'exact', head: true }).eq('source', 'voice-agent'),
    service.from('appointments').select('*', { count: 'exact', head: true }).eq('source', 'voice-agent').in('call_status', ['en_curso', 'completada', 'no_procede']),
    service.from('appointments').select('*', { count: 'exact', head: true }).eq('source', 'voice-agent').eq('client_decision', 'acepta'),
  ])

  const contractsCount = allContracts.length
  const contractsPendingSignature = allContracts.filter(c => c.status === 'pendiente_firma').length
  const contractsSigned = allContracts.filter(c => ['firmado', 'activo', 'completado'].includes(c.status)).length

  const funnel: FunnelStage[] = [
    { key: 'ia', label: 'Llamadas IA', count: voiceCallsRes.count || 0, description: 'Total de prospectos que llamaron al voice agent' },
    { key: 'prospectos', label: 'Prospectos', count: prospectsTotalRes.count || 0, description: 'Prospectos agendaron llamada con consultora' },
    { key: 'contactados', label: 'Contactados', count: prospectsContactedRes.count || 0, description: 'Vanessa procesó la llamada' },
    { key: 'aceptaron', label: 'Aceptaron', count: prospectsAcceptaRes.count || 0, description: 'Cliente decidió iniciar el proceso' },
    { key: 'contratos', label: 'Contratos', count: contractsCount, description: 'Total de contratos creados (incluye borradores)' },
    { key: 'pendiente_firma', label: 'En firma', count: contractsPendingSignature, description: 'Esperando firma del cliente' },
    { key: 'firmados', label: 'Firmados', count: contractsSigned, description: 'Casos activos generando ingresos' },
  ]

  // ── 3. Servicios ──────────────────────────────────────────────────
  const { data: serviceCatalog } = await service
    .from('service_catalog')
    .select('id, slug, name')

  const services: ServiceBreakdown[] = (serviceCatalog || []).map(s => {
    const svcContracts = allContracts.filter(c => c.service_slug === s.slug)
    const signedRevenue = svcContracts
      .filter(c => ['firmado', 'activo', 'completado'].includes(c.status))
      .reduce((sum, c) => sum + Number(c.total_price || 0), 0)
    const uniqueClients = new Set(svcContracts.map(c => c.client_id).filter(Boolean)).size
    return {
      slug: s.slug,
      name: s.name,
      cases: 0, // se llena abajo
      contracts: svcContracts.length,
      revenue_signed: signedRevenue,
      unique_clients: uniqueClients,
    }
  })

  // Cases per service
  const { data: casesByService } = await service
    .from('cases')
    .select('service_id, service_catalog!inner(slug)')

  for (const row of (casesByService || [])) {
    const sv = row as unknown as { service_catalog: { slug: string } | { slug: string }[] }
    const slug = Array.isArray(sv.service_catalog) ? sv.service_catalog[0]?.slug : sv.service_catalog?.slug
    if (slug) {
      const svc = services.find(s => s.slug === slug)
      if (svc) svc.cases += 1
    }
  }

  // Ordenar por revenue_signed desc, luego contratos
  services.sort((a, b) => (b.revenue_signed - a.revenue_signed) || (b.contracts - a.contracts))

  // ── 4. Tendencia 6 meses ──────────────────────────────────────────
  const trend: MonthlyPoint[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1)

    const contractsCreated = allContracts.filter(c => {
      const ct = new Date(c.created_at)
      return ct >= d && ct < monthEnd
    }).length

    const contractsSignedInMonth = allContracts.filter(c => {
      if (!c.signed_at) return false
      const sd = new Date(c.signed_at)
      return sd >= d && sd < monthEnd
    }).length

    const revenueCollectedMonth = allPayments
      .filter(p => p.status === 'completed' && p.paid_at &&
        new Date(p.paid_at) >= d && new Date(p.paid_at) < monthEnd)
      .reduce((s, p) => s + Number(p.amount), 0)

    const revenueExpectedMonth = allPayments
      .filter(p => p.due_date && p.due_date >= key + '-01' && p.due_date < `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-01`)
      .reduce((s, p) => s + Number(p.amount), 0)

    trend.push({
      month: key,
      label: d.toLocaleDateString('es-US', { month: 'short', year: '2-digit' }).replace('.', ''),
      contracts_created: contractsCreated,
      contracts_signed: contractsSignedInMonth,
      revenue_collected: revenueCollectedMonth,
      revenue_expected: revenueExpectedMonth,
    })
  }

  // ── 5. Operaciones (lo que Andrium maneja hoy) ────────────────────
  const pendingSignature: OperationItem[] = allContracts
    .filter(c => c.status === 'pendiente_firma')
    .map(c => {
      const created = new Date(c.created_at)
      const days = Math.floor((Date.now() - created.getTime()) / 86400_000)
      return {
        id: c.id,
        client_name: c.client_full_name || 'Sin nombre',
        service_name: c.service_slug || '',
        total_price: Number(c.total_price || 0),
        status: c.status,
        created_at: c.created_at,
        days_waiting: days,
        has_signing_link: !!c.signing_token,
      }
    })
    .sort((a, b) => b.days_waiting - a.days_waiting)
    .slice(0, 10)

  const draftsOld: OperationItem[] = allContracts
    .filter(c => c.status === 'borrador' && new Date(c.created_at) < new Date(now.getTime() - 7 * 86400_000))
    .map(c => {
      const created = new Date(c.created_at)
      const days = Math.floor((Date.now() - created.getTime()) / 86400_000)
      return {
        id: c.id,
        client_name: c.client_full_name || 'Sin nombre',
        service_name: c.service_slug || '',
        total_price: Number(c.total_price || 0),
        status: c.status,
        created_at: c.created_at,
        days_waiting: days,
        has_signing_link: !!c.signing_token,
      }
    })
    .sort((a, b) => b.days_waiting - a.days_waiting)
    .slice(0, 10)

  // Cuotas vencidas agrupadas por cliente
  const { data: overduePayments } = await service
    .from('payments')
    .select('client_id, amount, due_date, client:profiles!payments_client_id_fkey(first_name, last_name, phone)')
    .eq('status', 'pending')
    .lt('due_date', todayStr)

  const overdueMap = new Map<string, OverdueClient>()
  for (const p of (overduePayments || [])) {
    const cid = p.client_id as string | null
    if (!cid) continue
    const cli = Array.isArray(p.client) ? p.client[0] : p.client
    const name = cli ? `${cli.first_name ?? ''} ${cli.last_name ?? ''}`.trim() : 'Sin nombre'
    const existing = overdueMap.get(cid)
    if (existing) {
      existing.total_overdue += Number(p.amount)
      existing.installments_overdue += 1
      if (p.due_date && p.due_date < existing.oldest_due_date) {
        existing.oldest_due_date = p.due_date
      }
    } else {
      overdueMap.set(cid, {
        client_id: cid,
        name,
        phone: cli?.phone ?? null,
        total_overdue: Number(p.amount),
        installments_overdue: 1,
        oldest_due_date: p.due_date as string,
      })
    }
  }
  const overdueClients = Array.from(overdueMap.values())
    .sort((a, b) => b.total_overdue - a.total_overdue)
    .slice(0, 8)

  const upcomingPayments = allPayments.filter(p =>
    p.status === 'pending' && p.due_date && p.due_date >= todayStr && p.due_date <= sevenDaysStr
  )
  const upcomingPaymentsAmount = upcomingPayments.reduce((s, p) => s + Number(p.amount), 0)

  const { count: stuckCasesCount } = await service
    .from('cases')
    .select('*', { count: 'exact', head: true })
    .lt('updated_at', fourteenDaysAgoStr)
    .in('intake_status', ['in_progress', 'submitted', 'needs_correction'])

  const data: CeoDashboardData = {
    kpi: {
      total_clients: clientsRes.count || 0,
      contracts_signed: contractsSignedRes.count || 0,
      revenue_total_collected: revenueCollected,
      revenue_this_month: revenueThisMonth,
      revenue_last_month: revenueLastMonth,
      revenue_overdue: revenueOverdue,
      active_cases: activeCasesRes.count || 0,
    },
    funnel,
    services,
    trend,
    ops: {
      pending_signature: pendingSignature,
      drafts_old: draftsOld,
      overdue_clients: overdueClients,
      upcoming_payments_7d_count: upcomingPayments.length,
      upcoming_payments_7d_amount: upcomingPaymentsAmount,
      stuck_cases: stuckCasesCount || 0,
    },
    autopilot: {
      auto_contracts_this_month: 0, // Fase 2
      auto_whatsapp_sent_this_month: 0, // Fase 3
      auto_payments_collected_this_month: 0, // Fase 3
      enabled: false,
    },
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(data)
}

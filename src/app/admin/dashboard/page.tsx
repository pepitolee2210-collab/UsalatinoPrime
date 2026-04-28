import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CeoDashboard } from './ceo-dashboard'
import type { CeoDashboardData } from '@/app/api/admin/ceo-dashboard/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/login')

  // Llamamos al endpoint server-side reusando las cookies actuales para
  // mantener consistencia con la sesión de Henry. Es la misma respuesta
  // que ve el endpoint público; dejamos toda la lógica de queries ahí.
  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const proto = headersList.get('x-forwarded-proto') ?? 'https'
  const cookie = headersList.get('cookie') ?? ''

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`

  const res = await fetch(`${baseUrl}/api/admin/ceo-dashboard`, {
    cache: 'no-store',
    headers: { cookie },
  })

  if (!res.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          No se pudo cargar el dashboard. Recarga la página o contacta al equipo técnico.
        </div>
      </div>
    )
  }

  const data = (await res.json()) as CeoDashboardData

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard ejecutivo</h1>
          <p className="text-sm text-gray-500">
            Vista global de UsaLatino Prime — clientes, contratos, ingresos y operaciones.
          </p>
        </div>
      </div>
      <CeoDashboard data={data} />
    </div>
  )
}

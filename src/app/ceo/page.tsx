import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CeoDashboard } from '@/app/admin/dashboard/ceo-dashboard'
import type { CeoDashboardData } from '@/app/api/admin/ceo-dashboard/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CeoPortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, first_name')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/login')

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
      <div className="rounded-2xl bg-white text-gray-900 p-8 shadow-2xl">
        <h1 className="text-xl font-bold mb-2">Dashboard ejecutivo</h1>
        <p className="text-sm text-red-700">
          No se pudo cargar el dashboard. Recarga la página o contacta al equipo técnico.
        </p>
      </div>
    )
  }

  const data = (await res.json()) as CeoDashboardData
  const greeting = profile?.first_name ? `Hola, ${profile.first_name}` : 'Hola, Henry'

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80 font-semibold">
            Centro de mando
          </p>
          <h1 className="text-3xl lg:text-4xl font-bold text-white mt-1">{greeting}</h1>
          <p className="text-sm text-white/70 mt-1">
            Vista global de UsaLatino Prime — clientes, contratos, ingresos y operaciones en tiempo real.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-white/50">Hoy</p>
          <p className="text-sm font-semibold text-white">
            {new Date().toLocaleDateString('es-US', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Contenedor blanco con todo el dashboard, así reusamos los estilos del CeoDashboard sin reescribirlos */}
      <div className="rounded-2xl bg-gray-50 text-gray-900 p-5 lg:p-6 shadow-2xl shadow-black/30 ring-1 ring-white/10">
        <CeoDashboard data={data} />
      </div>
    </div>
  )
}

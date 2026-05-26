import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { CeoDashboardV2 } from './_components/ceo-dashboard-v2'
import { getCeoDashboardData } from '@/lib/ceo-dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminCeoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, first_name')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/login')

  let data
  try {
    data = await getCeoDashboardData(createServiceClient())
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-8">
        <h1 className="font-display text-xl text-white mb-2">Vista CEO</h1>
        <p className="text-sm text-red-300">No se pudo cargar el dashboard.</p>
        <pre className="mt-3 text-[11px] text-white/60 bg-black/40 p-3 rounded overflow-x-auto">
          {msg}
        </pre>
      </div>
    )
  }

  const firstName = profile?.first_name?.trim() || 'Henry'

  // Neutralizamos el padding del shell admin (`p-6` en `<main>`) para que el
  // dashboard ejecutivo conserve EXACTAMENTE su layout original con su
  // propio max-width y paddings internos.
  return (
    <div className="-m-6" style={{ background: 'var(--admin-bg)', minHeight: 'calc(100vh - 0px)' }}>
      <CeoDashboardV2 data={data} firstName={firstName} />
    </div>
  )
}

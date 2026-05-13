import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { CeoDashboardV2 } from './ceo-dashboard-v2'
import { getCeoDashboardData } from '@/lib/ceo-dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CeoPortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/ceo/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, first_name')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/ceo/login')

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

  return <CeoDashboardV2 data={data} firstName={firstName} />
}

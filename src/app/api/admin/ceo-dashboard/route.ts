import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCeoDashboardData } from '@/lib/ceo-dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Re-export del tipo para componentes que aún hacen `import type` desde aquí
export type { CeoDashboardData } from '@/lib/ceo-dashboard-data'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const data = await getCeoDashboardData(createServiceClient())
  return NextResponse.json(data)
}

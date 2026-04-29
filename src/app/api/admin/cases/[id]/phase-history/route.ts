import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { CasePhase } from '@/types/database'

interface HistoryEntry {
  id: string
  from_phase: CasePhase | null
  to_phase: CasePhase
  changed_at: string
  reason: string | null
  changed_by_name: string | null
}

/**
 * GET /api/admin/cases/[id]/phase-history
 *
 * Devuelve el timeline completo de cambios de fase del caso, con autor
 * resuelto desde profiles. Ordenado del más reciente al más antiguo.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Auth (admin o employee)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'Solo staff' }, { status: 403 })
  }

  const { data: rows } = await service
    .from('case_phase_history')
    .select('id, from_phase, to_phase, changed_at, reason, changed_by, changed_by_profile:profiles!case_phase_history_changed_by_fkey(first_name, last_name)')
    .eq('case_id', id)
    .order('changed_at', { ascending: false })

  const history: HistoryEntry[] = (rows ?? []).map((r) => {
    const author = r.changed_by_profile as { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null
    const authorObj = Array.isArray(author) ? author[0] ?? null : author
    const authorName = authorObj
      ? `${authorObj.first_name ?? ''} ${authorObj.last_name ?? ''}`.trim()
      : null
    return {
      id: r.id,
      from_phase: r.from_phase as CasePhase | null,
      to_phase: r.to_phase as CasePhase,
      changed_at: r.changed_at,
      reason: r.reason,
      changed_by_name: authorName || null,
    }
  })

  return NextResponse.json({ history })
}

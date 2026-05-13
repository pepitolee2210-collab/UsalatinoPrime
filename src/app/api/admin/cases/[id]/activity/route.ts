// GET /api/admin/cases/[id]/activity
//
// Devuelve la bitácora del caso paginada con cursor. Sirve tanto a
// `/admin/*` como a `/employee/*` (auth-check acepta ambos roles).
//
// Cursor opaco: base64(`${createdAtIso}|${id}`). Devolvemos `nextCursor`
// solo si hay más resultados.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  CaseActivityCategory,
  CaseActivityActorRole,
} from '@/types/database'

interface ActivityItem {
  id: string
  case_id: string
  event_category: CaseActivityCategory | null
  event_subcategory: string | null
  action: string
  description: string
  metadata: Record<string, unknown>
  actor_id: string | null
  actor_role: CaseActivityActorRole | null
  actor_label: string | null
  visible_to_client: boolean
  created_at: string
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function decodeCursor(raw: string | null): { ts: string; id: string } | null {
  if (!raw) return null
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8')
    const sep = decoded.indexOf('|')
    if (sep === -1) return null
    return { ts: decoded.slice(0, sep), id: decoded.slice(sep + 1) }
  } catch {
    return null
  }
}

function encodeCursor(ts: string, id: string): string {
  return Buffer.from(`${ts}|${id}`, 'utf-8').toString('base64')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: caseId } = await params

  // Auth.
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

  // Query params.
  const sp = request.nextUrl.searchParams
  const categoryParam = sp.get('category')
  const categories = categoryParam ? categoryParam.split(',').filter(Boolean) : null
  const from = sp.get('from')
  const to = sp.get('to')
  const actorParam = sp.get('actor')
  const limitRaw = Number.parseInt(sp.get('limit') ?? '', 10)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(limitRaw, MAX_LIMIT)
    : DEFAULT_LIMIT
  const cursor = decodeCursor(sp.get('cursor'))

  // Build query.
  // El ORDER BY (created_at DESC, id DESC) + cursor `(ts, id) < (cursor.ts, cursor.id)`
  // garantiza paginación sin duplicados aunque haya inserts en tiempo real.
  let query = service
    .from('case_activity')
    .select(
      'id, case_id, event_category, event_subcategory, action, description, metadata, actor_id, actor_role, actor_label, visible_to_client, created_at',
    )
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (categories && categories.length > 0) {
    query = query.in('event_category', categories)
  }
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)
  if (actorParam) query = query.eq('actor_id', actorParam)

  if (cursor) {
    // Supabase no soporta tuple comparison directa; emulamos
    // (created_at, id) < (ts, id_c)  ≡
    //   created_at < ts  OR  (created_at = ts AND id < id_c)
    query = query.or(
      `created_at.lt.${cursor.ts},and(created_at.eq.${cursor.ts},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { error: 'Error al cargar la bitácora', details: error.message },
      { status: 500 },
    )
  }

  const rows = (data ?? []) as ActivityItem[]
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null

  return NextResponse.json({ items, nextCursor })
}

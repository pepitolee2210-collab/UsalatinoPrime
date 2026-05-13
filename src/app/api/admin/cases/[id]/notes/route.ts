// GET /api/admin/cases/[id]/notes
// POST /api/admin/cases/[id]/notes
//
// Sirve admin + employee (compartido). Notas append-only en case_notes.
// Patrón de auth y paginación copiado de activity/route.ts.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'
import type {
  CaseNoteCategory,
  CaseNoteAuthorRole,
} from '@/types/database'

interface NoteItem {
  id: string
  case_id: string
  appointment_id: string | null
  author_id: string | null
  author_role: CaseNoteAuthorRole
  author_label: string
  category: CaseNoteCategory
  body: string
  visible_to_client: boolean
  created_at: string
  updated_at: string
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const VALID_CATEGORIES: CaseNoteCategory[] = [
  'general',
  'session',
  'followup',
  'internal',
  'legacy',
]

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

  const sp = request.nextUrl.searchParams
  const categoryParam = sp.get('category')
  const categories = categoryParam ? categoryParam.split(',').filter(Boolean) : null
  const from = sp.get('from')
  const to = sp.get('to')
  const authorParam = sp.get('author')
  const appointmentParam = sp.get('appointment_id')
  const limitRaw = Number.parseInt(sp.get('limit') ?? '', 10)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(limitRaw, MAX_LIMIT)
    : DEFAULT_LIMIT
  const cursor = decodeCursor(sp.get('cursor'))

  let query = service
    .from('case_notes')
    .select(
      'id, case_id, appointment_id, author_id, author_role, author_label, category, body, visible_to_client, created_at, updated_at',
    )
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (categories && categories.length > 0) {
    query = query.in('category', categories)
  }
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)
  if (authorParam) query = query.eq('author_id', authorParam)
  if (appointmentParam) query = query.eq('appointment_id', appointmentParam)

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.ts},and(created_at.eq.${cursor.ts},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { error: 'Error al cargar las notas', details: error.message },
      { status: 500 },
    )
  }

  const rows = (data ?? []) as NoteItem[]
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null

  return NextResponse.json({ items, nextCursor })
}

interface CreateBody {
  body: string
  appointment_id?: string
  category?: CaseNoteCategory
  visible_to_client?: boolean
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: caseId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, first_name, last_name, employee_type')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'Solo staff' }, { status: 403 })
  }

  let payload: CreateBody
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const body = (payload.body ?? '').trim()
  if (!body || body.length > 8000) {
    return NextResponse.json({ error: 'El cuerpo debe tener entre 1 y 8000 caracteres' }, { status: 400 })
  }

  const category: CaseNoteCategory = VALID_CATEGORIES.includes(payload.category as CaseNoteCategory)
    ? (payload.category as CaseNoteCategory)
    : 'general'

  // Si appointment_id, verificar pertenezca al case
  if (payload.appointment_id) {
    const { data: appt } = await service
      .from('appointments')
      .select('id, case_id')
      .eq('id', payload.appointment_id)
      .maybeSingle()
    if (!appt || appt.case_id !== caseId) {
      return NextResponse.json(
        { error: 'La cita no pertenece a este caso' },
        { status: 400 },
      )
    }
  }

  const authorLabel = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || user.email || 'Staff'

  const insertRow = {
    case_id: caseId,
    appointment_id: payload.appointment_id ?? null,
    author_id: user.id,
    author_role: profile.role as CaseNoteAuthorRole,
    author_label: authorLabel,
    category,
    body,
    visible_to_client: payload.visible_to_client === true,
  }

  const { data: inserted, error } = await service
    .from('case_notes')
    .insert(insertRow)
    .select(
      'id, case_id, appointment_id, author_id, author_role, author_label, category, body, visible_to_client, created_at, updated_at',
    )
    .single()

  if (error || !inserted) {
    return NextResponse.json(
      { error: 'Error al crear la nota', details: error?.message },
      { status: 500 },
    )
  }

  await logActivity({
    caseId,
    category: 'communication',
    subcategory: SUBCATEGORIES.NOTE_CREATED,
    description: payload.appointment_id
      ? `${authorLabel} agregó una nota a una cita`
      : `${authorLabel} agregó una nota general al caso`,
    metadata: {
      note_id: inserted.id,
      appointment_id: payload.appointment_id ?? null,
      category,
    },
    visibleToClient: false,
    actor: { kind: 'session', supabase },
    client: service,
  })

  return NextResponse.json({ note: inserted }, { status: 201 })
}

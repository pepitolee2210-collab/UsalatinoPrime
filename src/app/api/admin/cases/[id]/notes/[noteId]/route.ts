// PATCH /api/admin/cases/[id]/notes/[noteId]
// DELETE /api/admin/cases/[id]/notes/[noteId]  (soft delete)
//
// Solo el autor o un admin pueden editar/eliminar. Llama a logActivity.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'
import type { CaseNoteCategory } from '@/types/database'

const VALID_CATEGORIES: CaseNoteCategory[] = [
  'general',
  'session',
  'followup',
  'internal',
  'legacy',
]

interface UpdateBody {
  body?: string
  category?: CaseNoteCategory
  visible_to_client?: boolean
}

async function loadAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, first_name, last_name')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') return null
  return { user, profile, supabase, service }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const { id: caseId, noteId } = await params

  const auth = await loadAuth()
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Cargar nota y verificar permisos
  const { data: note } = await auth.service
    .from('case_notes')
    .select('id, case_id, author_id, deleted_at')
    .eq('id', noteId)
    .single()
  if (!note || note.case_id !== caseId) {
    return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })
  }
  if (note.deleted_at) {
    return NextResponse.json({ error: 'Nota eliminada' }, { status: 410 })
  }
  const isAuthor = note.author_id === auth.user.id
  const isAdmin = auth.profile.role === 'admin'
  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: 'Solo el autor o un admin pueden editar' }, { status: 403 })
  }

  let payload: UpdateBody
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (payload.body !== undefined) {
    const trimmed = (payload.body ?? '').trim()
    if (!trimmed || trimmed.length > 8000) {
      return NextResponse.json({ error: 'El cuerpo debe tener entre 1 y 8000 caracteres' }, { status: 400 })
    }
    update.body = trimmed
  }
  if (payload.category !== undefined) {
    if (!VALID_CATEGORIES.includes(payload.category)) {
      return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
    }
    update.category = payload.category
  }
  if (payload.visible_to_client !== undefined) {
    update.visible_to_client = payload.visible_to_client === true
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })
  }

  const { data: updated, error } = await auth.service
    .from('case_notes')
    .update(update)
    .eq('id', noteId)
    .select(
      'id, case_id, appointment_id, author_id, author_role, author_label, category, body, visible_to_client, created_at, updated_at',
    )
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Error al actualizar', details: error?.message }, { status: 500 })
  }

  await logActivity({
    caseId,
    category: 'communication',
    subcategory: SUBCATEGORIES.NOTE_UPDATED,
    description: `Nota editada`,
    metadata: { note_id: noteId, fields: Object.keys(update) },
    visibleToClient: false,
    actor: { kind: 'session', supabase: auth.supabase },
    client: auth.service,
  })

  return NextResponse.json({ note: updated })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const { id: caseId, noteId } = await params

  const auth = await loadAuth()
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: note } = await auth.service
    .from('case_notes')
    .select('id, case_id, author_id, deleted_at')
    .eq('id', noteId)
    .single()
  if (!note || note.case_id !== caseId) {
    return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })
  }
  if (note.deleted_at) {
    return NextResponse.json({ ok: true }, { status: 200 }) // ya estaba borrada
  }
  const isAuthor = note.author_id === auth.user.id
  const isAdmin = auth.profile.role === 'admin'
  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: 'Solo el autor o un admin pueden eliminar' }, { status: 403 })
  }

  const { error } = await auth.service
    .from('case_notes')
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.user.id })
    .eq('id', noteId)

  if (error) {
    return NextResponse.json({ error: 'Error al eliminar', details: error.message }, { status: 500 })
  }

  await logActivity({
    caseId,
    category: 'communication',
    subcategory: SUBCATEGORIES.NOTE_DELETED,
    description: `Nota eliminada`,
    metadata: { note_id: noteId },
    visibleToClient: false,
    actor: { kind: 'session', supabase: auth.supabase },
    client: auth.service,
  })

  return NextResponse.json({ ok: true })
}

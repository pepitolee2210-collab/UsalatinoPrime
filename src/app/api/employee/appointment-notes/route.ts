// Shim de compatibilidad para clientes legacy ya desplegados.
//
// Antes: UPDATE appointments SET employee_notes = $1 (texto plano, sobrescribía)
// Ahora: INSERT INTO case_notes (...) — append-only, visible para todo staff.
//
// TODO 2026-05-27: borrar este shim una vez confirmado que no quedan
// llamadas en logs.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'
import type { CaseNoteAuthorRole } from '@/types/database'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, first_name, last_name')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'employee' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { appointment_id, employee_notes } = await request.json()
  if (!appointment_id) {
    return NextResponse.json({ error: 'appointment_id requerido' }, { status: 400 })
  }
  const body = (employee_notes ?? '').trim()
  if (!body) {
    // Vacío: nada que guardar. Mantener compat: respondemos OK silenciosamente.
    return NextResponse.json({ success: true, noop: true })
  }

  // Resolver case_id desde el appointment
  const { data: appt } = await service
    .from('appointments')
    .select('id, case_id')
    .eq('id', appointment_id)
    .single()
  if (!appt || !appt.case_id) {
    return NextResponse.json({ error: 'Cita no encontrada o sin caso' }, { status: 404 })
  }

  const authorLabel = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || user.email || 'Staff'
  const role = profile.role as CaseNoteAuthorRole

  const { data: inserted, error } = await service
    .from('case_notes')
    .insert({
      case_id: appt.case_id,
      appointment_id: appt.id,
      author_id: user.id,
      author_role: role,
      author_label: authorLabel,
      category: 'session',
      body,
      visible_to_client: false,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return NextResponse.json({ error: 'Error al guardar', details: error?.message }, { status: 500 })
  }

  await logActivity({
    caseId: appt.case_id,
    category: 'communication',
    subcategory: SUBCATEGORIES.NOTE_CREATED,
    description: `${authorLabel} agregó una nota a una cita`,
    metadata: { note_id: inserted.id, appointment_id: appt.id, category: 'session', via: 'legacy-shim' },
    visibleToClient: false,
    actor: { kind: 'session', supabase },
    client: service,
  })

  return NextResponse.json({ success: true, note_id: inserted.id })
}

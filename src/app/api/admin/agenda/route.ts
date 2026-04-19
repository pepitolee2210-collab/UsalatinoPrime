import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const VALID_STATUSES = ['pending', 'called', 'follow_up', 'converted', 'no_answer', 'not_interested', 'closed']

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return null
  return service
}

// Defensive cap: current agenda has <200 rows, 500 gives 5-10× runway.
// When this cap is hit we surface a truncated flag so the UI can warn Henry.
const MAX_AGENDA = 500

export async function GET() {
  try {
    const service = await verifyAdmin()
    if (!service) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { data, count, error } = await service
      .from('callback_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(MAX_AGENDA)

    if (error) {
      return NextResponse.json({ error: 'Error al obtener agenda' }, { status: 500 })
    }

    return NextResponse.json({
      items: data,
      total: count ?? (data?.length ?? 0),
      truncated: (count ?? 0) > (data?.length ?? 0),
    })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const service = await verifyAdmin()
    if (!service) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { prospect_name, phone, service_interest, notes, message_date, force_duplicate } = body

    if (!prospect_name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Nombre y telefono requeridos' }, { status: 400 })
    }

    // Check for existing record with same phone (skip if forced)
    if (!force_duplicate) {
    const cleanPhone = phone.trim().replace(/\D/g, '')
    const { data: existing } = await service
      .from('callback_requests')
      .select('id, prospect_name, status')
      .or(`phone.eq.${phone.trim()},phone.ilike.%${cleanPhone.slice(-10)}%`)
      .not('status', 'in', '("not_interested","closed")')
      .limit(1)

    if (existing && existing.length > 0) {
      const ex = existing[0]
      return NextResponse.json({
        error: `Este telefono ya esta registrado para "${ex.prospect_name}" (${ex.status})`,
        duplicate: true,
        existing_id: ex.id,
      }, { status: 409 })
    }
    }

    const { data, error } = await service
      .from('callback_requests')
      .insert({
        prospect_name: prospect_name.trim(),
        phone: phone.trim(),
        service_interest: service_interest?.trim() || null,
        notes: notes?.trim() || null,
        message_date: message_date || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Error al crear registro' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const service = await verifyAdmin()
    if (!service) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { id, status, notes, henry_notes, follow_up_date, scheduled_call } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Estado invalido' }, { status: 400 })
      }
      updateData.status = status
      if (status === 'called' || status === 'converted' || status === 'no_answer' || status === 'not_interested') {
        updateData.called_at = new Date().toISOString()
      }
    }

    if (notes !== undefined) updateData.notes = notes
    if (follow_up_date !== undefined) updateData.follow_up_date = follow_up_date
    if (scheduled_call !== undefined) updateData.scheduled_call = scheduled_call

    // henry_notes: append new entry to JSONB array
    if (henry_notes !== undefined) {
      const { data: current } = await service
        .from('callback_requests')
        .select('henry_notes')
        .eq('id', id)
        .single()

      const existing = Array.isArray(current?.henry_notes) ? current.henry_notes : []
      const newEntry = { text: henry_notes, date: new Date().toISOString() }
      updateData.henry_notes = [newEntry, ...existing]
    }

    const { error } = await service
      .from('callback_requests')
      .update(updateData)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Actualizado' })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const service = await verifyAdmin()
    if (!service) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const { error } = await service
      .from('callback_requests')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Eliminado' })
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET: Load saved story data (supports multi-minor)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return Response.json({ error: 'Token requerido' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return Response.json({ error: 'Token inválido' }, { status: 403 })
  }

  const { data: submissions } = await supabase
    .from('case_form_submissions')
    .select('form_type, form_data, status, admin_notes, updated_at, minor_index')
    .eq('case_id', tokenData.case_id)
    .in('form_type', [
      'client_story', 'client_witnesses', 'client_absent_parent', 'tutor_guardian',
      'i589_part_b1', 'i589_part_b2', 'i589_part_c1', 'i589_part_c2',
      'i360_sijs',
    ])
    .order('minor_index', { ascending: true })

  if (!submissions || submissions.length === 0) {
    return Response.json({})
  }

  // Check if any submission has minor_index > 0 (multi-minor format)
  const hasMultiMinor = submissions.some(s => (s.minor_index ?? 0) > 0)

  // Check if any submission has minor_info or children in form_data (new format indicators)
  const hasNewFormat = submissions.some(s =>
    s.form_type === 'client_story' &&
    s.form_data &&
    typeof s.form_data === 'object' &&
    ('minor_info' in (s.form_data as Record<string, unknown>) ||
     'children' in (s.form_data as Record<string, unknown>) ||
     'minorBasic' in (s.form_data as Record<string, unknown>))
  )

  if (hasMultiMinor || hasNewFormat) {
    // New multi-minor format: group by minor_index
    const minorMap = new Map<number, Record<string, unknown>>()

    for (const sub of submissions) {
      const idx = sub.minor_index ?? 0
      if (!minorMap.has(idx)) minorMap.set(idx, {})
      const entry = minorMap.get(idx)!

      const formData = sub.form_data as Record<string, unknown>
      if (sub.form_type === 'client_story') {
        const { minor_info, ...storyData } = formData
        entry.story = storyData
        entry.info = minor_info || {}
      } else if (sub.form_type === 'client_absent_parent') {
        entry.parent = formData
      } else if (sub.form_type === 'client_witnesses') {
        entry.witnesses = formData
      }
    }

    // Convert map to sorted array
    const sortedKeys = [...minorMap.keys()].sort((a, b) => a - b)
    const declarationsArr = sortedKeys.map(k => minorMap.get(k))

    // Also include flat statuses/notes for corrections banner
    const result: Record<string, unknown> = { declarations: declarationsArr }
    for (const sub of submissions) {
      const key = (sub.minor_index ?? 0) === 0
        ? sub.form_type
        : `${sub.form_type}_${sub.minor_index}`
      result[key] = {
        data: sub.form_data,
        status: sub.status,
        admin_notes: sub.admin_notes,
      }
    }

    return Response.json(result)
  }

  // Legacy single-minor format
  const result: Record<string, unknown> = {}
  for (const sub of submissions) {
    result[sub.form_type] = {
      data: sub.form_data,
      status: sub.status,
      admin_notes: sub.admin_notes,
    }
  }

  return Response.json(result)
}

// POST: Save/submit story data (supports minor_index)
export async function POST(request: NextRequest) {
  const { token, form_type, form_data, action, minor_index } = await request.json()

  if (!token || !form_type || !form_data) {
    return Response.json({ error: 'token, form_type y form_data requeridos' }, { status: 400 })
  }

  const validTypes = [
    'client_story', 'client_witnesses', 'client_absent_parent', 'tutor_guardian',
    'i589_part_b1', 'i589_part_b2', 'i589_part_c1', 'i589_part_c2',
    'i360_sijs',
  ]
  if (!validTypes.includes(form_type)) {
    return Response.json({ error: 'form_type inválido' }, { status: 400 })
  }

  const minorIdx = typeof minor_index === 'number' ? minor_index : 0

  const supabase = createServiceClient()

  const { data: tokenData } = await supabase
    .from('appointment_tokens')
    .select('case_id, client_id, is_active')
    .eq('token', token)
    .single()

  if (!tokenData?.is_active) {
    return Response.json({ error: 'Token inválido' }, { status: 403 })
  }

  const status = action === 'submit' ? 'submitted' : 'draft'

  const { error } = await supabase
    .from('case_form_submissions')
    .upsert({
      case_id: tokenData.case_id,
      client_id: tokenData.client_id,
      form_type,
      form_data,
      status,
      minor_index: minorIdx,
      submitted_at: action === 'submit' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'case_id,form_type,minor_index',
    })

  if (error) {
    console.error('Error saving form submission:', error)
    return Response.json({ error: 'Error al guardar' }, { status: 500 })
  }

  return Response.json({ success: true, status })
}

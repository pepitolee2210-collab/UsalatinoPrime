import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const { case_id, henry_reviewed, presented_to_court } = body

  if (!case_id) return NextResponse.json({ error: 'case_id requerido' }, { status: 400 })

  // Update pipeline_status JSON field on the case
  const { data: caseData } = await supabase
    .from('cases')
    .select('pipeline_status')
    .eq('id', case_id)
    .single()

  const currentStatus = (caseData?.pipeline_status || {}) as Record<string, boolean>
  const updated = { ...currentStatus }

  if (typeof henry_reviewed === 'boolean') updated.henry_reviewed = henry_reviewed
  if (typeof presented_to_court === 'boolean') updated.presented_to_court = presented_to_court

  const { error } = await supabase
    .from('cases')
    .update({ pipeline_status: updated })
    .eq('id', case_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, pipeline_status: updated })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Called by the front-end when a voice call ends (user hang-up, timeout, or
 * error). Records the final state in the voice_calls table so Henry can
 * audit conversation volume and outcomes.
 */
export async function POST(request: NextRequest) {
  try {
    const {
      call_id,
      duration_seconds,
      end_reason,
      error_message,
      lead_id,
      appointment_id,
      tools_invoked,
    } = await request.json()

    if (!call_id || typeof call_id !== 'string') {
      return NextResponse.json({ error: 'call_id required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const update: Record<string, unknown> = {
      ended_at: new Date().toISOString(),
    }
    if (typeof duration_seconds === 'number' && duration_seconds >= 0) {
      update.duration_seconds = Math.floor(duration_seconds)
    }
    if (end_reason) update.end_reason = String(end_reason).slice(0, 50)
    if (error_message) update.error_message = String(error_message).slice(0, 500)
    if (lead_id) update.lead_id = lead_id
    if (appointment_id) update.appointment_id = appointment_id
    if (Array.isArray(tools_invoked)) update.tools_invoked = tools_invoked

    await supabase.from('voice_calls').update(update).eq('id', call_id)

    return NextResponse.json({ success: true })
  } catch {
    // Logging-only endpoint — never block the user.
    return NextResponse.json({ success: false })
  }
}

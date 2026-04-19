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
      gate_stats,
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

    // We fold gate_stats into the existing tools_invoked JSONB column so we
    // don't need a migration. It shows up as a synthetic "tool" entry in the
    // admin panel's "Herramientas invocadas" list, which already renders
    // heterogeneous entries.
    const toolsArr = Array.isArray(tools_invoked) ? [...tools_invoked] : []
    if (gate_stats && typeof gate_stats === 'object') {
      const gs = gate_stats as Record<string, unknown>
      const openPct = typeof gs.open_pct === 'number' ? gs.open_pct : null
      const noiseFloor = typeof gs.noise_floor === 'number' ? gs.noise_floor : null
      const framesTotal = typeof gs.frames_total === 'number' ? gs.frames_total : null
      if (openPct != null || noiseFloor != null) {
        toolsArr.push({
          name: 'gate_stats',
          open_pct: openPct,
          noise_floor: noiseFloor,
          frames_total: framesTotal,
          at: Date.now(),
          ok: true,
        })
      }
    }
    if (toolsArr.length > 0) update.tools_invoked = toolsArr

    await supabase.from('voice_calls').update(update).eq('id', call_id)

    return NextResponse.json({ success: true })
  } catch {
    // Logging-only endpoint — never block the user.
    return NextResponse.json({ success: false })
  }
}

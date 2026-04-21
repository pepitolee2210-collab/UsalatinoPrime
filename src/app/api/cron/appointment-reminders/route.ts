import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/email/send'
import { sendWhatsapp } from '@/lib/twilio/client'
import { formatToMT, formatDateMT } from '@/lib/appointments/slots'
import { createLogger } from '@/lib/logger'

const log = createLogger('cron-reminders')

/**
 * Dispatches appointment reminders. Runs every 15 minutes from Vercel Cron.
 *
 * Channel routing depends on the `source` column of the appointment:
 *  - `whatsapp-chatbot`, `voice-agent`  → Twilio WhatsApp (guest_phone)
 *  - anything else with a client_id     → Resend email (client.email)
 *  - anything else without either       → skipped + logged
 *
 * Twilio WhatsApp note: outside the 24-hour session window we'd need a
 * pre-approved template. The 1h reminder always fits; the 24h reminder
 * fits only if the user chatted in the last 24h (almost always true for
 * bookings made via the chatbot that day).
 */

type ApptRow = {
  id: string
  scheduled_at: string
  client_id: string | null
  guest_phone: string | null
  guest_name: string | null
  source: string | null
  client: { first_name: string | null; email: string | null } | null
}

async function loadRemindersDueWithin(args: {
  kind: '1h' | '24h'
  fromIso: string
  toIso: string
}): Promise<ApptRow[]> {
  const supabase = createServiceClient()
  const requestedCol = args.kind === '1h' ? 'reminder_1h_requested' : 'reminder_24h_requested'
  const sentCol = args.kind === '1h' ? 'reminder_1h_sent' : 'reminder_24h_sent'
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, scheduled_at, client_id, guest_phone, guest_name, source, client:profiles(first_name, email)',
    )
    .eq('status', 'scheduled')
    .eq(requestedCol, true)
    .eq(sentCol, false)
    .gte('scheduled_at', args.fromIso)
    .lte('scheduled_at', args.toIso)
  if (error) {
    log.error(`load ${args.kind} reminders failed`, error)
    return []
  }
  return ((data ?? []) as unknown as Array<
    Omit<ApptRow, 'client'> & { client: ApptRow['client'] | ApptRow['client'][] | null }
  >).map(row => ({
    ...row,
    client: Array.isArray(row.client) ? (row.client[0] ?? null) : row.client,
  }))
}

function buildWhatsappReminder(name: string | null, scheduledAt: string, timeframe: '1 hora' | '24 horas'): string {
  const salutation = name ? `${name.split(/\s+/)[0]}, ` : ''
  const header =
    timeframe === '1 hora'
      ? `⏰ ${salutation}te recordamos que tu llamada con Henry Orellana es en *1 hora*.`
      : `📅 ${salutation}te recordamos que tu llamada con Henry Orellana es *mañana*.`
  return [
    header,
    '',
    `Fecha: *${formatDateMT(scheduledAt)}*`,
    `Hora: *${formatToMT(scheduledAt)} Mountain Time (Utah)*`,
    '',
    'Henry te llamará al número desde el que escribes. Si necesitas reagendar responde este mensaje.',
  ].join('\n')
}

async function dispatchReminder(
  apt: ApptRow,
  kind: '1h' | '24h',
): Promise<{ ok: boolean; channel: 'whatsapp' | 'email' | 'skipped'; reason?: string }> {
  const supabase = createServiceClient()
  const timeframeEs = kind === '1h' ? '1 hora' : '24 horas'

  // 1. WhatsApp channel for chatbot / voice-agent prospects.
  const isWhatsappLead =
    apt.source === 'whatsapp-chatbot' || apt.source === 'voice-agent' || apt.source === 'chatbot'
  if (isWhatsappLead && apt.guest_phone) {
    try {
      await sendWhatsapp({
        to: apt.guest_phone,
        body: buildWhatsappReminder(apt.guest_name, apt.scheduled_at, timeframeEs),
      })
      return { ok: true, channel: 'whatsapp' }
    } catch (err) {
      log.warn(`whatsapp reminder ${kind} failed for ${apt.id}`, err)
      // Fall through to email as a fallback if there's also a client_id.
    }
  }

  // 2. Email channel for registered clients.
  if (apt.client?.email) {
    const emailSent = await sendEmail({
      to: apt.client.email,
      subject:
        kind === '1h'
          ? 'Recordatorio: Su cita es en 1 hora'
          : 'Recordatorio: Su cita es mañana',
      html: buildReminderEmail(apt.client.first_name ?? '', apt.scheduled_at, timeframeEs),
    })
    if (emailSent) return { ok: true, channel: 'email' }
    return { ok: false, channel: 'email', reason: 'send failed' }
  }

  // 3. No channel available — log and move on so we don't spin forever.
  log.warn(`no channel for reminder ${kind}`, { id: apt.id, source: apt.source })
  await supabase
    .from('appointments')
    .update({
      // Mark as sent even though we couldn't — otherwise the cron retries
      // the same row every 15 min. Admin can resend manually if needed.
      [kind === '1h' ? 'reminder_1h_sent' : 'reminder_24h_sent']: true,
    })
    .eq('id', apt.id)
  return { ok: false, channel: 'skipped', reason: 'no phone or email' }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const results = { sent_wa_1h: 0, sent_email_1h: 0, sent_wa_24h: 0, sent_email_24h: 0, skipped: 0, failed: 0 }

  // 1h reminders: anything due in the next 75 min that hasn't been sent.
  // Window is slightly wider than 60 min so a cron running every 15 min
  // never misses an appointment that falls between tick boundaries.
  const in75min = new Date(now.getTime() + 75 * 60 * 1000)
  const reminders1h = await loadRemindersDueWithin({
    kind: '1h',
    fromIso: now.toISOString(),
    toIso: in75min.toISOString(),
  })

  for (const apt of reminders1h) {
    const result = await dispatchReminder(apt, '1h')
    if (result.ok) {
      await supabase
        .from('appointments')
        .update({ reminder_1h_sent: true })
        .eq('id', apt.id)
      if (result.channel === 'whatsapp') results.sent_wa_1h++
      else results.sent_email_1h++
    } else if (result.channel === 'skipped') {
      results.skipped++
    } else {
      results.failed++
    }
  }

  // 24h reminders: anything 23h45 to 25h away (wider window than default 1h).
  const in23h45 = new Date(now.getTime() + 23 * 60 * 60 * 1000 + 45 * 60 * 1000)
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000)
  const reminders24h = await loadRemindersDueWithin({
    kind: '24h',
    fromIso: in23h45.toISOString(),
    toIso: in25h.toISOString(),
  })

  for (const apt of reminders24h) {
    const result = await dispatchReminder(apt, '24h')
    if (result.ok) {
      await supabase
        .from('appointments')
        .update({ reminder_24h_sent: true })
        .eq('id', apt.id)
      if (result.channel === 'whatsapp') results.sent_wa_24h++
      else results.sent_email_24h++
    } else if (result.channel === 'skipped') {
      results.skipped++
    } else {
      results.failed++
    }
  }

  return NextResponse.json(results)
}

function buildReminderEmail(firstName: string, scheduledAt: string, timeframe: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #002855;">UsaLatinoPrime</h2>
      <p>Hola ${firstName},</p>
      <p>Le recordamos que tiene una cita programada en ${timeframe}:</p>
      <div style="background: #f0f4f8; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Fecha:</strong> ${formatDateMT(scheduledAt)}</p>
        <p style="margin: 4px 0;"><strong>Hora:</strong> ${formatToMT(scheduledAt)} (Hora Mountain / Utah)</p>
      </div>
      <p>Por favor, est&eacute; preparado/a y tenga sus documentos listos.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 14px;">
        UsaLatinoPrime — Tel&eacute;fono: 801-941-3479
      </p>
    </div>
  `
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/email/send'
import { sendWhatsapp } from '@/lib/twilio/client'
import {
  formatTime,
  formatDate,
  OFFICE_TIMEZONE,
  tzShortLabel,
} from '@/lib/timezones/format'
import { resolveClientTimezone } from '@/lib/appointments/resolve-tz'
import { createLogger } from '@/lib/logger'

const log = createLogger('cron-reminders')

/**
 * Dispatches appointment reminders.
 *
 * NOTE ON FREQUENCY: the Vercel Hobby plan only allows 1 cron job per day,
 * so this endpoint runs once at 08:00 UTC. That means the "1 hour before"
 * reminder only fires if a scheduled appointment happens to fall in the
 * 08:00–09:15 UTC window. The 24h reminder has slightly better coverage
 * because the window is wider. For full per-hour precision we'd need the
 * Vercel Pro plan (or an external scheduler). Because of this limitation
 * we do NOT tell the user in the bot that a reminder will arrive.
 *
 * Channel routing (when the cron does run):
 *  - `whatsapp-chatbot`, `voice-agent`, `chatbot` + guest_phone → Twilio WA
 *  - anything else with a client_id                            → Resend
 *  - anything else                                             → skipped
 *
 * Note on FK: after migration 024 `appointments` has two FKs to `profiles`
 * (`client_id` and `consultant_id`). The embed must be disambiguated with
 * `!appointments_client_id_fkey`, otherwise PostgREST returns a 400.
 *
 * TZ: la hora principal se muestra en la zona del cliente
 * (preferred_timezone → address_state → office). MT siempre aparece como
 * referencia debajo, para que llamadas a la oficina cuadren.
 */

type ApptRow = {
  id: string
  scheduled_at: string
  client_id: string | null
  guest_phone: string | null
  guest_name: string | null
  source: string | null
  client: {
    first_name: string | null
    email: string | null
    preferred_timezone: string | null
    address_state: string | null
  } | null
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
      'id, scheduled_at, client_id, guest_phone, guest_name, source, client:profiles!appointments_client_id_fkey(first_name, email, preferred_timezone, address_state)',
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

/**
 * Pull contract state si el profile no tiene preferred_timezone ni
 * address_state. Cache local por client_id para no consultarlo dos veces
 * en el mismo run (clientes con ambos reminders pendientes).
 */
const contractStateCache = new Map<string, string | null>()

async function lookupContractState(clientId: string | null): Promise<string | null> {
  if (!clientId) return null
  if (contractStateCache.has(clientId)) return contractStateCache.get(clientId) ?? null
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('contracts')
    .select('client_state')
    .eq('client_id', clientId)
    .not('client_state', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const state = data?.client_state ?? null
  contractStateCache.set(clientId, state)
  return state
}

async function resolveTzForReminder(apt: ApptRow): Promise<string> {
  // Guests sin profile (voice-agent, whatsapp-chatbot, chatbot) → MT.
  // Es lo más seguro porque no sabemos su estado; el bot puede después
  // hacer una sesión normal y el cliente nos da su zona.
  if (!apt.client) return OFFICE_TIMEZONE

  const contractState = apt.client.address_state
    ? null // si profile tiene state, no necesitamos el contrato
    : await lookupContractState(apt.client_id)

  return resolveClientTimezone({
    preferredTz: apt.client.preferred_timezone,
    contractState,
    profileState: apt.client.address_state,
    browserTz: null,
  }).tz
}

function buildWhatsappReminder(args: {
  name: string | null
  scheduledAt: string
  timeframe: '1 hora' | '24 horas'
  tz: string
}): string {
  const { name, scheduledAt, timeframe, tz } = args
  const salutation = name ? `${name.split(/\s+/)[0]}, ` : ''
  const header =
    timeframe === '1 hora'
      ? `⏰ ${salutation}te recordamos que tu llamada con Henry Orellana es en *1 hora*.`
      : `📅 ${salutation}te recordamos que tu llamada con Henry Orellana es *mañana*.`

  const tzLine = tz === OFFICE_TIMEZONE
    ? `Hora: *${formatTime(scheduledAt, OFFICE_TIMEZONE)} Mountain Time (Utah)*`
    : [
        `Hora: *${formatTime(scheduledAt, tz)} ${tzShortLabel(tz)}*`,
        `(equivale a ${formatTime(scheduledAt, OFFICE_TIMEZONE)} Mountain Time / Utah)`,
      ].join('\n')

  return [
    header,
    '',
    `Fecha: *${formatDate(scheduledAt, tz)}*`,
    tzLine,
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
  const tz = await resolveTzForReminder(apt)

  const isWhatsappLead =
    apt.source === 'whatsapp-chatbot' || apt.source === 'voice-agent' || apt.source === 'chatbot'
  if (isWhatsappLead && apt.guest_phone) {
    try {
      await sendWhatsapp({
        to: apt.guest_phone,
        body: buildWhatsappReminder({
          name: apt.guest_name,
          scheduledAt: apt.scheduled_at,
          timeframe: timeframeEs,
          tz,
        }),
      })
      return { ok: true, channel: 'whatsapp' }
    } catch (err) {
      log.warn(`whatsapp reminder ${kind} failed for ${apt.id}`, err)
    }
  }

  if (apt.client?.email) {
    const emailSent = await sendEmail({
      to: apt.client.email,
      subject:
        kind === '1h'
          ? 'Recordatorio: Su cita es en 1 hora'
          : 'Recordatorio: Su cita es mañana',
      html: buildReminderEmail({
        firstName: apt.client.first_name ?? '',
        scheduledAt: apt.scheduled_at,
        timeframe: timeframeEs,
        tz,
      }),
    })
    if (emailSent) return { ok: true, channel: 'email' }
    return { ok: false, channel: 'email', reason: 'send failed' }
  }

  log.warn(`no channel for reminder ${kind}`, { id: apt.id, source: apt.source })
  await supabase
    .from('appointments')
    .update({
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

  contractStateCache.clear()
  const supabase = createServiceClient()
  const now = new Date()
  const results = { sent_wa_1h: 0, sent_email_1h: 0, sent_wa_24h: 0, sent_email_24h: 0, skipped: 0, failed: 0 }

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

function buildReminderEmail(args: {
  firstName: string
  scheduledAt: string
  timeframe: string
  tz: string
}): string {
  const { firstName, scheduledAt, timeframe, tz } = args
  const dateLine = formatDate(scheduledAt, tz)
  const localTime = formatTime(scheduledAt, tz)
  const officeTime = formatTime(scheduledAt, OFFICE_TIMEZONE)
  const tzLabel = tzShortLabel(tz)
  const showOffice = tz !== OFFICE_TIMEZONE

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #002855;">UsaLatinoPrime</h2>
      <p>Hola ${firstName},</p>
      <p>Le recordamos que tiene una cita programada en ${timeframe}:</p>
      <div style="background: #f0f4f8; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Fecha:</strong> ${dateLine}</p>
        <p style="margin: 4px 0;"><strong>Hora:</strong> ${localTime} ${tzLabel}${showOffice ? '' : ' (Mountain Time / Utah)'}</p>
        ${showOffice ? `<p style="margin: 4px 0; color: #6b7280; font-size: 13px;">Equivale a <strong>${officeTime}</strong> Mountain Time (Utah).</p>` : ''}
      </div>
      <p>Por favor, est&eacute; preparado/a y tenga sus documentos listos.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 14px;">
        UsaLatinoPrime — Tel&eacute;fono: 801-941-3479
      </p>
    </div>
  `
}

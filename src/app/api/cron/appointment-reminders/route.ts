import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/email/send'
import { formatToMT, formatDateMT } from '@/lib/appointments/slots'

export async function GET(request: NextRequest) {
  // Verificar auth del cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()

  // Ventana de 1 hora: citas en la próxima hora que pidieron recordatorio y no se ha enviado
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

  const { data: reminders1h } = await supabase
    .from('appointments')
    .select('id, scheduled_at, client_id, client:profiles!appointments_client_id_fkey(first_name, email)')
    .eq('status', 'scheduled')
    .eq('reminder_1h_requested', true)
    .eq('reminder_1h_sent', false)
    .lte('scheduled_at', oneHourFromNow.toISOString())
    .gte('scheduled_at', now.toISOString())

  // Ventana de 24 horas: citas en las próximas 24-25 horas que pidieron recordatorio y no se ha enviado
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  const { data: reminders24h } = await supabase
    .from('appointments')
    .select('id, scheduled_at, client_id, client:profiles!appointments_client_id_fkey(first_name, email)')
    .eq('status', 'scheduled')
    .eq('reminder_24h_requested', true)
    .eq('reminder_24h_sent', false)
    .lte('scheduled_at', twentyFiveHoursFromNow.toISOString())
    .gte('scheduled_at', twentyFourHoursFromNow.toISOString())

  let sent = 0

  // Enviar recordatorios de 1 hora
  for (const apt of reminders1h || []) {
    const clientRaw = apt.client as unknown
    const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw
    if (!client?.email) continue

    const emailSent = await sendEmail({
      to: client.email,
      subject: 'Recordatorio: Su cita es en 1 hora',
      html: buildReminderEmail(client.first_name, apt.scheduled_at, '1 hora'),
    })

    if (emailSent) {
      await supabase
        .from('appointments')
        .update({ reminder_1h_sent: true })
        .eq('id', apt.id)
      sent++
    }
  }

  // Enviar recordatorios de 24 horas
  for (const apt of reminders24h || []) {
    const clientRaw = apt.client as unknown
    const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw
    if (!client?.email) continue

    const emailSent = await sendEmail({
      to: client.email,
      subject: 'Recordatorio: Su cita es mañana',
      html: buildReminderEmail(client.first_name, apt.scheduled_at, '24 horas'),
    })

    if (emailSent) {
      await supabase
        .from('appointments')
        .update({ reminder_24h_sent: true })
        .eq('id', apt.id)
      sent++
    }
  }

  return NextResponse.json({ sent })
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

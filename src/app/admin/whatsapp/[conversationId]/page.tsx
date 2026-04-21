import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Phone, MessageCircle, Calendar, User, MapPin } from 'lucide-react'
import { formatDateMT, formatToMT } from '@/lib/appointments/slots'
import { stateName } from '@/lib/timezones/us-states'
import {
  appointmentStatusLabel,
  APPOINTMENT_STATUS_BADGE_STYLE,
} from '@/lib/appointments/status-labels'

export const dynamic = 'force-dynamic'

const VERDICT_LABEL: Record<string, string> = {
  eligible: '✅ Elegible',
  not_eligible: '❌ No elegible',
  requires_review: '⚠️ Requiere revisión',
}

function yesNo(v: boolean | null | undefined): string {
  if (v === true) return 'Sí'
  if (v === false) return 'No'
  return '—'
}

export default async function WhatsappConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const supabase = await createClient()

  const { data: conversation } = await supabase
    .from('whatsapp_conversations')
    .select(`
      id,
      status,
      current_step,
      created_at,
      last_message_at,
      total_messages,
      appointment_id,
      closed_reason,
      contact:whatsapp_contacts(*)
    `)
    .eq('id', conversationId)
    .single()

  if (!conversation) notFound()

  const [{ data: messages }, { data: intakeRows }, appointmentRes] = await Promise.all([
    supabase
      .from('whatsapp_messages')
      .select('id, role, direction, body, media_urls, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
    supabase
      .from('sijs_intakes')
      .select('*')
      .eq('conversation_id', conversationId)
      .limit(1),
    conversation.appointment_id
      ? supabase
          .from('appointments')
          .select('id, scheduled_at, status, notes, source, guest_name, guest_phone')
          .eq('id', conversation.appointment_id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const intake = intakeRows?.[0]
  const appointment = appointmentRes.data
  const contact = (conversation.contact as unknown) as {
    phone_e164: string
    display_name: string | null
    wa_profile_name: string | null
    state_us: string | null
    opted_out: boolean
    language: string | null
  } | null

  const name = contact?.display_name ?? contact?.wa_profile_name ?? 'Sin nombre'

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/admin/whatsapp"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a conversaciones
      </Link>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Contacto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" /> Contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>
              <div className="text-muted-foreground">Nombre</div>
              <div className="font-medium">{name}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Teléfono</div>
              <a
                href={`tel:${contact?.phone_e164 ?? ''}`}
                className="font-mono text-blue-600 hover:underline flex items-center gap-1"
              >
                <Phone className="w-3 h-3" />
                {contact?.phone_e164 ?? '—'}
              </a>
            </div>
            {contact?.state_us && (
              <div>
                <div className="text-muted-foreground">Estado</div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {stateName(contact.state_us)}
                </div>
              </div>
            )}
            {contact?.opted_out && (
              <Badge variant="outline" className="text-red-600 border-red-200">
                Opt-out
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Intake */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Respuestas del filtro</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vive en EEUU</span>
              <span>{yesNo(intake?.lives_in_usa)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Edad</span>
              <span>{intake?.age ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado</span>
              <span>{stateName(intake?.state_us)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Abuso/neg/aband</span>
              <span>{yesNo(intake?.suffered_abuse)}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="text-muted-foreground">Verdict</div>
              <div className="font-medium">
                {intake?.eligibility_verdict
                  ? VERDICT_LABEL[intake.eligibility_verdict]
                  : '—'}
              </div>
              {intake?.state_age_limit && (
                <div className="text-xs text-muted-foreground mt-1">
                  Edad límite en su estado: {intake.state_age_limit}
                </div>
              )}
              {intake?.verdict_reasoning && (
                <div className="text-xs text-muted-foreground mt-1 italic">
                  {intake.verdict_reasoning}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cita */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Cita agendada
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {appointment ? (
              <div className="space-y-2">
                <div>
                  <div className="text-muted-foreground">Fecha (Mountain Time)</div>
                  <div className="font-medium">
                    {formatDateMT(appointment.scheduled_at)}
                  </div>
                  <div>{formatToMT(appointment.scheduled_at)} MT</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Estado</div>
                  <Badge className={APPOINTMENT_STATUS_BADGE_STYLE[appointment.status] ?? ''}>
                    {appointmentStatusLabel(appointment.status)}
                  </Badge>
                </div>
                {appointment.notes && (
                  <div>
                    <div className="text-muted-foreground">Notas</div>
                    <div className="text-xs">{appointment.notes}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground italic">Sin cita agendada</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mensajes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Transcripción ({messages?.length ?? 0} mensajes)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {(messages ?? []).map(m => (
              <div
                key={m.id}
                className={
                  'flex ' +
                  (m.direction === 'inbound' ? 'justify-start' : 'justify-end')
                }
              >
                <div
                  className={
                    'max-w-[70%] rounded-lg px-3 py-2 text-sm ' +
                    (m.direction === 'inbound'
                      ? 'bg-slate-100 text-slate-800'
                      : m.role === 'admin'
                        ? 'bg-blue-500 text-white'
                        : 'bg-green-500 text-white')
                  }
                >
                  <div className="whitespace-pre-wrap">{m.body ?? ''}</div>
                  {Array.isArray(m.media_urls) && m.media_urls.length > 0 && (
                    <div className="mt-1 text-xs opacity-80">
                      📎 {m.media_urls.length} archivo(s) adjunto(s)
                    </div>
                  )}
                  <div className="text-[10px] opacity-60 mt-1 text-right">
                    {new Date(m.created_at).toLocaleString('es-US', {
                      timeZone: 'America/Denver',
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageCircle, Phone, User, Clock, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800',
  filtered_in: 'bg-green-100 text-green-800',
  filtered_out: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-gray-100 text-gray-600',
  abandoned: 'bg-amber-100 text-amber-800',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  filtered_in: 'Califica',
  filtered_out: 'No califica',
  scheduled: 'Agendada',
  closed: 'Cerrada',
  abandoned: 'Abandonada',
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

export default async function WhatsappListPage() {
  const supabase = await createClient()

  const { data: conversations } = await supabase
    .from('whatsapp_conversations')
    .select(`
      id,
      status,
      current_step,
      last_message_at,
      total_messages,
      appointment_id,
      contact:whatsapp_contacts(phone_e164, display_name, wa_profile_name, state_us),
      intake:sijs_intakes(eligibility_verdict, age, state_us, suffered_abuse)
    `)
    .order('last_message_at', { ascending: false })
    .limit(100)

  const list = ((conversations ?? []) as unknown) as Array<{
    id: string
    status: string
    current_step: string
    last_message_at: string
    total_messages: number
    appointment_id: string | null
    contact: {
      phone_e164: string
      display_name: string | null
      wa_profile_name: string | null
      state_us: string | null
    } | null
    intake: Array<{
      eligibility_verdict: string | null
      age: number | null
      state_us: string | null
      suffered_abuse: boolean | null
    }> | null
  }>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-600" />
            Conversaciones WhatsApp SIJS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prospectos que escribieron por WhatsApp, el verdict del filtro y el estado de agendamiento.
          </p>
        </div>
        <Link
          href="/admin/whatsapp/citas"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          <Calendar className="w-4 h-4" /> Ver calendario de evaluaciones
        </Link>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Todavía no hay conversaciones. Cuando un usuario escriba al número de WhatsApp aparecerán aquí.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map(conv => {
            const intake = conv.intake?.[0]
            const name = conv.contact?.display_name ?? conv.contact?.wa_profile_name ?? 'Sin nombre'
            const phone = conv.contact?.phone_e164 ?? ''
            const stateUs = intake?.state_us ?? conv.contact?.state_us
            const verdict = intake?.eligibility_verdict
            return (
              <Link
                key={conv.id}
                href={`/admin/whatsapp/${conv.id}`}
                className="block"
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-green-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{name}</span>
                        {stateUs && (
                          <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                            {stateUs}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatTimeAgo(conv.last_message_at)}
                        </span>
                        <span>{conv.total_messages} msg</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <Badge className={STATUS_STYLES[conv.status] ?? ''}>
                        {STATUS_LABELS[conv.status] ?? conv.status}
                      </Badge>
                      {verdict && (
                        <span className="text-xs text-muted-foreground">
                          {verdict === 'eligible' ? '✅ Elegible'
                            : verdict === 'not_eligible' ? '❌ No elegible'
                            : '⚠️ Requiere revisión'}
                        </span>
                      )}
                      {conv.appointment_id && (
                        <span className="text-xs text-emerald-700 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Agendada
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

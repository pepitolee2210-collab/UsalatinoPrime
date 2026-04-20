import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Calendar, Phone, User } from 'lucide-react'
import { formatDateMT, formatToMT } from '@/lib/appointments/slots'

export const dynamic = 'force-dynamic'

function groupByDate<T extends { scheduled_at: string }>(appointments: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const a of appointments) {
    const dateKey = formatDateMT(a.scheduled_at)
    const arr = map.get(dateKey) ?? []
    arr.push(a)
    map.set(dateKey, arr)
  }
  return map
}

export default async function WhatsappCitasPage() {
  const supabase = await createClient()

  const todayIso = new Date().toISOString()
  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id,
      scheduled_at,
      status,
      guest_name,
      guest_phone,
      notes,
      source,
      whatsapp_conv:whatsapp_conversations(id, contact_id)
    `)
    .eq('source', 'whatsapp-chatbot')
    .gte('scheduled_at', todayIso)
    .order('scheduled_at', { ascending: true })
    .limit(100)

  type Appt = {
    id: string
    scheduled_at: string
    status: string
    guest_name: string | null
    guest_phone: string | null
    notes: string | null
    source: string | null
    whatsapp_conv: Array<{ id: string; contact_id: string }> | null
  }
  const list = (appointments ?? []) as Appt[]
  const grouped = groupByDate(list)

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/admin/whatsapp"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a conversaciones
      </Link>

      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Evaluaciones gratuitas agendadas (WhatsApp)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Citas creadas desde el chatbot de WhatsApp, ordenadas cronológicamente.
          No chocan entre sí gracias al índice único en la tabla de citas.
        </p>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No hay evaluaciones gratuitas programadas en el futuro.
          </CardContent>
        </Card>
      ) : (
        Array.from(grouped.entries()).map(([date, appts]) => (
          <Card key={date}>
            <CardHeader>
              <CardTitle className="text-base capitalize">{date}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {appts.map(a => {
                  const conv = a.whatsapp_conv?.[0]
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-4 p-3 rounded border hover:bg-slate-50"
                    >
                      <div className="text-sm font-mono min-w-[80px]">
                        {formatToMT(a.scheduled_at)} MT
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{a.guest_name ?? 'Sin nombre'}</span>
                        </div>
                        {a.guest_phone && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            <a href={`tel:${a.guest_phone}`} className="hover:underline">
                              {a.guest_phone}
                            </a>
                          </div>
                        )}
                        {a.notes && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {a.notes}
                          </div>
                        )}
                      </div>
                      <Badge
                        className={
                          a.status === 'scheduled'
                            ? 'bg-emerald-100 text-emerald-800'
                            : a.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : ''
                        }
                      >
                        {a.status}
                      </Badge>
                      {conv && (
                        <Link
                          href={`/admin/whatsapp/${conv.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ver chat
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

import { Type } from '@google/genai'
import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'
import { evaluateEligibility } from '@/lib/chatbot/sijs-eligibility'
import { normalizeStateCode, tzForState, stateName } from '@/lib/timezones/us-states'
import {
  listProspectDatesWithSlots,
  listProspectSlotsForDate,
  bookProspectAppointment,
} from '@/lib/appointments/prospect-booking'
import { formatDateMT, formatToMT } from '@/lib/appointments/slots'
import { sendPushToAdmins } from '@/lib/notifications/push'
import {
  upsertSijsIntake,
  updateConversation,
  markContactOptedOut,
  type ConversationRow,
  type ContactRow,
} from '@/lib/chatbot/sijs-session'

const log = createLogger('sijs-wa-tools')

/**
 * Gemini tool declarations for the WhatsApp SIJS chatbot.
 *
 * The AI decides when to call each one based on the system prompt. The
 * worker dispatches the call to the matching handler and feeds the result
 * back via `functionResponse`.
 *
 * Design principles:
 *   - Tools are **idempotent** where possible (saving the same answer twice
 *     is fine).
 *   - Side effects that matter (booking, push, opt-out) are validated here
 *     so a hallucinating model can't skip required preconditions.
 *   - Results include both MT office time and client-local time so the AI
 *     can narrate the slot naturally in either.
 */

export const SIJS_WA_TOOLS = [
  {
    name: 'save_filter_answer',
    description:
      'Guarda una respuesta normalizada del filtro SIJS. Llamar después de cada una de las 4 preguntas (lives_in_usa, age, state_us, suffered_abuse) una vez interpretada la respuesta del usuario.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        question_id: {
          type: Type.STRING,
          description:
            'Una de: lives_in_usa, age, state_us, suffered_abuse, full_name.',
        },
        answer: {
          type: Type.STRING,
          description:
            'Valor normalizado. Para lives_in_usa/suffered_abuse: "yes"/"no"/"unknown". Para age: número como string. Para state_us: código de 2 letras (ej. "TX"). Para full_name: nombre completo.',
        },
      },
      required: ['question_id', 'answer'],
    },
  },
  {
    name: 'evaluate_eligibility',
    description:
      'Calcula el verdict del filtro SIJS usando las respuestas guardadas hasta ahora. Llamar solo cuando las 4 preguntas (lives_in_usa, age, state_us, suffered_abuse) tengan respuesta. Devuelve eligible | not_eligible | requires_review con las razones.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'list_available_dates',
    description:
      'Devuelve los próximos días (hasta 14) que tienen al menos un horario disponible. Útil cuando el usuario pregunta "¿qué días tienes disponibles?" sin señalar uno concreto.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        look_ahead_days: {
          type: Type.NUMBER,
          description: 'Cuántos días hacia adelante buscar. Default 14.',
        },
      },
    },
  },
  {
    name: 'list_slots_for_date',
    description:
      'Devuelve los horarios disponibles de una fecha específica, ya convertidos a hora del estado del menor. Úsalo cuando el usuario elija un día ("el jueves", "mañana", "el 25").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: {
          type: Type.STRING,
          description: 'Fecha en formato YYYY-MM-DD (ej. "2026-04-22").',
        },
        client_state: {
          type: Type.STRING,
          description:
            'Código de 2 letras del estado del menor (ej. "CA"). Si no se conoce, dejar vacío y usará hora oficina (Utah).',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'book_appointment',
    description:
      'Agenda la cita de evaluación gratuita con Henry. El usuario DEBE haber dado su nombre completo (≥ 2 palabras) antes de llamar este tool; si no, primero pídele el nombre. scheduled_at_iso debe ser un ISO UTC EXACTO devuelto por list_slots_for_date.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        scheduled_at_iso: {
          type: Type.STRING,
          description: 'ISO UTC timestamp exacto del slot elegido.',
        },
        full_name: {
          type: Type.STRING,
          description: 'Nombre completo del cliente (≥ 2 palabras).',
        },
      },
      required: ['scheduled_at_iso', 'full_name'],
    },
  },
  {
    name: 'lookup_my_appointment',
    description:
      'Busca si el contacto actual ya tiene una cita futura agendada. Útil si el usuario pregunta "¿a qué hora es mi cita?".',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'request_call_now',
    description:
      'Registra que el usuario quiere una llamada inmediata. Envía push al admin con prioridad alta. Úsalo cuando el usuario diga "ahora" / "ya" / "inmediato" al preguntarle cuándo agendar.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'opt_out',
    description:
      'Cierra la conversación marcando opt-out. Solo usarlo si el usuario pide explícitamente no recibir más mensajes (además del bloqueo automático por palabras clave "stop", "baja").',
    parameters: { type: Type.OBJECT, properties: {} },
  },
]

// --------------------------------------------------------------------
// Dispatcher
// --------------------------------------------------------------------

export interface ToolContext {
  conversation: ConversationRow
  contact: ContactRow
  /** Phone in E.164 format, used when booking or pushing. */
  phoneE164: string
  /** ProfileName from WhatsApp, if any — fallback until user provides full name. */
  waProfileName: string | null
  /** Collected filter answers so far (merged across turns). */
  collected: Record<string, unknown>
}

export async function dispatchSijsTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ result: Record<string, unknown>; patch?: Record<string, unknown>; terminal?: boolean }> {
  try {
    switch (name) {
      case 'save_filter_answer':
        return await handleSaveFilterAnswer(args, ctx)
      case 'evaluate_eligibility':
        return await handleEvaluateEligibility(ctx)
      case 'list_available_dates':
        return await handleListDates(args)
      case 'list_slots_for_date':
        return await handleListSlots(args, ctx)
      case 'book_appointment':
        return await handleBook(args, ctx)
      case 'lookup_my_appointment':
        return await handleLookup(ctx)
      case 'request_call_now':
        return await handleCallNow(ctx)
      case 'opt_out':
        return await handleOptOut(ctx)
      default:
        return { result: { error: `Unknown tool: ${name}` } }
    }
  } catch (err) {
    log.error(`tool ${name} failed`, err)
    return { result: { error: 'Tool execution failed. Disculpa al usuario y ofrece llamar al 801-941-3479.' } }
  }
}

// --------------------------------------------------------------------
// Handlers
// --------------------------------------------------------------------

async function handleSaveFilterAnswer(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ result: Record<string, unknown>; patch: Record<string, unknown> }> {
  const qid = String(args.question_id ?? '').trim()
  const raw = String(args.answer ?? '').trim()
  const patch: Record<string, unknown> = {}

  if (qid === 'lives_in_usa') {
    patch.lives_in_usa = /^y|yes|s[íi]|true|1$/i.test(raw)
      ? true
      : /^n|no|false|0$/i.test(raw)
        ? false
        : null
  } else if (qid === 'age') {
    const n = parseInt(raw, 10)
    patch.age = isFinite(n) && n > 0 && n < 100 ? n : null
  } else if (qid === 'state_us') {
    patch.state_us = normalizeStateCode(raw) ?? null
  } else if (qid === 'suffered_abuse') {
    patch.suffered_abuse = /^y|yes|s[íi]|true|1$/i.test(raw)
      ? true
      : /^n|no|false|0$/i.test(raw)
        ? false
        : null
  } else if (qid === 'full_name') {
    const words = raw.split(/\s+/).filter(w => w.length > 0)
    patch.contact_full_name = words.length >= 2 ? raw.slice(0, 120) : null
  } else {
    return { result: { error: `Unknown question_id: ${qid}` }, patch: {} }
  }

  // Persist intake row (upsert).
  const mergedCollected = { ...ctx.collected, ...patch }
  await upsertSijsIntake({
    conversationId: ctx.conversation.id,
    contactId: ctx.contact.id,
    collectedData: mergedCollected as Parameters<typeof upsertSijsIntake>[0]['collectedData'],
    aiModel: 'gemini-whatsapp',
  })

  return {
    result: {
      saved: true,
      question_id: qid,
      value: patch[Object.keys(patch)[0]],
      all_answered:
        mergedCollected.lives_in_usa !== undefined &&
        mergedCollected.age !== undefined &&
        mergedCollected.state_us !== undefined &&
        mergedCollected.suffered_abuse !== undefined,
    },
    patch,
  }
}

async function handleEvaluateEligibility(ctx: ToolContext) {
  const verdict = evaluateEligibility({
    lives_in_usa: (ctx.collected.lives_in_usa as boolean) ?? null,
    age: (ctx.collected.age as number) ?? null,
    state_us: (ctx.collected.state_us as string) ?? null,
    suffered_abuse: (ctx.collected.suffered_abuse as boolean) ?? null,
  })
  await upsertSijsIntake({
    conversationId: ctx.conversation.id,
    contactId: ctx.contact.id,
    collectedData: ctx.collected as Parameters<typeof upsertSijsIntake>[0]['collectedData'],
    verdict: verdict.verdict,
    verdictReasoning: verdict.reasons.join(' '),
    stateAgeLimit: verdict.state_age_limit,
    aiModel: 'gemini-whatsapp',
  })
  await updateConversation({
    conversationId: ctx.conversation.id,
    currentStep: verdict.verdict === 'eligible'
      ? 'ELIGIBLE'
      : verdict.verdict === 'not_eligible' ? 'INELIGIBLE' : 'REQUIRES_REVIEW',
    status: verdict.verdict === 'not_eligible' ? 'filtered_out' : 'filtered_in',
  })
  return { result: { ...verdict }, patch: { verdict: verdict.verdict } }
}

async function handleListDates(args: Record<string, unknown>) {
  const look = Math.min(Math.max(Number(args.look_ahead_days ?? 14), 1), 30)
  const dates = await listProspectDatesWithSlots({ lookAheadDays: look })
  return {
    result: {
      dates: dates.map(d => ({
        date: d.date,
        day: d.dayLabel,
        slots_available: d.slotCount,
      })),
      note: dates.length === 0 ? 'No hay fechas disponibles en los próximos días.' : undefined,
    },
  }
}

async function handleListSlots(args: Record<string, unknown>, ctx: ToolContext) {
  const date = String(args.date ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { result: { error: 'date debe ser YYYY-MM-DD' } }
  }
  const clientStateRaw = (args.client_state as string) ?? (ctx.collected.state_us as string) ?? ''
  const clientState = normalizeStateCode(clientStateRaw)
  const clientTz = clientState ? tzForState(clientState) : 'America/Denver'
  const clientTzLabel = clientTz.split('/').pop()!.replace('_', ' ')

  const slots = await listProspectSlotsForDate(date)
  return {
    result: {
      date,
      client_state: clientState ?? null,
      client_state_name: clientState ? stateName(clientState) : null,
      client_tz: clientTz,
      slots: slots.map(s => ({
        iso: s.iso,
        office_time_mt: s.humanTime,
        client_local_time: new Intl.DateTimeFormat('en-US', {
          timeZone: clientTz,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(new Date(s.iso)),
        client_tz_label: clientTzLabel,
      })),
    },
  }
}

async function handleBook(args: Record<string, unknown>, ctx: ToolContext) {
  const iso = String(args.scheduled_at_iso ?? '').trim()
  const fullName = String(args.full_name ?? '').trim()
  const words = fullName.split(/\s+/).filter(Boolean)

  if (!iso) return { result: { ok: false, error: 'scheduled_at_iso requerido' } }
  if (words.length < 2) {
    return {
      result: {
        ok: false,
        error: 'full_name incompleto. Pide al usuario nombre y apellido antes de llamar este tool.',
      },
    }
  }
  if (isNaN(Date.parse(iso))) {
    return { result: { ok: false, error: 'scheduled_at_iso no es un ISO válido' } }
  }

  const notes = [
    'WhatsApp SIJS intake:',
    `Estado: ${ctx.collected.state_us ?? '?'}`,
    `Edad: ${ctx.collected.age ?? '?'}`,
    `Vive EEUU: ${ctx.collected.lives_in_usa === true ? 'sí' : ctx.collected.lives_in_usa === false ? 'no' : '?'}`,
    `Abuso/neg/aband: ${ctx.collected.suffered_abuse === true ? 'sí' : ctx.collected.suffered_abuse === false ? 'no' : '?'}`,
    `Verdict: ${ctx.collected.verdict ?? '?'}`,
  ].join(' | ')

  const result = await bookProspectAppointment({
    scheduledAtIso: iso,
    guestName: fullName,
    guestPhone: ctx.phoneE164,
    source: 'whatsapp-chatbot',
    notes,
  })

  if (!result.ok) {
    return {
      result: {
        ok: false,
        error: result.error,
        message: result.message,
      },
    }
  }

  await updateConversation({
    conversationId: ctx.conversation.id,
    currentStep: 'BOOKED',
    status: 'scheduled',
    closedReason: 'booked',
    appointmentId: result.appointmentId,
    collectedData: { ...ctx.collected, contact_full_name: fullName } as Parameters<typeof updateConversation>[0]['collectedData'],
  })

  // Push admin.
  const clientState = ctx.collected.state_us as string | undefined
  const clientTz = clientState ? tzForState(clientState) : 'America/Denver'
  sendPushToAdmins({
    title: '✅ Nueva cita SIJS',
    body: `${fullName} — ${result.humanDate} ${result.humanTime} MT`,
    url: `/admin/whatsapp/${ctx.conversation.id}`,
    tag: `wa-booked-${ctx.conversation.id}`,
  }).catch(err => log.error('push admins (booked) failed', err))

  const clientLocalTime = new Intl.DateTimeFormat('en-US', {
    timeZone: clientTz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
  const clientLocalDate = new Intl.DateTimeFormat('es-US', {
    timeZone: clientTz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso))

  return {
    result: {
      ok: true,
      appointment_id: result.appointmentId,
      confirmed: {
        office_mt: `${result.humanDate} ${result.humanTime} MT`,
        client_local: `${clientLocalDate} ${clientLocalTime}`,
        client_tz_label: clientTz.split('/').pop()!.replace('_', ' '),
      },
    },
    terminal: true,
  }
}

async function handleLookup(ctx: ToolContext) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('appointments')
    .select('id, scheduled_at, status')
    .eq('guest_phone', ctx.phoneE164)
    .eq('source', 'whatsapp-chatbot')
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return { result: { found: false } }

  const iso = data.scheduled_at as string
  const clientState = ctx.collected.state_us as string | undefined
  const clientTz = clientState ? tzForState(clientState) : 'America/Denver'
  const clientLocal = new Intl.DateTimeFormat('en-US', {
    timeZone: clientTz, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
  const clientDate = new Intl.DateTimeFormat('es-US', {
    timeZone: clientTz, weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(iso))

  return {
    result: {
      found: true,
      scheduled_at_iso: iso,
      office_mt: `${formatDateMT(iso)} ${formatToMT(iso)} MT`,
      client_local: `${clientDate} ${clientLocal}`,
      status: data.status,
    },
  }
}

async function handleCallNow(ctx: ToolContext) {
  await updateConversation({
    conversationId: ctx.conversation.id,
    currentStep: 'CALL_NOW',
    status: 'closed',
    closedReason: 'requested_call_now',
  })
  sendPushToAdmins({
    title: '📞 Llamada SIJS inmediata',
    body: `${ctx.collected.contact_full_name ?? ctx.waProfileName ?? 'Prospecto'} (${ctx.phoneE164}) quiere una llamada ahora.`,
    url: `/admin/whatsapp/${ctx.conversation.id}`,
    tag: `wa-call-now-${ctx.conversation.id}`,
  }).catch(err => log.error('push admins (call-now) failed', err))
  return { result: { notified: true }, terminal: true }
}

async function handleOptOut(ctx: ToolContext) {
  await markContactOptedOut(ctx.contact.id)
  await updateConversation({
    conversationId: ctx.conversation.id,
    currentStep: 'OPTED_OUT',
    status: 'closed',
    closedReason: 'opted_out',
  })
  return { result: { opted_out: true }, terminal: true }
}

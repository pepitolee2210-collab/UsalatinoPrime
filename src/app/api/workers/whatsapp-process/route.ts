import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash/client'
import { sendWhatsapp } from '@/lib/twilio/client'
import {
  getOrCreateConversation,
  persistInboundMessage,
  persistOutboundMessage,
  updateConversation,
  upsertSijsIntake,
  markContactOptedOut,
  markTwilioEventProcessed,
} from '@/lib/chatbot/sijs-session'
import {
  nextStep,
  isTerminal,
  type SijsStep,
  type CollectedData,
} from '@/lib/chatbot/sijs-state-machine'
import { evaluateEligibility } from '@/lib/chatbot/sijs-eligibility'
import { CANONICAL_MESSAGES } from '@/lib/ai/prompts/sijs-whatsapp-system'
import { generateFaqReply, generateIneligibleReply } from '@/lib/ai/sijs-whatsapp-reply'
import { tzForState } from '@/lib/timezones/us-states'
import {
  listUpcomingProspectSlots,
  bookProspectAppointment,
} from '@/lib/appointments/prospect-booking'
import { formatDateMT, formatToMT } from '@/lib/appointments/slots'
import { sendPushToAdmins } from '@/lib/notifications/push'
import { createLogger } from '@/lib/logger'

const log = createLogger('whatsapp-worker')

interface TwilioParams {
  MessageSid: string
  SmsMessageSid?: string
  From: string     // "whatsapp:+15551234567"
  To: string       // "whatsapp:+14155238886"
  Body?: string
  ProfileName?: string
  WaId?: string    // "15551234567" (no +)
  NumMedia?: string
  MediaUrl0?: string
  MediaContentType0?: string
}

interface WorkerPayload {
  messageSid: string
  params: TwilioParams
}

function phoneFromTwilio(params: TwilioParams): string {
  const waId = params.WaId
  if (waId) return waId.startsWith('+') ? waId : `+${waId}`
  const from = params.From.replace(/^whatsapp:/, '')
  return from
}

function mediaUrlsFromParams(params: TwilioParams): Array<{ url: string; contentType: string }> {
  const n = parseInt(params.NumMedia ?? '0', 10) || 0
  const out: Array<{ url: string; contentType: string }> = []
  for (let i = 0; i < n; i++) {
    const url = (params as unknown as Record<string, string>)[`MediaUrl${i}`]
    const ct = (params as unknown as Record<string, string>)[`MediaContentType${i}`] ?? ''
    if (url) out.push({ url, contentType: ct })
  }
  return out
}

export async function POST(request: NextRequest) {
  // Verify QStash signature so only QStash can call us.
  const raw = await request.text()
  const signature = request.headers.get('upstash-signature')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const selfUrl = `${proto}://${host}${request.nextUrl.pathname}`

  const valid = await verifyQStashSignature({ signature, body: raw, url: selfUrl })
  if (!valid && process.env.NODE_ENV === 'production') {
    log.warn('invalid qstash signature')
    return new NextResponse('Forbidden', { status: 403 })
  }

  let payload: WorkerPayload
  try {
    payload = JSON.parse(raw) as WorkerPayload
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const { messageSid, params } = payload
  if (!messageSid || !params || !params.From) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  try {
    await processInboundMessage({ messageSid, params })
    await markTwilioEventProcessed(messageSid)
    return NextResponse.json({ ok: true })
  } catch (err) {
    log.error('worker error', err)
    await markTwilioEventProcessed(messageSid, String(err)).catch(() => {})
    // Non-200 triggers QStash retry (we configured retries=3).
    return new NextResponse('Server Error', { status: 500 })
  }
}

async function processInboundMessage(args: { messageSid: string; params: TwilioParams }) {
  const { messageSid, params } = args
  const phone = phoneFromTwilio(params)
  const profileName = params.ProfileName ?? null
  const body = (params.Body ?? '').trim()
  const media = mediaUrlsFromParams(params)

  const { contact, conversation } = await getOrCreateConversation({
    phoneE164: phone,
    profileName,
  })

  // Skip if contact already opted out — should not get here because Twilio
  // filters replies to STOP, but belt-and-suspenders.
  if (contact.opted_out) {
    log.info('ignoring message from opted-out contact', { phone })
    return
  }

  await persistInboundMessage({
    conversationId: conversation.id,
    body,
    mediaUrls: media,
    twilioSid: messageSid,
  })

  const collected: CollectedData = (conversation.collected_data ?? {}) as CollectedData
  let currentStep: SijsStep = conversation.current_step

  // Brand-new conversation: respond GREETING immediately, don't run transition.
  // Only match on current_step because total_messages isn't incremented
  // anywhere — relying on it was the reason the bot looped back to the
  // greeting on every inbound message.
  if (currentStep === 'GREETING') {
    await sendBotMessage({
      conversationId: conversation.id,
      contactPhone: phone,
      text: CANONICAL_MESSAGES.GREETING,
    })
    await updateConversation({
      conversationId: conversation.id,
      currentStep: 'INTRODUCTION',
    })
    return
  }

  // Regular turn: run the state machine.
  const transition = nextStep(currentStep, body, collected)

  // Retry path: resend the question with a hint; bump retry_count; escalate on 3.
  if (transition.retry) {
    const newRetryCount = conversation.retry_count + 1
    if (newRetryCount >= 3) {
      await sendBotMessage({
        conversationId: conversation.id,
        contactPhone: phone,
        text: CANONICAL_MESSAGES.REQUIRES_HUMAN,
      })
      await updateConversation({
        conversationId: conversation.id,
        currentStep: 'REQUIRES_HUMAN',
        retryCount: newRetryCount,
        status: 'closed',
        closedReason: 'retry_exhausted',
      })
      return
    }
    await sendBotMessage({
      conversationId: conversation.id,
      contactPhone: phone,
      text: transition.retry.hint,
    })
    await updateConversation({
      conversationId: conversation.id,
      retryCount: newRetryCount,
    })
    return
  }

  const newCollected: CollectedData = {
    ...collected,
    ...(transition.patch ?? {}),
  }

  // Merge contact info from Twilio profile.
  if (!newCollected.contact_full_name && (profileName || contact.display_name)) {
    newCollected.contact_full_name = profileName ?? contact.display_name ?? undefined
  }
  if (!newCollected.contact_phone_e164) newCollected.contact_phone_e164 = phone

  // Execute the step that we are transitioning INTO. Some steps are
  // self-triggering (ANALYSIS, ELIGIBLE after patch, PICK_SLOT after ELIGIBLE
  // accepts "después"), so loop until we land on a step that needs user input.
  currentStep = transition.nextStep
  await runServerSideStep({
    conversationId: conversation.id,
    contactId: contact.id,
    contactPhone: phone,
    startingStep: currentStep,
    collected: newCollected,
    retryCount: 0,
  })
}

/**
 * Execute server-side steps (no user input required) until we hit a step
 * that expects a reply or a terminal step.
 */
async function runServerSideStep(args: {
  conversationId: string
  contactId: string
  contactPhone: string
  startingStep: SijsStep
  collected: CollectedData
  retryCount: number
}) {
  let step = args.startingStep
  let collected = args.collected

  // Safety bound on the self-advance loop.
  for (let i = 0; i < 6; i++) {
    switch (step) {
      case 'INTRODUCTION': {
        // Send the intro message + the explainer video, then go to Q1.
        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text: CANONICAL_MESSAGES.INTRODUCTION,
        })
        const videoUrl = process.env.WHATSAPP_VIDEO_URL
        if (videoUrl) {
          await sendBotMessage({
            conversationId: args.conversationId,
            contactPhone: args.contactPhone,
            text: CANONICAL_MESSAGES.VIDEO_CAPTION,
            mediaUrls: [videoUrl],
          })
        }
        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text: CANONICAL_MESSAGES.Q1_LIVES_USA,
        })
        await updateConversation({
          conversationId: args.conversationId,
          currentStep: 'Q1_LIVES_USA',
          collectedData: collected,
          videoSent: true,
          retryCount: 0,
        })
        return
      }

      case 'FAQ_MODE': {
        const reply = await generateFaqReply({
          userMessage: collected.contact_full_name
            ? `El usuario pregunta algo sobre SIJS. Su nombre es ${collected.contact_full_name}.`
            : 'El usuario tiene una duda abierta sobre SIJS.',
        })
        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text: reply.text,
          tokens: {
            input: reply.inputTokens,
            output: reply.outputTokens,
          },
        })
        await updateConversation({
          conversationId: args.conversationId,
          currentStep: 'FAQ_MODE',
          collectedData: collected,
          retryCount: 0,
        })
        return
      }

      case 'Q1_LIVES_USA':
      case 'Q2_AGE':
      case 'Q3_STATE':
      case 'Q4_ABUSE': {
        const msg =
          step === 'Q1_LIVES_USA' ? CANONICAL_MESSAGES.Q1_LIVES_USA
          : step === 'Q2_AGE' ? CANONICAL_MESSAGES.Q2_AGE
          : step === 'Q3_STATE' ? CANONICAL_MESSAGES.Q3_STATE
          : CANONICAL_MESSAGES.Q4_ABUSE
        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text: msg,
        })
        await updateConversation({
          conversationId: args.conversationId,
          currentStep: step,
          collectedData: collected,
          retryCount: 0,
        })
        return
      }

      case 'ANALYSIS': {
        const intake = {
          lives_in_usa: collected.lives_in_usa ?? null,
          age: collected.age ?? null,
          state_us: collected.state_us ?? null,
          suffered_abuse: collected.suffered_abuse ?? null,
        }
        const verdict = evaluateEligibility(intake)
        collected = { ...collected, verdict: verdict.verdict }
        await upsertSijsIntake({
          conversationId: args.conversationId,
          contactId: args.contactId,
          collectedData: collected,
          verdict: verdict.verdict,
          verdictReasoning: verdict.reasons.join(' '),
          stateAgeLimit: verdict.state_age_limit,
          aiModel: 'rule-based',
        })
        step =
          verdict.verdict === 'eligible' ? 'ELIGIBLE'
          : verdict.verdict === 'not_eligible' ? 'INELIGIBLE'
          : 'REQUIRES_REVIEW'
        continue
      }

      case 'ELIGIBLE':
      case 'REQUIRES_REVIEW': {
        const text =
          step === 'ELIGIBLE'
            ? CANONICAL_MESSAGES.ELIGIBLE(collected.contact_full_name)
            : CANONICAL_MESSAGES.REQUIRES_REVIEW(collected.contact_full_name)
        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text,
        })
        await updateConversation({
          conversationId: args.conversationId,
          currentStep: 'SCHEDULE_OFFER',
          collectedData: collected,
          status: 'filtered_in',
          retryCount: 0,
        })
        return
      }

      case 'INELIGIBLE': {
        const intake = {
          lives_in_usa: collected.lives_in_usa ?? null,
          age: collected.age ?? null,
          state_us: collected.state_us ?? null,
          suffered_abuse: collected.suffered_abuse ?? null,
        }
        const verdict = evaluateEligibility(intake)
        const llm = await generateIneligibleReply({
          reason: verdict.reasons.join(' '),
          name: collected.contact_full_name,
        })
        const text = llm.text?.trim() || CANONICAL_MESSAGES.INELIGIBLE_BASE
        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text,
          tokens: { input: llm.inputTokens, output: llm.outputTokens },
        })
        await updateConversation({
          conversationId: args.conversationId,
          currentStep: 'INELIGIBLE',
          collectedData: collected,
          status: 'filtered_out',
          closedReason: 'ineligible',
          retryCount: 0,
        })
        return
      }

      case 'SCHEDULE_OFFER': {
        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text: CANONICAL_MESSAGES.SCHEDULE_OFFER_RETRY,
        })
        await updateConversation({
          conversationId: args.conversationId,
          currentStep: 'SCHEDULE_OFFER',
          collectedData: collected,
          retryCount: 0,
        })
        return
      }

      case 'CALL_NOW': {
        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text: CANONICAL_MESSAGES.CALL_NOW,
        })
        await sendPushToAdmins({
          title: '📞 Llamada SIJS inmediata',
          body: `${collected.contact_full_name ?? 'Prospecto'} (${args.contactPhone}) quiere una llamada ahora.`,
          url: '/admin/whatsapp',
          tag: `wa-call-now-${args.conversationId}`,
        }).catch(err => log.error('push admins (call-now) failed', err))
        await updateConversation({
          conversationId: args.conversationId,
          currentStep: 'CALL_NOW',
          collectedData: collected,
          status: 'closed',
          closedReason: 'requested_call_now',
          retryCount: 0,
        })
        return
      }

      case 'PICK_SLOT': {
        const slots = await listUpcomingProspectSlots({ maxSlots: 6, lookAheadDays: 7 })
        if (slots.length === 0) {
          await sendBotMessage({
            conversationId: args.conversationId,
            contactPhone: args.contactPhone,
            text: CANONICAL_MESSAGES.PICK_SLOT_NONE,
          })
          await updateConversation({
            conversationId: args.conversationId,
            currentStep: 'REQUIRES_HUMAN',
            collectedData: collected,
            status: 'closed',
            closedReason: 'no_slots',
            retryCount: 0,
          })
          return
        }

        const clientTz = collected.state_us ? tzForState(collected.state_us) : 'America/Denver'
        const tzLabel = clientTz.split('/').pop() ?? clientTz

        const labeled = slots.map((s, i) => {
          const humanLocalDate = new Intl.DateTimeFormat('es-US', {
            timeZone: clientTz,
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }).format(new Date(s.iso))
          const humanLocalTime = new Intl.DateTimeFormat('en-US', {
            timeZone: clientTz,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }).format(new Date(s.iso))
          return { iso: s.iso, label: `${i + 1}) ${humanLocalDate} — ${humanLocalTime}` }
        })

        const listText =
          CANONICAL_MESSAGES.PICK_SLOT_HEADER(tzLabel) +
          '\n\n' +
          labeled.map(l => l.label).join('\n')

        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text: listText,
        })

        await updateConversation({
          conversationId: args.conversationId,
          currentStep: 'PICK_SLOT',
          collectedData: { ...collected, offered_slots: labeled },
          retryCount: 0,
        })
        return
      }

      case 'CONFIRM_SLOT': {
        const iso = collected.preferred_slot_iso
        if (!iso) {
          step = 'PICK_SLOT'
          continue
        }
        const clientTz = collected.state_us ? tzForState(collected.state_us) : 'America/Denver'
        const tzLabel = clientTz.split('/').pop() ?? clientTz
        const humanDate = new Intl.DateTimeFormat('es-US', {
          timeZone: clientTz,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(new Date(iso))
        const humanTime = new Intl.DateTimeFormat('en-US', {
          timeZone: clientTz,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(new Date(iso))
        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text: CANONICAL_MESSAGES.CONFIRM_SLOT(humanDate, humanTime, tzLabel),
        })
        await updateConversation({
          conversationId: args.conversationId,
          currentStep: 'CONFIRM_SLOT',
          collectedData: collected,
          retryCount: 0,
        })
        return
      }

      case 'BOOKED': {
        const iso = collected.preferred_slot_iso
        if (!iso) {
          // Shouldn't happen but re-show slots.
          step = 'PICK_SLOT'
          continue
        }
        const notes = [
          `WhatsApp SIJS intake:`,
          `Estado: ${collected.state_us ?? '?'}`,
          `Edad: ${collected.age ?? '?'}`,
          `Vive en EEUU: ${collected.lives_in_usa === true ? 'sí' : collected.lives_in_usa === false ? 'no' : '?'}`,
          `Abuso/neg/aband: ${collected.suffered_abuse === true ? 'sí' : collected.suffered_abuse === false ? 'no' : '?'}`,
          `Verdict: ${collected.verdict ?? '?'}`,
        ].join(' | ')

        const result = await bookProspectAppointment({
          scheduledAtIso: iso,
          guestName: collected.contact_full_name ?? 'Sin nombre',
          guestPhone: args.contactPhone,
          source: 'whatsapp-chatbot',
          notes,
        })

        if (!result.ok) {
          if (result.error === 'slot_taken') {
            await sendBotMessage({
              conversationId: args.conversationId,
              contactPhone: args.contactPhone,
              text: 'Parece que ese horario se tomó justo antes que tú. Te muestro opciones nuevas.',
            })
            step = 'PICK_SLOT'
            collected = { ...collected, preferred_slot_iso: undefined }
            continue
          }
          await sendBotMessage({
            conversationId: args.conversationId,
            contactPhone: args.contactPhone,
            text: `No pude agendar automáticamente (${result.message}). Henry te contactará para coordinar.`,
          })
          await updateConversation({
            conversationId: args.conversationId,
            currentStep: 'REQUIRES_HUMAN',
            collectedData: collected,
            status: 'closed',
            closedReason: 'booking_error',
            retryCount: 0,
          })
          return
        }

        const clientTz = collected.state_us ? tzForState(collected.state_us) : 'America/Denver'
        const tzLabel = clientTz.split('/').pop() ?? clientTz
        const humanLocalDate = new Intl.DateTimeFormat('es-US', {
          timeZone: clientTz, weekday: 'long', day: 'numeric', month: 'long',
        }).format(new Date(iso))
        const humanLocalTime = new Intl.DateTimeFormat('en-US', {
          timeZone: clientTz, hour: 'numeric', minute: '2-digit', hour12: true,
        }).format(new Date(iso))

        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text: CANONICAL_MESSAGES.BOOKED(humanLocalDate, humanLocalTime, tzLabel),
        })

        await updateConversation({
          conversationId: args.conversationId,
          currentStep: 'BOOKED',
          collectedData: collected,
          status: 'scheduled',
          closedReason: 'booked',
          appointmentId: result.appointmentId,
          retryCount: 0,
        })

        // Notify admin via Web Push (PWA, fires even with phone locked).
        await sendPushToAdmins({
          title: '✅ Nueva cita SIJS',
          body: `${collected.contact_full_name ?? 'Prospecto'} — ${formatDateMT(iso)} ${formatToMT(iso)} MT`,
          url: `/admin/whatsapp/${args.conversationId}`,
          tag: `wa-booked-${args.conversationId}`,
        }).catch(err => log.error('push admins (booked) failed', err))
        return
      }

      case 'OPTED_OUT': {
        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text: CANONICAL_MESSAGES.OPTED_OUT,
        })
        await markContactOptedOut(args.contactId)
        await updateConversation({
          conversationId: args.conversationId,
          currentStep: 'OPTED_OUT',
          status: 'closed',
          closedReason: 'opted_out',
          retryCount: 0,
        })
        return
      }

      case 'REQUIRES_HUMAN': {
        await sendBotMessage({
          conversationId: args.conversationId,
          contactPhone: args.contactPhone,
          text: CANONICAL_MESSAGES.REQUIRES_HUMAN,
        })
        await updateConversation({
          conversationId: args.conversationId,
          currentStep: 'REQUIRES_HUMAN',
          status: 'closed',
          closedReason: 'requires_human',
          retryCount: 0,
        })
        return
      }

      case 'GREETING':
        // Greeting is handled inline on first message — fall through to quit.
        return
    }
    if (isTerminal(step)) return
  }

  log.warn('runServerSideStep hit max loop iterations', { step })
}

async function sendBotMessage(args: {
  conversationId: string
  contactPhone: string
  text: string
  mediaUrls?: string[]
  tokens?: { input?: number; output?: number }
}) {
  try {
    const sent = await sendWhatsapp({
      to: args.contactPhone,
      body: args.text,
      mediaUrls: args.mediaUrls,
    })
    await persistOutboundMessage({
      conversationId: args.conversationId,
      role: 'bot',
      body: args.text,
      twilioSid: sent.sid,
      geminiInputTokens: args.tokens?.input,
      geminiOutputTokens: args.tokens?.output,
      mediaUrls: args.mediaUrls,
    })
  } catch (err) {
    log.error('sendBotMessage failed', err)
    await persistOutboundMessage({
      conversationId: args.conversationId,
      role: 'bot',
      body: args.text,
      mediaUrls: args.mediaUrls,
    })
    throw err
  }
}

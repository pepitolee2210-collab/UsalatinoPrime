/**
 * WhatsApp SIJS chatbot state machine.
 *
 * Unlike the web chatbot (which holds session state in memory because it is
 * synchronous), WhatsApp is asynchronous — users reply minutes or hours
 * later and serverless instances die between turns. So the state lives in
 * the DB (`whatsapp_conversations.current_step` + `collected_data` JSONB),
 * and this module is the pure-logic transition function.
 *
 * Gemini generates the natural-language replies; this module decides which
 * step to ask next and interprets structured answers like "17" or "Texas".
 * For fuzzy answers (e.g. the FAQ diversion) Gemini takes over via function
 * calling — see `lib/ai/tools/sijs-tools.ts`.
 */

import { evaluateEligibility, type SijsIntake } from './sijs-eligibility'
import { normalizeStateCode } from '@/lib/timezones/us-states'

export type SijsStep =
  | 'GREETING'
  | 'INTRODUCTION'
  | 'FAQ_MODE'
  | 'Q1_LIVES_USA'
  | 'Q2_AGE'
  | 'Q3_STATE'
  | 'Q4_ABUSE'
  | 'ANALYSIS'
  | 'ELIGIBLE'
  | 'INELIGIBLE'
  | 'REQUIRES_REVIEW'
  | 'SCHEDULE_OFFER'
  | 'CALL_NOW'
  | 'PICK_SLOT'
  | 'CONFIRM_SLOT'
  | 'BOOKED'
  | 'OPTED_OUT'
  | 'REQUIRES_HUMAN'

/** Everything the state machine has learned so far about the user. */
export interface CollectedData {
  lives_in_usa?: boolean
  age?: number
  state_us?: string
  suffered_abuse?: boolean
  verdict?: 'eligible' | 'not_eligible' | 'requires_review'
  preferred_slot_iso?: string
  offered_slots?: Array<{ iso: string; label: string }>
  contact_full_name?: string
  contact_phone_e164?: string
}

/** Result of a transition: next step + patch for collected_data + optional hint. */
export interface Transition {
  nextStep: SijsStep
  patch?: Partial<CollectedData>
  /**
   * If set, the worker should send this as a literal reply without asking
   * Gemini (used for terminal messages and opt-out acknowledgement so we
   * stay fast and deterministic).
   */
  directReply?: string
  /**
   * If set, the step was not understood — the worker should ask the user
   * to clarify. `retry` increments `retry_count`; at 3 the worker escalates
   * to REQUIRES_HUMAN.
   */
  retry?: { hint: string }
}

const OPT_OUT_RE = /^(stop|baja|cancelar|unsubscribe|parar|salir|no quiero mas)\b/i

function parseYesNo(input: string): boolean | null {
  const t = input.trim().toLowerCase()
  if (/^(si|sí|yes|ya|claro|por supuesto|afirmativo|s)$/i.test(t)) return true
  if (/^(no|nope|negativo|nada|nunca|n)$/i.test(t)) return false
  // Contextual affirmative/negative if the whole message is mostly about it.
  if (/\b(sí|si|claro|así es|efectivamente)\b/i.test(t)) return true
  if (/\bno\b/i.test(t) && !/\b(no sé|no se)\b/i.test(t)) return false
  return null
}

function parseAge(input: string): number | null {
  const m = input.match(/\b(\d{1,2})\b/)
  if (!m) return null
  const age = parseInt(m[1], 10)
  if (age < 1 || age > 30) return null
  return age
}

/**
 * Decide where to go from `current` after the user sent `userInput`.
 * This is the single source of truth for the question sequence.
 */
export function nextStep(
  current: SijsStep,
  userInput: string,
  collected: CollectedData,
): Transition {
  if (OPT_OUT_RE.test(userInput.trim())) {
    return {
      nextStep: 'OPTED_OUT',
      directReply: 'Hemos recibido tu solicitud de baja. No recibirás más mensajes. Si más adelante quieres contactarnos, llama al 801-941-3479.',
    }
  }

  switch (current) {
    case 'GREETING':
      return { nextStep: 'INTRODUCTION' }

    case 'INTRODUCTION': {
      if (/\b(info|informaci|pregunta|duda|como|qué|que|cuánto|cuanto|explica)/i.test(userInput)) {
        return { nextStep: 'FAQ_MODE' }
      }
      return { nextStep: 'Q1_LIVES_USA' }
    }

    case 'FAQ_MODE': {
      if (/\b(empez|listo|comenzar|vamos|s[ií])\b/i.test(userInput)) {
        return { nextStep: 'Q1_LIVES_USA' }
      }
      return { nextStep: 'FAQ_MODE' }
    }

    case 'Q1_LIVES_USA': {
      const ans = parseYesNo(userInput)
      if (ans === null) {
        return {
          nextStep: 'Q1_LIVES_USA',
          retry: { hint: 'Respóndeme con "sí" o "no", por favor: ¿el menor vive actualmente en los Estados Unidos?' },
        }
      }
      if (ans === false) {
        return { nextStep: 'INELIGIBLE', patch: { lives_in_usa: false } }
      }
      return { nextStep: 'Q2_AGE', patch: { lives_in_usa: true } }
    }

    case 'Q2_AGE': {
      const age = parseAge(userInput)
      if (age == null) {
        return {
          nextStep: 'Q2_AGE',
          retry: { hint: 'Solo el número de la edad, por favor. Por ejemplo: "15".' },
        }
      }
      return { nextStep: 'Q3_STATE', patch: { age } }
    }

    case 'Q3_STATE': {
      const code = normalizeStateCode(userInput)
      if (!code) {
        return {
          nextStep: 'Q3_STATE',
          retry: { hint: '¿Me confirmas el nombre completo del estado? Por ejemplo "Florida", "Texas", "California".' },
        }
      }
      return { nextStep: 'Q4_ABUSE', patch: { state_us: code } }
    }

    case 'Q4_ABUSE': {
      const ans = parseYesNo(userInput)
      if (ans === null) {
        return {
          nextStep: 'Q4_ABUSE',
          retry: { hint: 'Respóndeme "sí" o "no", por favor: ¿el menor sufrió abuso, negligencia o abandono por uno o ambos padres?' },
        }
      }
      // Move to ANALYSIS regardless — evaluateEligibility needs the full picture.
      return { nextStep: 'ANALYSIS', patch: { suffered_abuse: ans } }
    }

    case 'ANALYSIS': {
      // ANALYSIS is computed, not asked — worker calls evaluateEligibility and
      // moves directly to ELIGIBLE/INELIGIBLE/REQUIRES_REVIEW. If we land here
      // from a user message we just re-evaluate.
      const intake: SijsIntake = {
        lives_in_usa: collected.lives_in_usa ?? null,
        age: collected.age ?? null,
        state_us: collected.state_us ?? null,
        suffered_abuse: collected.suffered_abuse ?? null,
      }
      const verdict = evaluateEligibility(intake)
      if (verdict.verdict === 'eligible') return { nextStep: 'ELIGIBLE', patch: { verdict: 'eligible' } }
      if (verdict.verdict === 'not_eligible') return { nextStep: 'INELIGIBLE', patch: { verdict: 'not_eligible' } }
      return { nextStep: 'REQUIRES_REVIEW', patch: { verdict: 'requires_review' } }
    }

    case 'ELIGIBLE':
    case 'REQUIRES_REVIEW': {
      // After good news, we ask whether they want a call now or to schedule.
      if (/\b(ahora|inmediato|ya mismo|en seguida)\b/i.test(userInput)) {
        return { nextStep: 'CALL_NOW' }
      }
      if (/\b(despu|agend|programar|luego|m[aá]s tarde|otro d[ií]a)\b/i.test(userInput)) {
        return { nextStep: 'PICK_SLOT' }
      }
      return { nextStep: 'SCHEDULE_OFFER' }
    }

    case 'SCHEDULE_OFFER': {
      if (/\b(ahora|inmediato|ya mismo)\b/i.test(userInput)) return { nextStep: 'CALL_NOW' }
      if (/\b(despu|agend|programar|luego|m[aá]s tarde)\b/i.test(userInput)) return { nextStep: 'PICK_SLOT' }
      return {
        nextStep: 'SCHEDULE_OFFER',
        retry: { hint: '¿Prefieres una llamada *ahora* o *agendarla para después*? Responde con una de las dos opciones.' },
      }
    }

    case 'PICK_SLOT': {
      const m = userInput.match(/\b([1-9])\b/)
      if (!m) {
        return {
          nextStep: 'PICK_SLOT',
          retry: { hint: 'Elígelo por número. Por ejemplo escribe "1", "2" o "3" para seleccionar un horario.' },
        }
      }
      const idx = parseInt(m[1], 10) - 1
      const slot = collected.offered_slots?.[idx]
      if (!slot) {
        return {
          nextStep: 'PICK_SLOT',
          retry: { hint: 'Ese número no está en la lista. Revisa los horarios y escribe el número correcto.' },
        }
      }
      return { nextStep: 'CONFIRM_SLOT', patch: { preferred_slot_iso: slot.iso } }
    }

    case 'CONFIRM_SLOT': {
      const ans = parseYesNo(userInput)
      if (ans === null) {
        return {
          nextStep: 'CONFIRM_SLOT',
          retry: { hint: 'Responde "sí" para confirmar o "no" para escoger otro horario.' },
        }
      }
      if (ans === false) return { nextStep: 'PICK_SLOT', patch: { preferred_slot_iso: undefined } }
      return { nextStep: 'BOOKED' }
    }

    case 'CALL_NOW':
    case 'BOOKED':
    case 'INELIGIBLE':
    case 'OPTED_OUT':
    case 'REQUIRES_HUMAN':
      return { nextStep: current }
  }
}

/** Terminal steps — the worker can close the conversation after writing these. */
export function isTerminal(step: SijsStep): boolean {
  return (
    step === 'BOOKED' ||
    step === 'INELIGIBLE' ||
    step === 'OPTED_OUT' ||
    step === 'REQUIRES_HUMAN' ||
    step === 'CALL_NOW'
  )
}

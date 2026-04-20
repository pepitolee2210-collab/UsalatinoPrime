import { getGeminiClient, GEMINI_MODEL } from '@/lib/ai/gemini'
import { SIJS_WA_SYSTEM_PROMPT, FAQ_GUIDE_PROMPT } from '@/lib/ai/prompts/sijs-whatsapp-system'
import { createLogger } from '@/lib/logger'

const log = createLogger('sijs-whatsapp-reply')

/**
 * Generate a free-form reply with Gemini.
 *
 * Used only for FAQ_MODE and for nuanced "not eligible" explanations. The
 * rest of the flow uses canonical strings.
 */
export async function generateFaqReply(args: {
  userMessage: string
  history?: Array<{ role: 'user' | 'model'; text: string }>
}): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
  const gemini = getGeminiClient()
  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        ...(args.history ?? []).map(h => ({
          role: h.role,
          parts: [{ text: h.text }],
        })),
        { role: 'user', parts: [{ text: args.userMessage }] },
      ],
      config: {
        systemInstruction: `${SIJS_WA_SYSTEM_PROMPT}\n\n${FAQ_GUIDE_PROMPT}`,
        temperature: 0.6,
        maxOutputTokens: 400,
      },
    })
    const text =
      response.text ??
      response.candidates?.[0]?.content?.parts
        ?.map(p => ('text' in p ? p.text : ''))
        .join('') ??
      ''
    return {
      text: text.trim(),
      inputTokens: response.usageMetadata?.promptTokenCount ?? undefined,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? undefined,
    }
  } catch (err) {
    log.error('generateFaqReply failed', err)
    return {
      text: 'Perdona, tuve un problema al procesar tu pregunta. ¿Podemos continuar con las 4 preguntas del filtro?',
    }
  }
}

/**
 * Asks Gemini to write an empathetic closing message when a candidate is
 * clearly ineligible, tailored to the specific reason. Falls back to the
 * canonical `INELIGIBLE_BASE` string if the call fails.
 */
export async function generateIneligibleReply(args: {
  reason: string
  name?: string
}): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
  const gemini = getGeminiClient()
  const namePart = args.name ? `Nombre del usuario: ${args.name}.` : ''
  const prompt = `${namePart}\n\nMotivo por el que no califica para SIJS: ${args.reason}\n\nEscribe un mensaje breve, cálido y empático (máximo 3 oraciones) que: (1) agradezca al usuario por compartir, (2) explique con sensibilidad por qué SIJS no es la vía, (3) ofrezca que Henry revise otras opciones llamando al 801-941-3479. Responde solo el mensaje, sin prefacios.`
  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SIJS_WA_SYSTEM_PROMPT,
        temperature: 0.7,
        maxOutputTokens: 300,
      },
    })
    const text =
      response.text ??
      response.candidates?.[0]?.content?.parts
        ?.map(p => ('text' in p ? p.text : ''))
        .join('') ??
      ''
    return {
      text: text.trim(),
      inputTokens: response.usageMetadata?.promptTokenCount ?? undefined,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? undefined,
    }
  } catch (err) {
    log.error('generateIneligibleReply failed', err)
    return { text: '' } // caller falls back to canonical
  }
}

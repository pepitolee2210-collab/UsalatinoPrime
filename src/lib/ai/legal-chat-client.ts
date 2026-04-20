import { createLogger } from '@/lib/logger'

const log = createLogger('legal-chat')

const CHAT_MODEL = 'gemini-3.1-pro-preview'

/**
 * System prompt for the legal assistant chat.
 * Rich persona that activates legal reasoning + explicit behavior rules.
 * Designed for Gemini to handle ANY legal document review request from
 * the attorneys/employees (Henry, Diana, Andriuw) — not constrained to
 * a specific case type like the auto-reviewer in /admin/cases/[id].
 */
const CHAT_SYSTEM_PROMPT = `
Eres **LEX** — sistema de revisión legal senior de **UsaLatino Prime**, firma de inmigración dirigida por Henry Orellana en Utah. Tu nombre viene del latín "lex" (ley): directo, preciso, sin rodeos.

NO eres un chatbot genérico ni una asistente humana simulada. Eres un **sistema especializado** con la capacidad de razonamiento y juicio legal de un abogado senior, construido para un propósito específico: revisar documentos legales de inmigración y detectar fallas antes de que lleguen ante el juez.

Tu base de entrenamiento equivale a:
- 22 años de experiencia litigando en cortes federales y estatales de EE.UU.
- Más de 1,200 casos SIJS (Special Immigrant Juvenile Status) en 14 estados
- Más de 800 casos de asilo ante EOIR y USCIS
- Procesos I-485 (Ajuste de Estatus), I-130 (petición familiar), I-601 (waiver de inadmisibilidad)
- Cambios de venue, mociones ante BIA, peticiones de reapertura

Tu función en UsaLatino Prime: filtro de calidad ANTES de que Henry presente documentos ante la corte. Los paralegales te consultan porque tu revisión identifica con precisión lo que el juez cuestionará.

## CONTEXTO ACTUAL

Los usuarios que te consultan son parte del equipo UsaLatino Prime:
- **Henry Orellana** — abogado principal y fundador de la firma
- **Diana** — paralegal senior
- **Andriuw** — paralegal encargado de contratos

Te pueden pedir cualquier cosa relacionada con inmigración: revisar un I-485 recién redactado, evaluar evidencia de asilo, sugerir cómo fortalecer una declaración, verificar checklist de un caso, comparar dos borradores, etc.

Cuando el equipo te salude o te pregunte "¿quién eres?", preséntate de forma directa: *"LEX — sistema de revisión legal de UsaLatino Prime. Pásame el documento y dime qué necesitas revisar."* Tono profesional-eficiente, no conversacional-social.

## TU COMPORTAMIENTO

1. **Responde en ESPAÑOL por defecto** (es el equipo que te consulta). Si te escriben en inglés, responde en inglés.

2. **Tono: profesional-eficiente, no conversacional-cálido**. Eres un sistema, no una amiga. Evita "hola, ¿cómo estás?", "con gusto te ayudo", "espero que te sirva". Ve directo al análisis. Pero mantén cordialidad básica — no eres robotizada ni seca, solo enfocada.

3. **Sé específica y accionable**. NO digas "mejorar la narrativa". SÍ di "en el párrafo 5 reemplazar 'siempre fue ausente' por al menos dos incidentes con fecha y lugar, como 'el 15 de marzo de 2018 no asistió al cumpleaños...'"

3. **Formato Markdown** en tus respuestas. Usa:
   - **Títulos** (##) para secciones grandes
   - **Bullets** para listas
   - **\`código\`** para citas literales del documento
   - **Badges de severidad**: 🔴 CRÍTICO · 🟡 MODERADO · 🔵 SUGERENCIA
   - **Emojis funcionales** (📋 checklist, 📍 ubicación, ⚠️ riesgo), nunca decorativos

4. **Cuando te pasen un PDF o documento**:
   - Léelo COMPLETO antes de responder
   - Estructura tu feedback: Resumen del documento → Fortalezas → Problemas por severidad → Recomendaciones priorizadas
   - Cita texto específico del PDF entre comillas cuando señalas un problema

5. **Proactividad**. Si ves que falta algo importante que no te preguntaron, menciónalo al final: "⚠️ Observación adicional: no veo en tus archivos la partida de nacimiento del menor, que es esencial para SIJS."

6. **Cuándo pedir más info**. Si un documento referencia datos que no tienes (fechas, otros docs, contexto del cliente), pregunta. Pero solo si es verdaderamente bloqueante — prefiere responder con lo que hay + nota sobre lo que asumiste.

7. **Honestidad profesional**. Si ves un caso débil, dilo. Si un documento tiene problema legal serio (ej: menor de 18 en estado "hasta 18"), márcalo como CRÍTICO sin suavizar.

## LO QUE NO DEBES HACER

- ❌ Dar consejo legal directo al cliente final (solo a los paralegales/abogado del equipo)
- ❌ Inventar jurisprudencia o citas legales específicas — solo cita lo que estés segura que existe
- ❌ Redactar documentos completos desde cero — tu rol es REVISAR, no generar
- ❌ Responder con texto genérico tipo "hay que revisar cuidadosamente" — sé específica o di "no puedo evaluar esto con la info que tengo"
- ❌ Dar asesoría legal a preguntas no-inmigratorias (divorcios, criminal, etc.) — redirígelos a un especialista

## ESPECIALIDADES TÉCNICAS DONDE ERES FUERTE

- **SIJS / Visa Juvenil**: los 3 special findings estatales, jurisdicciones hasta 18 vs 21 años, evidencia de abandono/abuso/negligencia
- **Asilo**: 5 protected grounds, regla de 1 año, country conditions, credibilidad, nexus
- **I-485 Ajuste**: admisibilidad, I-864 affidavit of support, medical exam I-693, biométricos
- **I-360 SIJS**: el formulario federal, Special Immigrant category, aged-out protections
- **Renuncias**: voluntariedad, capacidad, legalización consular
- **Evidencia documental**: qué acepta USCIS/EOIR, traducciones certificadas, autenticación de documentos extranjeros

## REGLAS DE LENGUAJE

- Cuando cites requisitos legales, usa la forma corta: "8 USC § 1101(a)(27)(J)" no "Title 8, United States Code, Section 1101..."
- Cuando hables de jueces o cortes, sé respetuosa: "el juez de corte juvenil", "la oficina de asilo", no apodos
- Cuando señales un error, no hagas sentir mal al redactor. "Este documento se puede fortalecer si..." mejor que "esto está mal"
`.trim()

export interface ChatAttachment {
  filename: string
  mime_type: string
  data: string // base64
  size_bytes: number
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: Array<{ filename: string; mime_type: string; size_bytes: number }>
}

interface StreamChatParams {
  userMessage: string
  attachments?: ChatAttachment[]
  history?: ChatHistoryMessage[]
  signal?: AbortSignal
}

/**
 * Streams a chat response from Gemini. Returns a ReadableStream of SSE
 * events that the route handler forwards to the client.
 *
 * Events emitted:
 *   - `data: {"text": "..."}` — text delta
 *   - `data: {"done": true, "input_tokens": N, "output_tokens": N}` — end
 *   - `data: {"error": "..."}` — failure (stream continues to close)
 */
export async function streamLegalChat({
  userMessage,
  attachments = [],
  history = [],
  signal,
}: StreamChatParams): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')

  // Build Gemini contents from history + current turn
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = []
  for (const m of history) {
    contents.push({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })
  }

  // Current user turn: optional attachments + text
  const currentParts: Array<Record<string, unknown>> = []
  for (const a of attachments) {
    currentParts.push({
      inline_data: { mime_type: a.mime_type, data: a.data },
    })
  }
  currentParts.push({ text: userMessage })
  contents.push({ role: 'user', parts: currentParts })

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: CHAT_SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      ],
    }),
    signal,
  })

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '')
    log.error('Gemini stream failed', { status: upstream.status, body: errText.slice(0, 300) })
    throw new Error(`Error de IA (${upstream.status})`)
  }

  // Transform Gemini's SSE stream into our app's SSE format.
  // Gemini sends `data: {candidates: [{content: {parts: [{text: "..."}]}}], usageMetadata?: {...}}`
  // We emit `data: {"text": "chunk"}\n\n` on each delta and a final `data: {"done": true, ...}`
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader()
      let buffer = ''
      let inputTokens = 0
      let outputTokens = 0

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Parse SSE frames (separated by blank lines)
          const frames = buffer.split('\n\n')
          buffer = frames.pop() || ''

          for (const frame of frames) {
            const line = frame.trim()
            if (!line.startsWith('data:')) continue
            const json = line.slice(5).trim()
            if (!json || json === '[DONE]') continue

            try {
              const parsed = JSON.parse(json) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
                usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
              }
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
              }
              if (parsed.usageMetadata) {
                inputTokens = parsed.usageMetadata.promptTokenCount || inputTokens
                outputTokens = parsed.usageMetadata.candidatesTokenCount || outputTokens
              }
            } catch {
              // ignore malformed frames
            }
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, input_tokens: inputTokens, output_tokens: outputTokens })}\n\n`),
        )
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })
}

import Anthropic from '@anthropic-ai/sdk'
import { getAnthropic, CLAUDE_MODEL } from './anthropic-client'
import { selectRelevantDocs, buildKnowledgeContentBlocks } from './lex-knowledge-base'
import { createLogger } from '@/lib/logger'

const log = createLogger('legal-chat')

/**
 * System prompt del chatbot LEX — sistema de revisión legal interno de
 * UsaLatino Prime. Cacheable: se repite en cada turno de la misma
 * conversación y entre conversaciones distintas.
 */
const CHAT_SYSTEM_PROMPT = `Eres **LEX** — sistema de revisión legal senior de **UsaLatino Prime**, firma de inmigración dirigida por Henry Orellana en Utah. Tu nombre viene del latín "lex" (ley): directo, preciso, sin rodeos.

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

4. **Formato Markdown** en tus respuestas. Usa:
   - **Títulos** (##) para secciones grandes
   - **Bullets** para listas
   - **\`código\`** para citas literales del documento
   - **Badges de severidad**: 🔴 CRÍTICO · 🟡 MODERADO · 🔵 SUGERENCIA
   - **Emojis funcionales** (📋 checklist, 📍 ubicación, ⚠️ riesgo), nunca decorativos

5. **Cuando te pasen un PDF o documento**:
   - Léelo COMPLETO antes de responder
   - Estructura tu feedback: Resumen del documento → Fortalezas → Problemas por severidad → Recomendaciones priorizadas
   - Cita texto específico del PDF entre comillas cuando señalas un problema

6. **Proactividad**. Si ves que falta algo importante que no te preguntaron, menciónalo al final: "⚠️ Observación adicional: no veo en tus archivos la partida de nacimiento del menor, que es esencial para SIJS."

7. **Cuándo pedir más info**. Si un documento referencia datos que no tienes (fechas, otros docs, contexto del cliente), pregunta. Pero solo si es verdaderamente bloqueante — prefiere responder con lo que hay + nota sobre lo que asumiste.

8. **Honestidad profesional**. Si ves un caso débil, dilo. Si un documento tiene problema legal serio (ej: menor de 18 en estado "hasta 18"), márcalo como CRÍTICO sin suavizar.

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

## BASE DE CONOCIMIENTO OFICIAL — REGLA CRÍTICA

Cuando la conversación trata sobre un formulario migratorio específico (I-485, I-360, I-589), el sistema automáticamente adjunta los documentos oficiales de USCIS a tu contexto (formulario vacío + instrucciones). **Eso es tu fuente autorizada de verdad, por encima de tu memoria**.

Reglas duras cuando tienes documentos oficiales adjuntos:

1. **Cita siempre la fuente** — formato: \`[según I-485 Instructions pág. 12]\` o \`[según I-360 formulario Part 5 Question 3]\`. Si no puedes citar fuente, no afirmes el criterio como obligatorio.
2. **No inventes reglas que no estén en el documento oficial**. Si el paralegal pregunta "¿es obligatorio el campo X?" y el documento oficial no lo marca como obligatorio, dilo: *"Las instrucciones oficiales no marcan este campo como obligatorio, aunque USCIS recomienda llenarlo para evitar RFE."*
3. **Prioridad al documento oficial**. Si tu memoria dice A y el documento oficial adjunto dice B, vale B. Eso es intencional: USCIS actualiza formularios y tu entrenamiento puede estar desactualizado.
4. **Si no hay documento oficial adjunto** (ej. consulta sobre un tema sin formulario — "¿cómo preparo un testigo para entrevista?"), entonces opera con tu conocimiento general, pero siendo explícita: *"Basándome en mi experiencia (sin documento oficial adjunto para esta consulta)..."*
5. **Cuando revises un PDF llenado por el paralegal**, compáralo campo por campo contra el formulario oficial adjunto. Cada crítica debe decir qué dice el documento oficial vs qué puso el paralegal.

Si el paralegal cuestiona una crítica tuya y tienes documento oficial: cita la página exacta. Si no tienes respaldo en el documento, reconocelo y retirá la crítica — es mejor eso que insistir sin evidencia.`

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
 * Soportado nativamente por Claude: PDFs y algunas imágenes.
 * Otros mime types se describen como texto en el mensaje para que el modelo
 * sepa que existían adjuntos aunque no pueda leerlos.
 */
function attachmentToContentBlock(
  a: ChatAttachment
): Anthropic.Messages.ContentBlockParam | null {
  const mime = a.mime_type.toLowerCase()
  if (mime === 'application/pdf') {
    return {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: a.data,
      },
    }
  }
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime)) {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: a.data,
      },
    }
  }
  return null
}

/**
 * Streams a chat response from Claude Opus 4.7. Returns a ReadableStream of
 * SSE events that the route handler forwards to the client.
 *
 * Events emitted (same shape que la versión de Gemini):
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
  const client = getAnthropic()

  // Seleccionar documentos oficiales relevantes a la consulta. Los triggers
  // son regex sobre userMessage + nombres de adjuntos. Si detectamos que
  // la conversación trata sobre I-485, cargamos el formulario oficial y
  // las instrucciones oficiales de USCIS como contexto autorizado.
  // Si no hay match, knowledgeBlocks = [] y LEX opera como antes.
  const allMessageText = [userMessage, ...history.map(h => h.content)].join(' ')
  const attachmentNames = attachments.map(a => a.filename)
  const relevantDocs = selectRelevantDocs(allMessageText, attachmentNames)
  const knowledgeBlocks = await buildKnowledgeContentBlocks(relevantDocs)

  if (relevantDocs.length > 0) {
    log.info('knowledge base activated', {
      docs: relevantDocs.map(d => d.slug),
      messageLen: userMessage.length,
    })
  }

  // Reconstruct conversation history as Claude messages.
  const messages: Anthropic.MessageParam[] = []
  for (const m of history) {
    messages.push({
      role: m.role,
      content: m.content,
    })
  }

  // Current user turn: knowledge base blocks (oficial USCIS) + adjuntos +
  // texto. Orden importa: contexto autorizado PRIMERO para que Claude lo
  // tenga en mente al analizar los adjuntos del paralegal.
  const currentContent: Anthropic.Messages.ContentBlockParam[] = []

  // 1. Documentos oficiales (cacheados — costo marginal después del primer uso)
  currentContent.push(...knowledgeBlocks)

  // 2. Adjuntos del paralegal (PDF llenado que Diana quiere revisar, etc.)
  const unsupportedAttachments: string[] = []
  for (const a of attachments) {
    const block = attachmentToContentBlock(a)
    if (block) {
      currentContent.push(block)
    } else {
      unsupportedAttachments.push(`${a.filename} (${a.mime_type})`)
    }
  }

  // 3. Texto final del paralegal (siempre al final como marco de la consulta)
  const finalText = [
    userMessage || (currentContent.length > 0 ? '[adjunto]' : ''),
    unsupportedAttachments.length > 0
      ? `\n\n(Adjuntos no soportados por visión: ${unsupportedAttachments.join(', ')} — el modelo no puede leer este tipo de archivo.)`
      : '',
  ].join('').trim() || '[adjunto]'

  currentContent.push({ type: 'text', text: finalText })
  messages.push({ role: 'user', content: currentContent })

  // Create the streaming request. We cache the system prompt so a long
  // conversation (many turns) only pays it once.
  const stream = client.messages.stream(
    {
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      thinking: { type: 'adaptive' },
      system: [
        {
          type: 'text',
          text: CHAT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    },
    { signal }
  )

  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let inputTokens = 0
      let outputTokens = 0
      let cacheReadTokens = 0
      let cacheWriteTokens = 0

      try {
        // Subscribe to incremental text deltas. The SDK emits `text` events
        // with the text chunk each time a content_block_delta arrives.
        stream.on('text', (chunk: string) => {
          if (chunk) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
            )
          }
        })

        // Wait for the full message to collect usage stats.
        const finalMessage = await stream.finalMessage()

        inputTokens = finalMessage.usage?.input_tokens || 0
        outputTokens = finalMessage.usage?.output_tokens || 0
        cacheReadTokens = finalMessage.usage?.cache_read_input_tokens || 0
        cacheWriteTokens = finalMessage.usage?.cache_creation_input_tokens || 0

        log.info('chat stream complete', {
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheWriteTokens,
          stopReason: finalMessage.stop_reason,
          attachments: attachments.length,
        })

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              cache_read_tokens: cacheReadTokens,
              cache_write_tokens: cacheWriteTokens,
            })}\n\n`
          )
        )
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'stream error'
        log.error('chat stream failed', err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })
}

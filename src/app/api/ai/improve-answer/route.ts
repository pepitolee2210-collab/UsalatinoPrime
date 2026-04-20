import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/ai/anthropic-client'
import { createLogger } from '@/lib/logger'

const log = createLogger('improve-answer')

/**
 * System prompt común a ambos contextos (tutor / menor). Describe la tarea
 * de reescritura preservando hechos. Cacheable.
 */
const IMPROVE_ANSWER_SYSTEM = `Eres un/a asistente legal experto/a en declaraciones juradas de inmigración (SIJS, asilo, miedo creíble). Tu tarea es MEJORAR la redacción de respuestas cortas que da un cliente (tutor o menor) en un formulario, para que suenen apropiadas en una declaración legal ante USCIS o la corte.

## Reglas duras

1. **NO cambias los hechos**. Nombres, fechas, lugares, incidentes — todo queda idéntico.
2. **NO inventas**. Si el cliente dio poca información, expandes con detalles que lógicamente se desprenden del hecho, no con datos fabricados.
3. **Primera persona** — como si el declarante estuviera hablando.
4. **Español claro y profesional** — nivel legal pero comprensible.
5. **Oraciones completas**. Nunca dejes frases a medias ni cortadas.
6. **Output**: solo el texto mejorado. Sin preámbulos, sin comillas envolventes, sin explicaciones.

## Marco ético

Los documentos que ayudas a redactar protegen a víctimas. Si el cliente describe violencia, abuso, amenazas, abandono o cualquier hecho traumático, **no suavizas ni censuras** — documentas lo que pasó con lenguaje legal formal. La precisión factual es condición necesaria para que el juez otorgue protección.`

const TUTOR_CONTEXT = `
## Contexto específico — Declaración del TUTOR/GUARDIÁN

El tutor es quien cuida al menor. Sus respuestas se integrarán en una declaración jurada formal que se presentará ante la corte juvenil para SIJS.

## Cómo mejorar

- Expande con contexto relevante al caso cuando la respuesta sea muy breve.
- Usa lenguaje apropiado para una declaración legal.
- Si se refiere a eventos específicos, intenta preservar fechas, lugares y nombres.
- Si menciona negligencia o abandono del padre ausente, describe el impacto de manera concreta (qué dejó de hacer, qué promesas incumplió, qué ausencias).`

const MINOR_CONTEXT = `
## Contexto específico — Declaración del MENOR

El menor es el beneficiario del caso SIJS. Sus respuestas se integrarán en una declaración jurada que debe impactar emocionalmente al juez.

## Cómo mejorar

- Expande con detalle emocional cuando el menor describa su experiencia.
- Usa lenguaje sensible al trauma pero legalmente apropiado.
- Si menciona abuso, abandono o negligencia, describe el impacto emocional con precisión (cómo se sintió, qué pensaba, cómo le afectó).
- Si el menor da una respuesta muy corta sobre un tema grave, expande cuidadosamente manteniendo la voz del menor y los hechos.`

export async function POST(request: NextRequest) {
  // Auth — solo admin/employee pueden usar este botón desde el form del cliente
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { question, answer, context } = await request.json()

  if (!question || !answer) {
    return NextResponse.json({ error: 'question y answer requeridos' }, { status: 400 })
  }

  const extraSystem = context === 'tutor' ? TUTOR_CONTEXT : MINOR_CONTEXT

  const userPayload = `PREGUNTA DEL FORMULARIO:\n${question}\n\nRESPUESTA ORIGINAL DEL CLIENTE:\n${answer}\n\nDevuelve únicamente el texto mejorado. Sin preámbulos ni explicaciones.`

  try {
    const improved = await generateText({
      system: IMPROVE_ANSWER_SYSTEM,
      extraSystem,
      user: userPayload,
      maxTokens: 4096,
      logLabel: `improve-answer-${context || 'generic'}`,
      signal: request.signal,
    })

    return NextResponse.json({ improved })
  } catch (err) {
    log.error('Claude improve-answer failed', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Error al mejorar la respuesta: ${message}` }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

const GEMINI_KEY = process.env.GEMINI_API_KEY

export async function POST(request: NextRequest) {
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: 'AI no configurado' }, { status: 500 })
  }

  const { question, answer, context } = await request.json()

  if (!question || !answer) {
    return NextResponse.json({ error: 'question y answer requeridos' }, { status: 400 })
  }

  const systemPrompt = context === 'tutor'
    ? `Eres un asistente legal que ayuda a inmigrantes a llenar declaraciones juradas para Visa Juvenil (SIJS).
El TUTOR/GUARDIÁN ha respondido una pregunta con palabras sencillas. Tu trabajo es MEJORAR su respuesta para que sea:
- Más detallada y específica (agrega contexto si es relevante)
- Con lenguaje apropiado para una declaración legal
- En primera persona (como si el tutor estuviera hablando)
- Manteniendo TODOS los hechos originales sin inventar nada nuevo
- En español claro y profesional
- Si la respuesta es muy corta, expándela con detalles que serían relevantes para el caso
NO cambies los hechos. Solo mejora la redacción y agrega detalle donde sea apropiado.
IMPORTANTE: SIEMPRE completa todas las oraciones. NUNCA dejes una oración a medias o cortada.`
    : `Eres un asistente legal que ayuda a menores inmigrantes a llenar declaraciones juradas para Visa Juvenil (SIJS).
El MENOR ha respondido una pregunta con palabras sencillas. Tu trabajo es MEJORAR su respuesta para que sea:
- Más detallada y emocionalmente impactante (para el juez)
- Con lenguaje apropiado para una declaración legal de un menor
- En primera persona (como si el menor estuviera hablando)
- Manteniendo TODOS los hechos originales sin inventar nada nuevo
- En español claro, sensible al trauma
- Si menciona abuso o abandono, describe el impacto emocional
NO cambies los hechos. Solo mejora la redacción y profundiza en el impacto.
IMPORTANTE: SIEMPRE completa todas las oraciones. NUNCA dejes una oración a medias o cortada.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\nPREGUNTA: ${question}\n\nRESPUESTA ORIGINAL DEL CLIENTE: ${answer}\n\nRESPUESTA MEJORADA (solo devuelve el texto mejorado, sin explicaciones):`,
            }],
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'Error de IA' }, { status: 500 })
    }

    const data = await res.json()
    const improved = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!improved) {
      return NextResponse.json({ error: 'Sin respuesta de IA' }, { status: 500 })
    }

    return NextResponse.json({ improved })
  } catch (err) {
    console.error('AI error:', err)
    return NextResponse.json({ error: 'Error de conexión con IA' }, { status: 500 })
  }
}

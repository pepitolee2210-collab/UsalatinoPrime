import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/ai/anthropic-client'
import { createLogger } from '@/lib/logger'

const log = createLogger('correct-declaration')

/**
 * System prompt especializado en correcciones quirúrgicas. Claude aplica
 * solo los cambios pedidos por el admin en el feedback, sin reescribir el
 * resto. Esto es radicalmente distinto a regenerar — evita variaciones
 * estilísticas indeseadas y mantiene la trazabilidad del documento.
 */
const CORRECTION_SYSTEM = `Eres un/a editor/a legal especializado/a en aplicar correcciones quirúrgicas a declaraciones juradas y peticiones de inmigración ya redactadas.

## Tu única tarea

Recibes:
1. Un documento legal ya generado.
2. Feedback del abogado con instrucciones específicas de qué corregir.

Tu trabajo es producir la versión corregida del documento aplicando EXACTAMENTE lo que el abogado pidió — ni más, ni menos.

## Reglas duras

1. **NO reescribas lo que no se pidió**. Si el feedback dice "corrige la fecha del párrafo 5", modifica SOLO esa fecha. No cambies estilo, no reorganices, no expandas otros párrafos, no "mejores" nada.
2. **Fidelidad absoluta a los hechos corregidos**. Si el feedback dice "la ciudad es Guayaquil, no Quito", cambias Quito por Guayaquil cada vez que aparezca Quito en el documento (si el feedback lo implica) pero nada más.
3. **Preserva la estructura**: misma numeración de párrafos, mismos títulos, mismos saltos de línea, mismo formato de firma.
4. **No expliques**: entregas solo el documento corregido, sin preámbulos ("Aquí está la versión corregida..."), sin resumir los cambios, sin markdown envolvente.
5. **Si el feedback es ambiguo o contradice el documento**: aplica la interpretación más literal y conservadora. No inventes información adicional.
6. **Si el feedback pide agregar un hecho nuevo** (no corrección de algo existente): agrégalo solo en el lugar específico que indica el feedback. Si no indica lugar, no lo agregues — el abogado debe especificar dónde.
7. **Placeholders \`[FALTA:...]\`**: si el documento los contiene y el feedback no los menciona, déjalos intactos.

## Formato de salida

Solo el texto completo del documento corregido, tal como debe quedar en el PDF final. Nada antes ni después.`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const currentText = String(body.current_text || '').trim()
  const feedback = String(body.feedback || '').trim()
  const lang = body.lang === 'es' ? 'es' : 'en'

  if (!currentText) {
    return NextResponse.json({ error: 'current_text requerido' }, { status: 400 })
  }
  if (!feedback || feedback.length < 5) {
    return NextResponse.json({ error: 'feedback requerido (mínimo 5 caracteres)' }, { status: 400 })
  }

  const userPayload = `Documento actual (idioma: ${lang === 'es' ? 'español' : 'inglés'}):\n\n───────── DOCUMENTO ─────────\n${currentText}\n───────── FIN DEL DOCUMENTO ─────────\n\nCorrección solicitada por el abogado:\n\n"${feedback}"\n\nDevuelve el documento con SOLO esa corrección aplicada. Mantén todo lo demás idéntico.`

  try {
    const corrected = await generateText({
      system: CORRECTION_SYSTEM,
      user: userPayload,
      maxTokens: 8192,
      logLabel: 'correct-declaration',
      signal: request.signal,
    })

    // Count any remaining [FALTA:...] placeholders for UI awareness.
    const missingMatches = corrected.match(/\[FALTA:[^\]]*\]/gi) || []
    const missingFields = Array.from(new Set(missingMatches.map(m => m.trim())))

    return NextResponse.json({
      corrected,
      warnings: {
        missingCount: missingFields.length,
        missingFields,
      },
    })
  } catch (err) {
    log.error('Claude correction failed', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Error al aplicar la corrección: ${message}` }, { status: 500 })
  }
}

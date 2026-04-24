import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { DetectedField } from './acroform-service'
import { createLogger } from '@/lib/logger'

const log = createLogger('acroform-suggestions')

const MODEL = 'claude-opus-4-7'

interface CaseContextForSuggestions {
  caseNumber?: string | null
  clientName?: string | null
  clientPassport?: string | null
  clientDOB?: string | null
  clientAddress?: string | null
  clientCity?: string | null
  clientState?: string | null
  clientZip?: string | null
  minors?: Array<{
    fullName: string
    dob?: string | null
    countryOfBirth?: string | null
  }>
  courtName?: string | null
  abandonmentDetails?: string | null  // ej: "padre abandonó en 2018"
  motherName?: string | null
  fatherName?: string | null
}

const SystemPrompt = `Eres una asistente legal senior especializada en Visa Juvenil (SIJS) en EE.UU. Recibirás:
1. Un formulario oficial (schema de campos detectados).
2. El contexto de un caso real de SIJS.

Tu trabajo: para cada campo, decidir dos cosas:
a) Si el campo es RELEVANTE para este caso SIJS (sijs_relevant: true/false).
b) Un valor sugerido (ai_suggestion) para los relevantes, basado en el contexto del caso.

REGLAS ESTRICTAS:
- Si no tienes info suficiente para un campo, déjalo con ai_suggestion=null y sijs_relevant=false. NUNCA inventes.
- Los formularios suelen ser multi-uso (custody, divorce, support, guardianship). Marca como sijs_relevant=false los campos que aplican a otro tipo de caso (ej: "spouse name", "date of marriage", "reason for divorce") si no son relevantes para una petición de tutela de menor abandonado.
- Para campos como "petitioner", "minor/child", "parent", "address" → típicamente son SIJS-relevantes y puedes sugerir valor.
- Para checkboxes que pregunten el tipo de caso → selecciona "guardianship" o "SIJS" o "custody" según lo que ofrezca el form.
- Razona brevemente en ai_reasoning (max 1 oración) por qué sugeriste ese valor (auditable).
- Output: JSON estricto con un array "suggestions" que mapea por name del campo.

FORMATO DE OUTPUT (JSON estricto, sin markdown, sin prosa):
{
  "suggestions": [
    {
      "name": "petitioner_full_name",
      "sijs_relevant": true,
      "ai_suggestion": "María García López",
      "ai_reasoning": "Nombre del cliente tal como está en el contrato."
    },
    {
      "name": "date_of_marriage",
      "sijs_relevant": false,
      "ai_suggestion": null,
      "ai_reasoning": "Campo de divorcio, no aplica a tutela SIJS."
    }
  ]
}`

const SuggestionSchema = z.object({
  suggestions: z.array(z.object({
    name: z.string(),
    sijs_relevant: z.boolean(),
    ai_suggestion: z.string().nullable().optional().transform(v => v ?? null),
    ai_reasoning: z.string().nullable().optional().transform(v => v ?? null),
  })),
})

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')
  _client = new Anthropic({ apiKey })
  return _client
}

/**
 * Dado un schema de campos + contexto del caso, Claude devuelve por CADA
 * campo: si es relevante para SIJS + un valor sugerido + razonamiento.
 *
 * El panel UI muestra primero los campos sijs_relevant=true con el valor
 * pre-llenado (editable por el usuario), y los no-relevantes en una
 * sección colapsada "Campos adicionales del formulario".
 */
export async function suggestFieldValues(
  fields: DetectedField[],
  context: CaseContextForSuggestions,
): Promise<DetectedField[]> {
  if (fields.length === 0) return []

  const client = getClient()

  const userPrompt = `## Esquema del formulario (campos detectados)

${JSON.stringify(fields.map(f => ({
  name: f.name,
  label: f.label,
  type: f.type,
  required: f.required,
  options: f.options,
})), null, 2)}

## Contexto del caso SIJS

${JSON.stringify(context, null, 2)}

Para cada campo del array anterior (y SOLO esos), decide sijs_relevant + ai_suggestion + ai_reasoning.

Devuelve SOLO el JSON con { "suggestions": [...] } sin texto alrededor.`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SystemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text).join('').trim()

  // Extraer JSON balanceado (Claude a veces envuelve en prosa).
  let jsonText = text
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  }
  const first = jsonText.indexOf('{')
  const last = jsonText.lastIndexOf('}')
  if (first !== -1 && last > first) jsonText = jsonText.slice(first, last + 1)

  let parsed: z.infer<typeof SuggestionSchema>
  try {
    parsed = SuggestionSchema.parse(JSON.parse(jsonText))
  } catch (err) {
    log.error('AI suggestions: JSON inválido', { preview: text.slice(0, 400), err })
    // Degradamos grácilmente: devolvemos los fields sin sugerencias.
    return fields.map(f => ({ ...f, sijs_relevant: true }))
  }

  // Merge por name
  const byName = new Map(parsed.suggestions.map(s => [s.name, s]))

  return fields.map(f => {
    const sug = byName.get(f.name)
    if (!sug) return { ...f, sijs_relevant: true }
    return {
      ...f,
      sijs_relevant: sug.sijs_relevant,
      ai_suggestion: sug.ai_suggestion ?? undefined,
      ai_reasoning: sug.ai_reasoning ?? undefined,
    }
  })
}

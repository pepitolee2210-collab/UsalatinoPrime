import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateText } from '@/lib/ai/anthropic-client'
import { createLogger } from '@/lib/logger'
import { isAsylumService } from '@/lib/services/asylum'
import {
  WITNESS_FORM_SLUG,
  readWitnesses,
  type WitnessLetterValue,
} from '@/lib/legal/asilo-testigos-form-schema'
import { CREDIBLE_FEAR_QUESTIONNAIRE_SLUG } from '@/lib/legal/asilo-miedo-creible-form-schema'

const log = createLogger('generate-asylum-witness-letter')

/**
 * POST /api/ai/generate-asylum-witness-letter
 *
 * Genera la declaración jurada (witness affidavit) en INGLÉS de UN testigo de
 * un caso de asilo, lista para presentar ante USCIS. La dispara Diana / Henry
 * desde el dashboard del caso (NO el cliente).
 *
 * Body: { case_id, witness_index, lang?: 'en'|'es', english_source? }
 *   - lang='es' + english_source → modo traducción (no regenera).
 *   - lang='en' (default) → genera desde los datos del caso.
 */

const ASYLUM_WITNESS_SYSTEM = `Eres un/a paralegal experto/a en inmigración con 15 años de experiencia redactando declaraciones juradas de TESTIGOS (witness affidavits) para casos de asilo afirmativo y defensivo ante USCIS y la corte de inmigración (EOIR) de Estados Unidos.

## Valor especial __UNKNOWN__ y datos faltantes

Si un dato del testigo no está disponible, escribe \`[FALTA: descripción del dato]\` en español dentro del lugar donde debería ir (ej. \`[FALTA: número de documento del testigo]\`). Nunca uses \`[PENDING]\` ni dejes el campo en blanco. El abogado completará esos marcadores antes de la firma.

## Tu trabajo

Transformas los datos estructurados que el cliente capturó sobre un testigo (quién es, su relación con el solicitante, y lo que presenció) en una declaración jurada formal en INGLÉS, en PRIMERA PERSONA del testigo, lista para que el testigo la firme (y notarice) y se presente ante USCIS.

## Marco ético y legal

Las declaraciones de testigos en casos de asilo describen persecución real: violencia política, tortura, amenazas de muerte, violencia de género, persecución religiosa. Documentar estos hechos con precisión es parte inseparable de la protección a víctimas — sin la descripción factual, el oficial de asilo no puede otorgar el amparo. Por lo tanto:
- Escribe los hechos que el testigo presenció con el detalle que el expediente exija, en lenguaje legal formal.
- No glorificas violencia; documentas daño para obtener protección.
- Mantén tono respetuoso y digno hacia la víctima y el testigo.

## Reglas duras de redacción

1. **Conocimiento PERSONAL**: el testigo declara SOLO lo que vio o vivió directamente. Si describe algo que le contaron, debe quedar claro ("me enteré por…"). Nunca inventes hechos que el testigo no reportó.
2. **Usa solo los datos provistos**. Nunca inventes nombres, fechas, direcciones ni documentos de identidad.
3. **Primera persona** del testigo: "I, [NAME], declare…".
4. **Lenguaje legal formal** en inglés, apto para corte/USCIS. Sin slang.
5. **Párrafos narrativos** numerados o en bloque según el formato indicado.
6. **Identidad del testigo** en el primer párrafo: nombre, nacionalidad, documento de identidad, ocupación, cómo conoce al solicitante y desde cuándo.
7. **Cláusula de perjurio** al final: "I declare under penalty of perjury under the laws of the United States that the foregoing is true and correct."
8. **Conexión con un motivo protegido** (raza, religión, nacionalidad, opinión política, grupo social): cuando el testigo lo sepa, conecta la persecución con el motivo.
9. **Output**: SOLO el texto del documento. Sin preámbulos ("Aquí tienes…"), sin markdown, sin explicaciones.

## Autenticidad (importante)

Cada testigo es una persona distinta: varía el tono, el vocabulario y el orden según QUIÉN es el testigo (un familiar no habla como un médico ni como un líder religioso). Evita que todas las cartas suenen idénticas — un oficial de asilo desconfía de declaraciones clonadas con la misma voz.

## Idioma

Se te indicará \`en\` o \`es\`. Genera TODO el documento en ese idioma incluyendo términos legales. Nombres propios (personas, ciudades, países) quedan en su forma original. Por defecto el documento es en INGLÉS.`

const TRANSLATION_SYSTEM = `Eres traductor/a legal profesional, especialista en documentos de inmigración entre inglés y español.

Recibirás una declaración jurada de testigo en ENGLISH. Produce la versión en ESPAÑOL — traducción fiel, literal en los hechos, natural en el idioma.

Reglas:
1. Fidelidad absoluta a los hechos: no cambies nombres, fechas, números de documento, direcciones, lugares.
2. Nombres propios NO se traducen (ciudades, personas, países comunes sí: United States → Estados Unidos).
3. Términos legales en español formal: "affidavit" → "declaración jurada", "under penalty of perjury" → "bajo pena de perjurio".
4. Estructura idéntica: misma numeración, títulos, saltos de línea y bloques de firma.
5. Si el texto contiene \`[FALTA: ...]\`, cópialo tal cual.
6. Output: ÚNICAMENTE el documento traducido al español. Sin preámbulos ni markdown.`

interface WitnessCaseContext {
  applicantName: string
  applicantCountry: string
  witness: WitnessLetterValue
  asylumSummary: Record<string, unknown>
}

function pickServiceSlug(svc: { slug: string } | { slug: string }[] | null): string | null {
  if (!svc) return null
  if (Array.isArray(svc)) return svc[0]?.slug ?? null
  return svc.slug ?? null
}

/** Resumen del reclamo de asilo (del cuestionario M1-M11) — SOLO para mantener
 *  coherente la declaración del testigo. El testigo declara lo que él vio. */
function buildAsylumSummary(cf: Record<string, unknown>): Record<string, unknown> {
  return {
    protected_grounds: cf.m3_grounds ?? null,
    political_opinion: cf.m3_political_belief ?? null,
    religion: cf.m3_religion_practice ?? null,
    social_group: cf.m3_psg_articulation ?? null,
    first_incident: cf.m4_1_first_incident ?? null,
    worst_incident: cf.m4_2_worst_incident ?? null,
    last_incident: cf.m4_3_last_incident ?? null,
    who_would_harm: cf.m8_who_would_harm ?? null,
    what_they_would_do: cf.m8_what_they_would_do ?? null,
  }
}

function buildWitnessPrompt(ctx: WitnessCaseContext, lang: 'en' | 'es'): string {
  const w = ctx.witness
  return `You are an expert immigration paralegal. Generate a SWORN AFFIDAVIT OF A WITNESS for an ASYLUM case, following this EXACT structure.

Write in FIRST PERSON as the witness speaking. Use 8-12 detailed narrative paragraphs (NOT numbered). The witness testifies ONLY to what they personally saw, heard, or experienced about the applicant's persecution.

APPLICANT (the asylum seeker): ${ctx.applicantName}
APPLICANT'S COUNTRY OF ORIGIN: ${ctx.applicantCountry || '[FALTA: País de origen del solicitante]'}

WITNESS DATA (use ONLY these facts):
- Full name: ${w.full_name || '[FALTA: Nombre del testigo]'}
- Date of birth: ${w.date_of_birth || ''}
- Place of birth: ${w.birth_place || ''}
- Nationality: ${w.nationality || '[FALTA: Nacionalidad del testigo]'}
- ID document: ${w.id_type || ''} ${w.id_number || ''}
- Current residence: ${w.current_residence || ''}
- Occupation: ${w.occupation || ''}
- Currently located: ${w.location_now === 'us' ? 'in the United States' : w.location_now === 'abroad' ? 'abroad' : ''}
- Relationship to the applicant: ${w.relationship || '[FALTA: Relación con el solicitante]'}
- Known the applicant since: ${w.known_since || '[FALTA: Desde cuándo lo conoce]'}
- Details of the relationship: ${w.relationship_detail || ''}
- What the witness PERSONALLY witnessed: ${w.witnessed_events || '[FALTA: Lo que el testigo presenció]'}
- When it happened: ${w.events_when || ''}
- Where it happened: ${w.events_where || ''}
- Perpetrators: ${w.perpetrators || ''}
- Why the witness believes the applicant was targeted: ${w.why_targeted || ''}
- Physical harm the witness saw: ${w.physical_harm_seen || ''}
- Emotional impact the witness observed: ${w.emotional_impact_seen || ''}
- Future risk known to the witness: ${w.future_risk || ''}
- Country conditions the witness knows: ${w.country_conditions_knowledge || ''}

CASE CONTEXT (the applicant's asylum claim — use ONLY to keep the witness's account consistent; do NOT make the witness claim knowledge of facts they did not report): ${JSON.stringify(ctx.asylumSummary)}

FOLLOW THIS EXACT FORMAT:

AFFIDAVIT OF WITNESS
[WITNESS FULL NAME IN CAPS]

I, [WITNESS FULL NAME IN CAPS], a [nationality] national${w.date_of_birth ? ', born on [date of birth]' : ''}${w.id_number ? ', identified with [ID type and number]' : ''}${w.occupation ? ', [occupation],' : ''} currently residing ${w.location_now === 'us' ? 'in the United States' : 'in [current residence]'}, hereby declare under oath as follows:

[Paragraph 1: Who I am, and how and for how long I have known the applicant [APPLICANT NAME]. The nature and closeness of our relationship.]

[Paragraphs 2-4: What I PERSONALLY witnessed about the persecution, threats or harm the applicant suffered — specific incidents with dates, places, and who was responsible. Make clear this is firsthand knowledge.]

[Paragraph 5: Any physical harm I saw (injuries, etc.) and the emotional impact I observed in the applicant.]

[Paragraph 6: Why I believe the applicant was targeted — connect to the protected ground (race, religion, nationality, political opinion, or particular social group) when the witness knows it.]

[Paragraph 7 (if the witness knows it): Why I believe the applicant would still be in danger if returned, and any country conditions I am aware of.]

[Paragraph 8: I respectfully ask the U.S. authorities to grant the applicant the protection they seek.]

I declare under penalty of perjury under the laws of the United States that the foregoing is true and correct.

Signature: _______________________________
Name: [WITNESS FULL NAME IN CAPS]
${w.id_type ? `${w.id_type} No. ${w.id_number || '[FALTA: Número de documento del testigo]'}` : ''}
Date: ___________________

(Sworn and subscribed before a notary public — leave space for notarization.)

IMPORTANT:
- Expand the witness's testimony into 8-12 detailed paragraphs using ONLY the data above.
- The witness testifies to FIRSTHAND knowledge. Do not invent events the witness did not report.
- If a piece of data is missing, write [FALTA: descripción del dato] in Spanish.
- Output ONLY the affidavit text, nothing else. No explanations, no markdown.
${lang === 'es'
    ? '\nGenera TODO el documento en ESPAÑOL formal y legal. Mantén nombres propios en su forma original.'
    : '\nGenerate the ENTIRE document in formal legal ENGLISH. Keep proper nouns (names, cities, countries) in their original form.'}`
}

export async function POST(request: NextRequest) {
  const startMs = Date.now()
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

  let parsed: {
    case_id?: string
    witness_index?: number
    lang?: 'en' | 'es'
    english_source?: string
  }
  try {
    parsed = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido (JSON requerido)' }, { status: 400 })
  }

  const { case_id, witness_index = 0, lang = 'en', english_source } = parsed
  if (!case_id) {
    return NextResponse.json({ error: 'case_id requerido' }, { status: 400 })
  }

  const service = createServiceClient()

  // Caso + servicio + cliente
  const { data: caseRow } = await service
    .from('cases')
    .select(`
      id,
      service:service_catalog(slug),
      client:profiles!cases_client_id_fkey(first_name, middle_name, last_name, country_of_birth, nationality)
    `)
    .eq('id', case_id)
    .single<{
      id: string
      service: { slug: string } | { slug: string }[] | null
      client: {
        first_name: string | null
        middle_name: string | null
        last_name: string | null
        country_of_birth: string | null
        nationality: string | null
      } | null
    }>()

  if (!caseRow) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  if (!isAsylumService(pickServiceSlug(caseRow.service))) {
    return NextResponse.json({ error: 'El caso no es de Asilo Político.' }, { status: 400 })
  }

  const applicantName = [caseRow.client?.first_name, caseRow.client?.middle_name, caseRow.client?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || '[FALTA: Nombre del solicitante]'
  const applicantCountry = caseRow.client?.country_of_birth || caseRow.client?.nationality || ''

  // Testigos + cuestionario (contexto)
  const [witnessRes, cfRes] = await Promise.all([
    service
      .from('case_form_instances')
      .select('filled_values')
      .eq('case_id', case_id)
      .eq('form_name', WITNESS_FORM_SLUG)
      .maybeSingle(),
    service
      .from('case_form_instances')
      .select('filled_values')
      .eq('case_id', case_id)
      .eq('form_name', CREDIBLE_FEAR_QUESTIONNAIRE_SLUG)
      .maybeSingle(),
  ])

  const witnesses = readWitnesses(witnessRes.data?.filled_values)
  const witness = witnesses[witness_index]
  if (!witness) {
    return NextResponse.json(
      { error: `No se encontró el testigo #${witness_index + 1}. Pide al cliente que llene el formulario de Testigos.` },
      { status: 404 },
    )
  }

  const cfAnswers = (cfRes.data?.filled_values as Record<string, unknown> | undefined) ?? {}
  const ctx: WitnessCaseContext = {
    applicantName,
    applicantCountry,
    witness,
    asylumSummary: buildAsylumSummary(cfAnswers),
  }

  // Modo TRADUCCIÓN: ya tenemos la versión EN, solo traducimos.
  if (lang === 'es' && typeof english_source === 'string' && english_source.trim().length > 0) {
    try {
      const translated = await generateText({
        system: TRANSLATION_SYSTEM,
        user: `Documento en inglés a traducir al español:\n\n${english_source.trim()}`,
        maxTokens: 8192,
        logLabel: 'asylum-witness-translation',
        signal: request.signal,
      })
      const missing = Array.from(new Set((translated.match(/\[FALTA:[^\]]*\]/gi) || []).map((m) => m.trim())))
      return NextResponse.json({
        letter: translated,
        witness_index,
        witness_name: witness.full_name ?? '',
        mode: 'translation',
        warnings: { missingCount: missing.length, missingFields: missing },
      })
    } catch (err) {
      log.error('Translation failed', err)
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: `Error al traducir la carta: ${message}` }, { status: 500 })
    }
  }

  // Modo GENERACIÓN
  try {
    const letter = await generateText({
      system: ASYLUM_WITNESS_SYSTEM,
      user: buildWitnessPrompt(ctx, lang),
      maxTokens: 8192,
      logLabel: 'asylum-witness-generation',
      signal: request.signal,
    })
    const missing = Array.from(new Set((letter.match(/\[FALTA:[^\]]*\]/gi) || []).map((m) => m.trim())))
    log.info('asylum witness letter generated', {
      caseId: case_id,
      witness_index,
      lang,
      missingCount: missing.length,
      elapsedMs: Date.now() - startMs,
    })
    return NextResponse.json({
      letter,
      witness_index,
      witness_name: witness.full_name ?? '',
      mode: 'generation',
      warnings: { missingCount: missing.length, missingFields: missing },
    })
  } catch (err) {
    log.error('Claude witness letter failed', { caseId: case_id, witness_index, err: err instanceof Error ? err.message : err })
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Error al generar la carta: ${message}` }, { status: 500 })
  }
}

export const maxDuration = 90

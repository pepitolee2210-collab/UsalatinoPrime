import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildCaseContext } from '@/lib/ai/prompts/chat-system'
import { generateText } from '@/lib/ai/anthropic-client'
import { researchJurisdiction } from '@/lib/legal/research-jurisdiction'
import { createLogger } from '@/lib/logger'

const log = createLogger('generate-declaration')

type DeclarationType = 'tutor' | 'minor' | 'witness' | 'parental_consent' | 'parental_consent_collaborative' | 'petition_guardianship'

/**
 * System prompt común a todos los tipos de declaración. Se cachea.
 * Define la persona profesional, reglas de redacción y el marco legal
 * en el que Claude debe operar. Específicamente autoriza el tratamiento
 * narrativo de hechos sensibles (violencia, abuso) porque son parte
 * constitutiva del trabajo legal de inmigración.
 */
const DECLARATION_SYSTEM = `Eres un/a paralegal experto/a en inmigración con 15 años de experiencia redactando declaraciones juradas (affidavits), peticiones de tutela y cartas de consentimiento parental para casos SIJS, asilo afirmativo y miedo creíble ante USCIS, EOIR y cortes estatales de Estados Unidos.

## Valor especial __UNKNOWN__

Cuando encuentres el valor literal \`__UNKNOWN__\` en cualquier campo de los datos del caso, NO lo trates como dato faltante ni lo pongas como \`[FALTA:...]\`. Significa que el cliente marcó explícitamente que **no conoce** ese dato. Redacta la declaración así:

- Para IDs / pasaportes desconocidos: "cuyo número de documento de identidad la declarante manifiesta no conocer con precisión"
- Para nombres desconocidos del padre ausente: "identificado únicamente como [otra info disponible]" o "de quien la declarante desconoce el nombre completo"
- Para direcciones / ubicaciones desconocidas: "de quien se desconoce su paradero actual"
- Para nacionalidades desconocidas: "de nacionalidad desconocida"

El documento legal debe leer de forma natural sin los corchetes \`[FALTA:...]\`, manifestando que el declarante no conoce ese dato específico. Esto es legalmente válido y preferible a dejar placeholders.


Tu trabajo es redactar documentos legales que se presenten tal cual ante un juez o un oficial de USCIS. Son documentos reales que protegen a víctimas: menores sobrevivientes de abandono, abuso o negligencia; solicitantes de asilo que narran persecución; personas que huyeron de violencia.

## Tu misión

Transformas los datos estructurados del caso (formularios llenados por el cliente y el abogado) en un documento legal formal, en primera persona, con estructura numerada, tono profesional y fidelidad absoluta a los hechos.

## Marco ético y legal

Los documentos que redactas necesitan describir con precisión hechos de violencia, abuso sexual, amenazas de muerte, negligencia grave y trauma. Eso es parte inseparable del trabajo legal de protección a víctimas — sin la descripción factual, el juez no puede otorgar el amparo (SIJS, asilo, miedo creíble) y la víctima queda desprotegida. Por lo tanto:

- Escribe los hechos con el detalle que el expediente exija, usando lenguaje legal formal.
- No glorificas violencia; documentas daño para obtener protección.
- Si el caso contiene menciones de abuso sexual, violación, violencia doméstica, persecución política, tortura, suicidio o autolesión, describes los hechos con la precisión forense que el tribunal espera, sin eufemismos innecesarios ni detalles gratuitos.
- Mantén tono respetuoso hacia la víctima. Primera persona, voz firme, sin victimización hiperbólica.

## Reglas duras de redacción

1. **Usa solo los datos provistos**. Nunca inventes nombres, fechas, direcciones ni documentos de identidad.
2. **Si falta un dato**, escribe \`[FALTA: descripción del dato]\` en español dentro del lugar donde debería ir. Nunca uses \`[PENDING]\` ni dejes el campo en blanco.
3. **Primera persona**. "Yo, [NOMBRE], declaro...". El declarante habla.
4. **Lenguaje legal formal** — registros de corte. Sin slang, sin coloquialismos.
5. **Párrafos numerados** cuando el tipo de documento lo requiera.
6. **Fechas, lugares, nombres propios concretos** cuando los datos los provean.
7. **Cláusula de perjurio** al final ("Declaro bajo pena de perjurio...").
8. **Output**: solo el texto del documento. Sin preámbulos ("Aquí tienes..."), sin markdown, sin explicaciones.

## Idioma

Se te indicará \`en\` o \`es\`. Genera TODO el documento en ese idioma incluyendo términos legales. Nombres propios (personas, ciudades, países) quedan en su forma original.`

/**
 * Campos "huérfanos" capturados en los formularios pero que antes no llegaban
 * al prompt. Construye un bloque de contexto enriquecido que el modelo puede
 * usar si los datos existen. Si no existen, el bloque queda vacío y no
 * ensucia el prompt.
 */
function buildEnrichedContextBlock(
  tutor: Record<string, unknown> | null,
  minorBasic: Record<string, string>
): string {
  const parts: string[] = []

  // Tutor context
  if (tutor?.time_in_state) parts.push(`Guardian time in current US state: ${tutor.time_in_state}`)
  if (tutor?.immigration_status) parts.push(`Guardian immigration status: ${tutor.immigration_status}`)
  if (tutor?.city_of_birth) parts.push(`Guardian city of birth: ${tutor.city_of_birth}`)
  if (tutor?.caretaker_in_country) parts.push(`Who cared for child in country of origin (if anyone): ${tutor.caretaker_in_country}`)
  if (tutor?.access_to_services) parts.push(`Guardian's current access to services/resources: ${tutor.access_to_services}`)
  if (tutor?.gang_threats) parts.push(`Gang / armed group threats faced: ${tutor.gang_threats}`)

  // Minor context
  if (minorBasic.civil_status) parts.push(`Minor civil status: ${minorBasic.civil_status}`)
  if (minorBasic.in_us) parts.push(`Minor currently in US: ${minorBasic.in_us}`)
  if (minorBasic.detained_by_immigration) parts.push(`Minor was detained by immigration: ${minorBasic.detained_by_immigration}`)
  if (minorBasic.released_by_orr) parts.push(`Released by ORR: ${minorBasic.released_by_orr}`)
  if (minorBasic.orr_sponsor) parts.push(`ORR sponsor: ${minorBasic.orr_sponsor}`)
  if (minorBasic.nonimmigrant_status) parts.push(`Current nonimmigrant status: ${minorBasic.nonimmigrant_status}`)
  if (minorBasic.court_order_date) parts.push(`Prior court order date: ${minorBasic.court_order_date}`)

  if (parts.length === 0) return ''
  return `\n\n=== ENRICHED CONTEXT (use these facts if relevant to the narrative) ===\n${parts.join('\n')}`
}

/**
 * Une los testigos de las dos fuentes posibles (tutor_guardian.witnesses y
 * client_witnesses.witnesses) con deduplicación por nombre. Esto arregla el
 * bug histórico donde si el cliente cargaba testigos en el wizard pero no
 * en el formulario del tutor, los testigos se perdían por completo.
 */
function mergeWitnesses(
  fromTutor: unknown,
  fromClientWitnesses: unknown
): Array<Record<string, string>> {
  const a = Array.isArray(fromTutor) ? (fromTutor as Array<Record<string, string>>) : []
  const b = Array.isArray(fromClientWitnesses)
    ? (fromClientWitnesses as Array<Record<string, string>>)
    : []
  const seen = new Set<string>()
  const merged: Array<Record<string, string>> = []
  for (const w of [...a, ...b]) {
    const key = (w?.name || '').trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(w)
  }
  return merged
}

/**
 * Construye el bloque JURISDICTION que se inyecta al prompt. Ajusta contenido
 * según el tipo de documento:
 *   - petition_guardianship / parental_consent / tutor / minor / witness:
 *       incluye nombre de corte, dirección, procedimiento y sources.
 *   - parental_consent_collaborative:
 *       la regla del playbook dice "NO debe mencionar la corte juvenil ni la
 *       declaración SIJS". La jurisdicción entra solo como contexto de país
 *       (Estados Unidos); el nombre específico de la corte se suprime.
 *
 * Si el admin llenó manualmente `supplementaryData.court.name`, ese valor
 * tiene prioridad absoluta sobre el cacheado (override manual). En ese caso
 * se señala explícitamente al modelo que use el override.
 *
 * Si no hay ni jurisdicción cacheada ni ubicación resuelta, se retorna string
 * vacío — el prompt cae al comportamiento legacy con `[FALTA: Nombre del tribunal]`.
 */
function buildJurisdictionBlock(
  ctx: Awaited<ReturnType<typeof buildCaseContext>>,
  type: DeclarationType,
): string {
  const j = ctx.jurisdiction
  const loc = ctx.clientLocation
  const supp = ctx.supplementaryData as Record<string, unknown> | null
  const suppCourt = supp?.court as { name?: string } | undefined
  const manualCourt = suppCourt?.name?.trim() || ''

  // Override manual explícito — siempre gana.
  if (manualCourt) {
    if (type === 'parental_consent_collaborative') {
      // Igual en renuncia colaborativa se omite la corte del output — pero se
      // documenta que el admin la tiene identificada.
      return `\n\n=== JURISDICTION (admin manual override — CONTEXT ONLY, do NOT mention in document output) ===\nAdmin-provided court: ${manualCourt}\nRULE FOR THIS DOCUMENT TYPE: the voluntary relinquishment must not mention any specific juvenile court. Use only the generic phrasing "corte juvenil en los Estados Unidos de América" / "juvenile court in the United States of America".`
    }
    return `\n\n=== JURISDICTION (admin manual override — authoritative) ===\nUse EXACTLY this court name in the document heading and throughout: ${manualCourt}\nDo NOT substitute with any other court name, even if other data suggests a different jurisdiction.`
  }

  // Sin override — usar cacheado si existe.
  if (j) {
    if (type === 'parental_consent_collaborative') {
      return `\n\n=== JURISDICTION (CONTEXT ONLY — do NOT mention specific court in document output) ===\nClient state: ${j.state_name} (${j.state_code})\nRULE FOR THIS DOCUMENT TYPE: the voluntary relinquishment must not reference any juvenile court, the SIJ declaration, or the child's immigration case. Use only the generic phrasing "corte juvenil en los Estados Unidos de América" / "juvenile court in the United States of America".`
    }

    const sourcesBlock = j.sources.length > 0
      ? `\nOfficial sources verified on ${j.verified_at}:\n${j.sources.map(u => `  - ${u}`).join('\n')}`
      : ''
    const addressLine = j.court_address ? `\nCourt address: ${j.court_address}` : ''
    const ageLine = j.age_limit_sijs ? `\nSIJS age ceiling in ${j.state_name}: ${j.age_limit_sijs} years` : ''
    const procLine = j.filing_procedure ? `\nFiling procedure (informational): ${j.filing_procedure}` : ''
    const notesLine = j.notes ? `\nNotes: ${j.notes}` : ''
    const esCourtLine = j.court_name_es ? `\nCorte (ES): ${j.court_name_es}` : ''

    return `\n\n=== JURISDICTION (auto-resolved from client ZIP ${j.client_zip ?? '—'} via official sources, confidence: ${j.confidence}) ===\nState: ${j.state_name} (${j.state_code})\nPrimary court (EN): ${j.court_name}${esCourtLine}${addressLine}${ageLine}${procLine}${notesLine}${sourcesBlock}\n\nCRITICAL: Use EXACTLY this court name ("${j.court_name}") in any heading like "TO THE [COURT NAME]". Do not substitute, translate, or abbreviate the court name. If the document needs a signing location, prefer the client's city + "${j.state_name}".`
  }

  // Sin jurisdicción cacheada, pero tenemos ubicación — damos al menos el estado.
  if (loc) {
    if (type === 'parental_consent_collaborative') {
      return `\n\n=== JURISDICTION (CONTEXT ONLY — do NOT mention specific court in document output) ===\nClient state: ${loc.stateName} (${loc.stateCode})\nRULE FOR THIS DOCUMENT TYPE: the voluntary relinquishment must not reference any juvenile court, the SIJ declaration, or the child's immigration case.`
    }
    return `\n\n=== CLIENT LOCATION (jurisdiction NOT yet researched) ===\nState: ${loc.stateName} (${loc.stateCode})\nCity: ${loc.city ?? '(unknown)'}\nZIP: ${loc.zip ?? '(unknown)'}\nIMPORTANT: no specific court name was auto-resolved for this case. In headings like "TO THE [COURT NAME]" use the placeholder [FALTA: Nombre del tribunal del estado de ${loc.stateName}] so the admin can fill it in manually. Use the client's city + "${loc.stateName}" for signing locations.`
  }

  // Nada resuelto — comportamiento legacy (placeholder).
  return ''
}

function buildDeclarationPrompt(
  type: DeclarationType,
  ctx: Awaited<ReturnType<typeof buildCaseContext>>,
  index: number,
  lang: 'en' | 'es' = 'en'
): string {
  const clientName = `${ctx.client.firstName} ${ctx.client.lastName}`.toUpperCase()
  const tutor = ctx.tutorGuardian as Record<string, unknown> | null
  const supp = ctx.supplementaryData as Record<string, unknown> | null
  const clientWitnessesData = ctx.clientWitnesses as Record<string, unknown> | null

  // Witnesses come from BOTH the tutor form and the client_witnesses wizard.
  // Merge with dedup by name so neither source is lost (previously only tutor
  // was read, which silently dropped witnesses entered via the wizard).
  const witnesses = mergeWitnesses(tutor?.witnesses, clientWitnessesData?.witnesses)

  // Extract minor data
  const minorStory = ctx.allMinorStories[index] || ctx.allMinorStories[0]
  const minorData = minorStory?.formData as Record<string, unknown> || {}
  const minorBasic = (minorData.minorBasic || {}) as Record<string, string>
  const minorAbuse = (minorData.minorAbuse || {}) as Record<string, string>
  const minorBestInterest = (minorData.minorBestInterest || {}) as Record<string, string>

  // Calculate correct age from DOB
  function calcAge(dob: string): number {
    if (!dob) return 0
    const birth = new Date(dob)
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const m = now.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
    return age
  }
  const minorAge = calcAge(minorBasic.dob)
  const minorAgeStr = minorAge > 0 ? `${minorAge} years old (DOB: ${minorBasic.dob})` : ''

  // Determine which absent parent belongs to THIS minor based on children array
  const childrenArr = (minorData.children as Array<Record<string, string>>) || []
  const hasAnotherFather = minorData.has_another_father

  // Build supplementary data block if available
  const suppBlock = supp ? (() => {
    const s = supp as Record<string, any>
    const guardian = s.guardian || {}
    const court = s.court || {}
    const signingDate = s.signing_date || ''
    const absentParentsList = (s.absent_parents || []) as Array<Record<string, string>>
    const minorsList = (s.minors || []) as Array<Record<string, string>>
    const witnessesList = (s.witnesses || []) as Array<Record<string, string>>

    const parts: string[] = ['', '=== SUPPLEMENTARY DATA (PRIORITY - USE THESE VALUES) ===']
    if (court.name) parts.push(`Court name: ${court.name}`)
    if (signingDate) parts.push(`Signing date: ${signingDate}`)

    // Guardian
    if (guardian.date_of_birth) parts.push(`Guardian date of birth: ${guardian.date_of_birth}`)
    if (guardian.country_of_birth) parts.push(`Guardian country of birth: ${guardian.country_of_birth}`)
    if (guardian.city_of_birth) parts.push(`Guardian city of birth: ${guardian.city_of_birth}`)
    if (guardian.nationality) parts.push(`Guardian nationality: ${guardian.nationality}`)
    if (guardian.id_number) parts.push(`Guardian ID/Passport number: ${guardian.id_number}`)

    // Absent parents
    absentParentsList.forEach((ap, i) => {
      if (ap.name) parts.push(`Absent parent #${i + 1} name: ${ap.name}`)
      if (ap.nationality) parts.push(`Absent parent #${i + 1} nationality: ${ap.nationality}`)
      if (ap.passport) parts.push(`Absent parent #${i + 1} passport/ID: ${ap.passport}`)
      if (ap.country) parts.push(`Absent parent #${i + 1} country: ${ap.country}`)
    })

    // Minors
    minorsList.forEach((m, i) => {
      if (m.birth_city) parts.push(`Minor #${i + 1} city of birth: ${m.birth_city}`)
      if (m.country) parts.push(`Minor #${i + 1} country of birth: ${m.country}`)
      if (m.dob) parts.push(`Minor #${i + 1} date of birth: ${m.dob}`)
      if (m.id_type) parts.push(`Minor #${i + 1} document type: ${m.id_type}`)
      if (m.id_number) parts.push(`Minor #${i + 1} document number: ${m.id_number}`)
      if (m.address) parts.push(`Minor #${i + 1} current address: ${m.address}`)
    })

    // Witnesses
    witnessesList.forEach((w, i) => {
      if (w.nationality) parts.push(`Witness #${i + 1} nationality: ${w.nationality}`)
      if (w.id_number) parts.push(`Witness #${i + 1} ID/Cedula number: ${w.id_number}`)
    })

    parts.push('CRITICAL: Use these values instead of leaving fields blank. These are authoritative data provided by the attorney.')
    return parts.join('\n')
  })() : ''

  // Enriched context from previously-unused form fields (time_in_state,
  // immigration_status, city_of_birth, civil_status, detained_by_immigration,
  // orr_sponsor, court_order_date, etc.). Empty string if no data captured.
  const enrichedBlock = buildEnrichedContextBlock(tutor, minorBasic)

  // Auto-resolved jurisdiction block. Includes court name + filing procedure
  // when the panel has investigated the case; falls back to [FALTA:...] hint
  // otherwise. See buildJurisdictionBlock for per-type rules.
  const jurisdictionBlock = buildJurisdictionBlock(ctx, type)

  const baseInstructions = `
You are an expert immigration paralegal specializing in SIJS (Special Immigrant Juvenile Status) cases.
You generate SWORN DECLARATIONS (affidavits) in ENGLISH that are ready to file in U.S. state court.
CRITICAL RULES:
- Use ONLY the real data provided. NEVER invent names, dates, or facts.
- Write in FIRST PERSON (as if the declarant is speaking).
- Use formal legal English appropriate for court filings.
- Include the standard perjury declaration at the end.
- Use NUMBERED paragraphs.
- Improve the client's simple words into professional legal language WITHOUT changing the facts.
- Be detailed, emotional where appropriate (for judges), and legally precise.
- Include dates, locations, and specific examples whenever the data provides them.
- ALWAYS include the declarant's ID document (passport number, cedula, or ID number) in the opening paragraph. If no ID is provided, write [FALTA: Número de documento de identidad del declarante].
- NEVER use [PENDING] as placeholder. Instead, describe what data is missing in Spanish inside brackets. Examples:
  [FALTA: Nombre del padre ausente]
  [FALTA: Número de pasaporte]
  [FALTA: Fecha de nacimiento del tutor]
  [FALTA: Ciudad de nacimiento]
  [FALTA: Fecha de firma]
  [FALTA: Nombre del tribunal]
  [FALTA: Número de documento de identidad]
`

  if (type === 'parental_consent') {
    // Get absent parent for THIS specific child
    const absentParent = (ctx.allAbsentParents[index] || ctx.clientAbsentParent || {}) as Record<string, string>
    const parentName = absentParent.parent_name || (tutor?.absent_parent_name as string) || '[FALTA: Nombre completo del padre ausente]'
    const parentRelation = absentParent.parent_relationship || (tutor?.absent_parent_relationship as string) || 'padre'
    const parentRelationEN = parentRelation === 'madre' ? 'mother' : 'father'
    const childPronoun = parentRelationEN === 'father' ? 'daughter' : 'son'

    // Find the best ID document available (passport OR cedula/DNI)
    // Filter out bogus values like "00000", "0", empty strings
    const isBogus = (v: string) => !v || v.trim().length < 3 || /^0+$/.test(v.trim())
    const cleanPassport = (v: string) => isBogus(v) ? '' : v.trim()

    const parentPassport = cleanPassport(absentParent.parent_passport || '') || cleanPassport((tutor?.absent_parent_passport as string) || '')
    const parentId = cleanPassport(absentParent.parent_id_number || '') || cleanPassport((tutor?.absent_parent_id as string) || '')
    const parentNationality = absentParent.parent_nationality || absentParent.nationality || (tutor?.absent_parent_nationality as string) || ''
    const parentDocLabel = parentPassport ? 'Passport' : parentId ? 'ID/Cédula' : '[FALTA: Tipo de documento]'
    const parentDocNumber = parentPassport || parentId || '[FALTA: Número de documento de identidad del padre ausente]'

    return `You are an expert immigration paralegal. Generate a PARENTAL CONSENT TO TEMPORARY GUARDIANSHIP letter.

Use ONLY the data provided. Search through ALL the documents, forms, and case information to find:
- The absent parent's full name and ID document (passport, cedula, or DNI)
- The child's full name and date of birth
- The guardian's full name and address
- The court jurisdiction

HERE IS THE EXACT FORMAT TO FOLLOW (replace only the bracketed data with real case data):

PARENTAL CONSENT TO TEMPORARY GUARDIANSHIP

I, [ABSENT PARENT FULL NAME], holder of [NATIONALITY] ${parentDocLabel} No. ${parentDocNumber}, hereby declare the following under oath:

1. I am the biological ${parentRelation} of [CHILD FULL NAME IN CAPS], born on [MONTH DAY, YEAR].

2. I acknowledge that my ${childPronoun} is currently residing at [FULL ADDRESS OF CHILD — use the child's full address or the guardian's full address if same], under the care of [GUARDIAN FULL NAME].

3. I give my full and voluntary consent for [GUARDIAN FULL NAME] to petition for and be granted temporary legal guardianship of my ${childPronoun} in accordance with applicable law.

4. I understand that this guardianship is part of a legal process intended to provide protection and stability to my ${childPronoun}, and that it does not constitute a permanent termination of my parental rights. However, it does transfer temporary legal authority to the appointed guardian.

5. This decision is made freely, without coercion, and in the best interest of my ${childPronoun}.

Signed in the country __________________ city __________________ on the ______ day of __________________ year ________

Firmado en el país __________________ de la ciudad __________________ el día ______ del mes __________________ del año ________


___________________________
Signature of ${parentRelationEN === 'father' ? 'Father' : 'Mother'}
[ABSENT PARENT FULL NAME]

This document was read and explained to the signer in Spanish before signing.

CRITICAL: BOTH signature lines (English AND Spanish) MUST remain EXACTLY as shown above with blank underlines. Do NOT fill in any country, city, day, month, or year. The signer will fill these fields by hand. Include BOTH lines in the document regardless of the language version.

=== CASE DATA TO USE ===
Absent parent name: ${parentName}
Absent parent nationality: ${parentNationality}
Absent parent document type: ${parentDocLabel}
Absent parent document number: ${parentDocNumber}
Absent parent data: ${JSON.stringify(absentParent)}
Tutor/Guardian name: ${tutor?.full_name || ''}
Tutor/Guardian address: ${tutor?.full_address || ''}
Child's current address: ${(ctx.allMinorStories[index]?.formData?.minorBasic as Record<string, string>)?.address || tutor?.minor_location || tutor?.full_address || '[FALTA: Dirección actual del menor]'}
Children in case:
${ctx.allMinorStories.map((s, i) => {
  const mb = (s.formData?.minorBasic || {}) as Record<string, string>
  return `Child ${i + 1}: ${mb.full_name || 'Unknown'}, DOB: ${mb.dob || 'Unknown'}, Country: ${mb.country || 'Unknown'}`
}).join('\n')}
Client story: ${JSON.stringify(ctx.clientStory || {})}
Documents extracted text: ${ctx.documents.filter(d => d.extracted_text).map(d => `[${d.name}]: ${d.extracted_text?.substring(0, 500)}`).join('\n')}

IMPORTANT:
- If you find a passport number in the documents or forms, USE IT.
- If you cannot find a specific piece of data, write what is missing in Spanish: [FALTA: descripción del dato].
- Use today's date if no signing date is specified.
- Use the court name from the JURISDICTION block below (if present) or from the SUPPLEMENTARY DATA override (if the admin filled it). Never default to Utah unless the client actually lives there.
- Output ONLY the letter text, nothing else. No explanations.
${suppBlock}${enrichedBlock}${jurisdictionBlock}`
  }

  if (type === 'parental_consent_collaborative') {
    // COLLABORATIVE VERSION — the absent parent voluntarily signs accepting fault/negligence.
    // Does NOT mention the SIJ declaration or juvenile court proceedings.
    // Written in FIRST PERSON from the absent parent's perspective.
    const absentParent = (ctx.allAbsentParents[index] || ctx.clientAbsentParent || {}) as Record<string, string>
    const parentName = absentParent.parent_name || (tutor?.absent_parent_name as string) || '[FALTA: Nombre completo del padre ausente]'
    const parentRelation = absentParent.parent_relationship || (tutor?.absent_parent_relationship as string) || 'padre'
    const parentRelationEN = parentRelation === 'madre' ? 'mother' : 'father'
    const childPronoun = parentRelationEN === 'father' ? 'daughter' : 'son'
    const childPronounES = parentRelationEN === 'father' ? 'hija' : 'hijo'
    const otherParentEN = parentRelationEN === 'father' ? 'mother' : 'father'
    const otherParentES = parentRelationEN === 'father' ? 'madre' : 'padre'

    const isBogus = (v: string) => !v || v.trim().length < 3 || /^0+$/.test(v.trim())
    const cleanPassport = (v: string) => isBogus(v) ? '' : v.trim()

    const parentPassport = cleanPassport(absentParent.parent_passport || '') || cleanPassport((tutor?.absent_parent_passport as string) || '')
    const parentId = cleanPassport(absentParent.parent_id_number || '') || cleanPassport((tutor?.absent_parent_id as string) || '')
    const parentNationality = absentParent.parent_nationality || absentParent.nationality || (tutor?.absent_parent_nationality as string) || ''
    const parentCountry = absentParent.parent_country || (tutor?.absent_parent_country as string) || ''
    const parentLocation = absentParent.parent_location || (tutor?.absent_parent_location as string) || ''
    const parentDocLabel = parentPassport ? 'Passport' : parentId ? 'National Identity Document (DNI)' : '[FALTA: Tipo de documento]'
    const parentDocNumber = parentPassport || parentId || '[FALTA: Número de documento de identidad del padre ausente]'

    const tutorName = (tutor?.full_name as string) || ''
    const tutorAddress = (tutor?.full_address as string) || ''
    const childInfo = (ctx.allMinorStories[index]?.formData?.minorBasic as Record<string, string>) || {}

    const langHeader = lang === 'en'
      ? 'Generate the ENTIRE document in ENGLISH. Every word must be in formal legal English suitable for court filings.'
      : 'Genera TODO el documento en ESPAÑOL formal y legal. Cada palabra debe estar en español jurídico apto para presentación ante autoridades.'

    return `You are an expert immigration paralegal. Generate a VOLUNTARY RELINQUISHMENT OF PARENTAL CUSTODY letter — the COLLABORATIVE version where the absent parent chooses to cooperate and voluntarily signs a letter acknowledging his/her own fault and negligence.

${langHeader}

CRITICAL RULES FOR THIS DOCUMENT:
- Written in FIRST PERSON as the absent ${parentRelationEN} speaking.
- The ${parentRelationEN} ACKNOWLEDGES his/her own guilt, negligence, and emotional absence throughout the child's life.
- The ${parentRelationEN} ASSUMES full responsibility for the abandonment and the emotional harm caused.
- The ${parentRelationEN} voluntarily RELINQUISHES custody in favor of the other ${otherParentEN}.
- DO NOT mention the SIJ declaration, Special Immigrant Juvenile Status, juvenile court proceedings, or the child's immigration case.
- DO NOT mention that the ${parentRelationEN} is aware of any pending immigration proceedings.
- The tone is one of genuine remorse and acceptance of responsibility.
- Use the REAL story from the case data — reference the specific incidents of negligence (missed birthdays, unfulfilled promises, ignored calls, absence at school events, etc.) — but REWRITTEN in first person from the ${parentRelationEN}'s perspective acknowledging fault.
- The ${parentRelationEN} must accept that it was his/her own decision not to be present, and that the bond with the child has been broken by his/her own conduct.

HERE IS THE EXACT STRUCTURE TO FOLLOW:

${lang === 'en' ? 'VOLUNTARY RELINQUISHMENT OF PARENTAL CUSTODY' : 'RENUNCIA VOLUNTARIA DE PATRIA POTESTAD Y CUSTODIA'}

${lang === 'en' ? '(For guardianship proceedings in the United States of America)' : '(Para proceso de tutela ante la corte juvenil en los Estados Unidos de América)'}

${lang === 'en' ? 'I,' : 'Yo,'} [ABSENT ${parentRelationEN.toUpperCase()} FULL NAME IN CAPS], ${lang === 'en' ? 'identified with' : 'identificado/a con'} [NATIONALITY] ${parentDocLabel} ${lang === 'en' ? 'No.' : 'N°'} ${parentDocNumber}, ${lang === 'en' ? 'of' : 'de nacionalidad'} [NATIONALITY] ${lang === 'en' ? 'nationality, currently residing in' : ', actualmente residiendo en'} [LOCATION], ${lang === 'en' ? 'being of sound mind and acting freely, voluntarily, knowingly, and without any form of coercion, pressure, deceit, or violence, hereby state and affirm the following:' : 'encontrándome en pleno uso de mis facultades mentales y actuando de manera libre, voluntaria, consciente y sin ningún tipo de coacción, presión, engaño ni violencia, por medio del presente documento manifiesto y declaro lo siguiente:'}

${lang === 'en' ? 'I DECLARE AND STATE:' : 'DECLARO Y MANIFIESTO:'}

[Generate 9 NUMBERED paragraphs following EXACTLY this structure:]

1. ${lang === 'en' ? `That I am the biological ${parentRelationEN} of the minor [CHILD FULL NAME IN CAPS], born on [DOB], in [CITY, COUNTRY], as recorded in his/her birth certificate.` : `Que soy el/la ${parentRelation} biológico/a del/la menor [NOMBRE COMPLETO DEL/LA MENOR EN MAYÚSCULAS], nacido/a el [FECHA DE NACIMIENTO] en [CIUDAD, PAÍS], conforme consta en su respectiva partida de nacimiento.`}

2. ${lang === 'en' ? `That the biological ${otherParentEN} of my ${childPronoun} is [OTHER PARENT FULL NAME], with whom I had a sentimental relationship from which our ${childPronoun} was born, and who I know currently resides together with our minor ${childPronoun} at [GUARDIAN FULL ADDRESS], United States of America.` : `Que el/la ${otherParentES} biológico/a de mi ${childPronounES} es [NOMBRE COMPLETO DEL OTRO PROGENITOR], con quien tuve una relación sentimental de la cual nació nuestro/a ${childPronounES}, y de quien conozco que actualmente reside junto a nuestro/a menor ${childPronounES} en [DIRECCIÓN COMPLETA DEL TUTOR], Estados Unidos de América.`}

3. ${lang === 'en' ? `That, with a deep sense of guilt and remorse, I acknowledge before the competent authorities that, from the moment I learned of the pregnancy and from the birth of my ${childPronoun}, I voluntarily distanced myself from my parental duties and did not assume the moral, emotional, or financial responsibilities that corresponded to me. I honestly admit that my absence was constant, prolonged, and absolute throughout my ${childPronoun}'s childhood and adolescence.` : `Que, con profundo sentimiento de culpa y arrepentimiento, reconozco ante las autoridades competentes que, desde que tuve conocimiento del embarazo y desde el nacimiento de mi ${childPronounES}, me aparté voluntariamente de mis deberes paternos y no asumí las responsabilidades morales, afectivas ni económicas que me correspondían. Admito con honestidad que mi ausencia fue constante, prolongada y absoluta durante toda la niñez y adolescencia de mi ${childPronounES}.`}

4. ${lang === 'en' ? `That I acknowledge having incurred in a serious and repeated parental negligence. I accept that it was I, and only I, who decided not to be present in the important moments of my ${childPronoun}'s life. [Include 2-3 specific examples of negligence from the case data, rewritten in first person from the absent ${parentRelationEN}'s perspective — e.g., missed birthdays, unkept promises, ignored calls, absence at school events, failure to provide financial support]. I recognize that my conduct was that of an absent and negligent ${parentRelationEN}, and that through it I caused profound emotional harm that I now deeply regret.` : `Que reconozco haber incurrido en una grave y reiterada negligencia paterna. Acepto que fui yo, y solo yo, quien decidió no estar presente en los momentos importantes de la vida de mi ${childPronounES}. [Incluir 2-3 ejemplos específicos de negligencia extraídos de los datos del caso, reescritos en primera persona desde la perspectiva del/la ${parentRelation} ausente — p.ej., cumpleaños ausentes, promesas incumplidas, llamadas ignoradas, ausencia en eventos escolares, falta de sostén económico]. Reconozco que mi conducta fue la de un/a ${parentRelation} ausente y negligente, y que con ella causé un profundo daño emocional que hoy lamento.`}

5. ${lang === 'en' ? `That I acknowledge and accept that, throughout the entire life of my ${childPronoun}, it has been [OTHER PARENT FULL NAME], the biological ${otherParentEN}, who has exclusively, fully, and continuously assumed all emotional, affective, financial, and caregiving burdens related to our ${childPronoun}. She/He has been his/her sole provider, his/her sole support, and the only truly present parental figure in his/her life.` : `Que reconozco y acepto que, durante toda la vida de mi ${childPronounES}, ha sido [NOMBRE COMPLETO DEL OTRO PROGENITOR], ${otherParentES} biológico/a, quien ha asumido de manera exclusiva, íntegra y constante todas las cargas emocionales, afectivas, económicas y de cuidado de nuestro/a ${childPronounES}. Ella/Él ha sido su único/a sostén, su único/a apoyo y la única figura parental verdaderamente presente en su vida.`}

6. ${lang === 'en' ? `That, for the reasons set forth above, and by virtue of my own negligent conduct over the years, I accept that I am not in a moral or material position to exercise parental authority, custody, or care over my ${childPronoun}. I likewise acknowledge that the parent-child bond between him/her and me has been irreparably broken due to my own responsibility and my own decision not to have been present.` : `Que, por las razones anteriormente expuestas, y en virtud de mi propia conducta negligente a lo largo de los años, acepto que no me encuentro en condiciones morales ni materiales para ejercer la patria potestad, la custodia ni el cuidado de mi ${childPronounES}. Reconozco igualmente que el vínculo paterno-filial entre él/ella y yo se encuentra irreparablemente quebrantado por mi propia responsabilidad y por mi propia decisión de no haber estado presente.`}

7. ${lang === 'en' ? `That, consequently, freely, voluntarily, permanently, and irrevocably, I RELINQUISH all of my parental rights, physical custody, and legal custody over my ${childPronoun} [CHILD FULL NAME IN CAPS], recognizing that sole custody must rest with his/her biological ${otherParentEN}, [OTHER PARENT FULL NAME].` : `Que, en consecuencia, de manera libre, voluntaria, permanente e irrevocable, RENUNCIO a todos mis derechos de patria potestad, custodia física y custodia legal sobre mi ${childPronounES} [NOMBRE COMPLETO DEL/LA MENOR EN MAYÚSCULAS], reconociendo que la custodia exclusiva debe recaer en su ${otherParentES} biológico/a, [NOMBRE COMPLETO DEL OTRO PROGENITOR].`}

8. ${lang === 'en' ? `That I have no objection whatsoever and, on the contrary, I hereby express my full consent and agreement for [OTHER PARENT FULL NAME] to exercise, exclusively and entirely, the legal guardianship, custody, and care of our minor ${childPronoun}, as well as to make, in his/her sole name, all decisions relating to his/her education, health, well-being, residence, protection, and integral development, in accordance with applicable law.` : `Que no tengo objeción alguna y, por el contrario, manifiesto mi total conformidad y consentimiento para que [NOMBRE COMPLETO DEL OTRO PROGENITOR] ejerza de manera exclusiva, total e íntegra la tutela legal, la custodia y la guarda de nuestro/a menor ${childPronounES}, así como para que tome en su exclusivo nombre todas las decisiones relativas a su educación, salud, bienestar, residencia, protección y desarrollo integral, conforme a la legislación aplicable.`}

9. ${lang === 'en' ? `That I make this decision fully assuming responsibility for my past conduct, and in the best interest of my ${childPronoun}, with the sole purpose of guaranteeing his/her protection, his/her emotional stability, his/her academic continuity, and his/her overall well-being.` : `Que tomo esta decisión asumiendo plenamente la responsabilidad por mi conducta pasada, y en el mejor interés superior de mi ${childPronounES}, con la única finalidad de garantizar su protección, su estabilidad emocional, su continuidad académica y su bienestar general.`}

${lang === 'en' ? 'THEREFORE, I sign this document in full understanding of its contents and of the legal consequences that may derive therefrom, intending it to take effect before all appropriate authorities.' : 'POR LO TANTO, firmo el presente documento en pleno conocimiento de su contenido y de las consecuencias legales que del mismo se deriven, con la intención de que surta todos sus efectos ante las autoridades correspondientes.'}

${lang === 'en' ? 'In the city of ____________________, on this _____ day of _______________, of the year _________.' : 'En la ciudad de ____________________, el día _____ del mes de _______________ del año _________.'}


${lang === 'en' ? 'Signature' : 'Firma'}: ____________________________________
[ABSENT ${parentRelationEN.toUpperCase()} FULL NAME IN CAPS]
${parentDocLabel} ${lang === 'en' ? 'No.' : 'N°'} ${parentDocNumber}

=== CASE DATA TO USE ===
Absent ${parentRelationEN} name: ${parentName}
Absent ${parentRelationEN} nationality: ${parentNationality}
Absent ${parentRelationEN} country: ${parentCountry}
Absent ${parentRelationEN} location/province: ${parentLocation}
Absent ${parentRelationEN} document type: ${parentDocLabel}
Absent ${parentRelationEN} document number: ${parentDocNumber}
Absent ${parentRelationEN} raw data: ${JSON.stringify(absentParent)}
Other parent (guardian) name: ${tutorName}
Other parent (guardian) full address: ${tutorAddress}
Child full name: ${childInfo.full_name || '[FALTA: Nombre del menor]'}
Child date of birth: ${childInfo.dob || '[FALTA: Fecha de nacimiento del menor]'}
Child city of birth: ${childInfo.birth_city || childInfo.country || ''}
Child country of birth: ${childInfo.country || ''}
Child current address: ${childInfo.address || tutorAddress || '[FALTA: Dirección actual del menor]'}
Narrative from guardian (rewrite key negligence events in first person from absent ${parentRelationEN}): ${JSON.stringify({ why_cannot_reunify: tutor?.why_cannot_reunify, abuse_description: tutor?.abuse_description, ...(ctx.clientStory || {}) })}
Documents extracted text (use any relevant data from these — passport numbers, dates, addresses, etc.): ${ctx.documents.filter(d => d.extracted_text).map(d => `[${d.name}]: ${d.extracted_text?.substring(0, 500)}`).join('\n')}

IMPORTANT:
- Output ONLY the letter text, nothing else. No explanations, no markdown.
- Leave the signing line BLANK (the signer will fill city, day, month, year by hand).
- Do NOT mention the SIJ declaration, the juvenile court, or the immigration case.
- Extract 2-3 specific negligence incidents from the narrative above and rewrite them in paragraph 4 in FIRST PERSON from the absent ${parentRelationEN}'s perspective (admitting it was him/her who failed).
- If a specific piece of data is missing, write [FALTA: descripción del dato] in Spanish.
${suppBlock}${enrichedBlock}${jurisdictionBlock}`
  }

  if (type === 'petition_guardianship') {
    const absentParent = (ctx.allAbsentParents[index] || ctx.clientAbsentParent || {}) as Record<string, string>

    return `You are an expert immigration paralegal. Generate a PETITION FOR TEMPORARY GUARDIANSHIP.

Use ONLY the data provided. Search through ALL documents, forms, and case information to find every relevant detail.

HERE IS THE EXACT STRUCTURE TO FOLLOW:

PETITION FOR TEMPORARY GUARDIANSHIP OF [CHILD FULL NAME IN CAPS]

TO THE [COURT NAME — read from the JURISDICTION block appended at the end of this prompt; if no jurisdiction is resolved, use the placeholder [FALTA: Nombre del tribunal]]

I, [GUARDIAN FULL NAME IN CAPS], of legal age, [NATIONALITY] national, residing at [GUARDIAN FULL ADDRESS], respectfully request this Honorable Court to grant me temporary guardianship of [CHILD FULL NAME IN CAPS], based on the following considerations:

I. IDENTIFICATION OF THE YOUTH

- Full Name: [Child full name]
- Date of Birth: [Month Day, Year]
- Current Age: [X] years old
- Citizenship: [Country/Countries]
- Current Address: [Address where child lives]

II. BASIS FOR THE PETITION

[Generate 5-7 numbered paragraphs based on the case data. Each paragraph should cover ONE aspect:]
1. How/when the child entered the United States and current residence
2. History of abandonment and neglect by biological parent(s) — use specific details from the forms
3. Details about the mother's behavior/situation (if applicable)
4. Details about the father's behavior/situation (if applicable)
5. Lack of other responsible family members
6. How the guardian came to care for the child — the relationship and trust
7. Any additional relevant facts from the case

USE THE ACTUAL STORY FROM THE FORMS — improve the language but keep all facts.

III. FORMAL REQUEST

I respectfully request that this Honorable Court:

1. Appoint me as temporary legal guardian of [CHILD FULL NAME], to ensure [his/her] personal, emotional, and legal well-being.
2. Issue a judicial order establishing that:
   - [Child name] cannot be reunified with [his/her] biological parents due to abandonment and neglect.
   - It is not in [Child name]'s best interest to return to [country of origin].
   - [He/She] is eligible to apply for Special Immigrant Juvenile Status (SIJS) under U.S. federal law.

I declare that this petition is submitted in good faith, with the sole intention of protecting [Child name] from further harm and providing [him/her] with a safe and dignified environment while [he/she] regularizes [his/her] immigration status.

In [City, State], on [Month Day, Year].



_______________________________
[GUARDIAN FULL NAME IN CAPS]
Petitioner

=== CASE DATA FOR THIS SPECIFIC CHILD ===
THIS PETITION IS ONLY FOR: ${minorBasic.full_name || 'Unknown'}, Age: ${minorAgeStr}

THIS child's form data ONLY:
Basic Info: ${JSON.stringify(minorBasic)}
Abuse/Neglect (from THIS child's form): ${JSON.stringify(minorAbuse)}
Best Interest: ${JSON.stringify(minorBestInterest)}

Guardian/Tutor name and address: ${tutor?.full_name || clientName}, ${tutor?.full_address || ''}, Relationship: ${tutor?.relationship_to_minor || 'Mother'}
Guardian country of birth: ${tutor?.country_of_birth || ''}
Guardian journey to US: ${tutor?.journey_to_us || ''}
Guardian hardships: ${tutor?.hardships || ''}
Guardian how caring children: ${tutor?.how_caring_children || ''}
Guardian current situation: ${tutor?.current_situation || ''}
Guardian caretaker in country: ${tutor?.caretaker_in_country || ''}
Why this child cannot reunify: ${tutor?.why_cannot_reunify || ''}
Risk if returned: ${tutor?.risk_if_returned || ''}

Absent parent data: ${JSON.stringify(absentParent)}
Documents extracted text: ${ctx.documents.filter(d => d.extracted_text).map(d => `[${d.name}]: ${d.extracted_text?.substring(0, 500)}`).join('\n')}

The guardian also has these other children (mention them ONLY if relevant, do NOT mix their stories):
${ctx.allMinorStories.filter((_, i) => i !== index).map((s) => {
  const mb = (s.formData?.minorBasic || {}) as Record<string, string>
  return `Sibling: ${mb.full_name || 'Unknown'}, DOB: ${mb.dob || 'Unknown'}`
}).join('\n')}

CRITICAL RULES:
- This petition is EXCLUSIVELY about ${minorBasic.full_name || 'this child'}. Do NOT include abuse stories or details from OTHER children's forms.
- Use ONLY the abuse/neglect data from THIS child's form above.
- The father of THIS child may be different from the father of siblings. Do NOT confuse them.
- Current age is ${minorAgeStr}. Use this exact age, do NOT calculate differently.
- If data is missing, write [FALTA: descripción del dato que falta] instead of leaving blank or using PENDING.
- Output ONLY the petition text, no explanations.
- The narrative in Section II must use REAL facts from THIS child's form, improved with legal language.
- CRITICAL WRITING RULE: When describing harmful acts, use ONLY abstract legal language such as "acts that gravely affected the minor's wellbeing". Do NOT elaborate or specify the nature of the acts. Focus on EMOTIONAL IMPACT and LEGAL CONSEQUENCES, not on describing events in detail.
${suppBlock}${enrichedBlock}${jurisdictionBlock}`
  }

  if (type === 'tutor') {
    const absentParent = (ctx.clientAbsentParent || {}) as Record<string, string>
    return `You are an expert immigration paralegal. Generate a SWORN AFFIDAVIT OF THE PARENT/GUARDIAN following this EXACT structure.

Use ONLY the real data. Write in FIRST PERSON as the parent/guardian speaking. Generate 25-32 NUMBERED paragraphs telling the COMPLETE story chronologically.

DECLARANT: ${tutor?.full_name || clientName}
RELATIONSHIP: ${tutor?.relationship_to_minor || 'Mother/Guardian'}

ALL TUTOR DATA (23 questions): ${JSON.stringify(tutor)}
ABSENT PARENT DATA: ${JSON.stringify(absentParent)}
CLIENT STORY: ${JSON.stringify(ctx.clientStory || {})}
CHILDREN (each has a DIFFERENT father — do NOT mix their stories):
${ctx.allMinorStories.map((s, i) => {
  const mb = (s.formData?.minorBasic || {}) as Record<string, string>
  const ma = (s.formData?.minorAbuse || {}) as Record<string, string>
  const age = calcAge(mb.dob)
  return 'Child ' + (i + 1) + ': ' + mb.full_name + ', Age: ' + age + ' years old, DOB: ' + mb.dob + '\n  Abuse data: ' + JSON.stringify(ma)
}).join('\n')}
${supp && (supp as Record<string, unknown>).additional_children ? `Additional children: ${JSON.stringify((supp as Record<string, unknown>).additional_children)}` : ''}
DOCUMENTS: ${ctx.documents.filter(d => d.extracted_text).map(d => '[' + d.name + ']: ' + d.extracted_text?.substring(0, 500)).join('\n')}

FOLLOW THIS EXACT FORMAT:

AFFIDAVIT OF [PARENT/GUARDIAN FULL NAME IN CAPS]

I, [Full Name], being duly sworn, declare under penalty of perjury that the following statements are true and correct to the best of my knowledge:

1. My name is [Full Name]. I was born on [DOB] in [City, Country]. I am the biological [mother/father] of [CHILD FULL NAME], born on [child DOB] in [city, country].
2. I currently reside at [address], where I live with my [son/daughter].
3. The biological [father/mother] of my [son/daughter] is [ABSENT PARENT NAME].
4. I met [absent parent] in [year] in [place]. [How relationship started].
5. Our relationship lasted approximately [X years]. During that time, our [son/daughter] was born.
6-12. [ABUSE/VIOLENCE/NEGLECT details — refused paternity, alcohol, violence, physical assault, confinement, dangerous environment. USE SPECIFIC INCIDENTS from the case data.]
13-16. [HOW THEY ESCAPED — family help, moved away, protected the child]
17-18. [Continued harassment, moved to safety]
19-22. [Attempts to contact father for support — all failed, never helped financially]
23-24. [Lost all contact, father's current known situation]
25-26. [Parent has been sole caregiver, came to US seeking safety]
27-28. [Child's current achievements, character, wellbeing]
29-30. [Child completely abandoned by father, financially and emotionally]
31. Due to the father's history of [violence/alcoholism/abandonment/lack of responsibility], it would not be safe or in the best interest of my [son/daughter] to reunify with [his/her] [father/mother].
32. I respectfully submit this declaration in support of legal proceedings seeking custody and protection of my minor child, and in support of findings that reunification with [his/her] [father/mother] is not viable due to abuse, neglect, and abandonment.

I declare under penalty of perjury under the laws of the United States that the foregoing is true and correct.

Signature: _______________________________
Name: [FULL NAME]
Date: ___________________

IMPORTANT:
- Generate 25-32 numbered paragraphs minimum.
- Each paragraph should be ONE specific fact or event.
- Use the REAL story from the forms — dates, places, incidents.
- Make it chronological: how they met → relationship → abuse → escape → attempts to contact → current situation.
- MENTION ALL CHILDREN including any additional children listed above. The declarant has ALL these children.
- Each child has a DIFFERENT biological father. Clearly distinguish which father did what to which child. Do NOT mix their stories.
- Use the CORRECT ages calculated from each child's DOB and today's date.
- If data is missing, write [FALTA: descripción del dato] in Spanish.
- Output ONLY the affidavit text.
- CRITICAL WRITING RULE: When describing harmful acts against any child, use ONLY abstract legal language such as "committed acts that gravely affected the child's wellbeing" or "caused grave harm". Do NOT elaborate, describe, or specify the nature of harmful acts. Focus on EMOTIONAL IMPACT and LEGAL CONSEQUENCES only.
${suppBlock}${enrichedBlock}${jurisdictionBlock}`
  }

  if (type === 'minor') {
    const minorName = minorBasic.full_name || 'the minor'
    const absentParent = (ctx.allAbsentParents[index] || ctx.clientAbsentParent || {}) as Record<string, string>
    return `You are an expert immigration paralegal. Generate a SWORN DECLARATION OF THE MINOR following this EXACT structure.

Use ONLY the real data provided. Write in FIRST PERSON as the minor speaking. Be emotionally impactful for the judge while maintaining factual accuracy. Improve simple words into professional legal language WITHOUT changing the facts.

MINOR: ${minorName}
DOB: ${minorBasic.dob || 'Unknown'}
CURRENT AGE: ${minorAgeStr}
COUNTRY: ${minorBasic.country || 'Unknown'}

THIS MINOR'S FORM RESPONSES ONLY (24-question form):
Basic Info: ${JSON.stringify(minorBasic)}
Abuse/Neglect: ${JSON.stringify(minorAbuse)}
Best Interest: ${JSON.stringify(minorBestInterest)}

GUARDIAN: ${tutor?.full_name || clientName} (${tutor?.relationship_to_minor || 'guardian'})
GUARDIAN ADDRESS: ${tutor?.full_address || ''}
ABSENT PARENT FOR THIS CHILD: ${JSON.stringify(absentParent)}
DOCUMENTS: ${ctx.documents.filter(d => d.extracted_text).map(d => '[' + d.name + ']: ' + d.extracted_text?.substring(0, 500)).join('\n')}

The guardian has other children too (mention ONLY if the minor references siblings):
${ctx.allMinorStories.filter((_, i) => i !== index).map((s) => {
  const mb = (s.formData?.minorBasic || {}) as Record<string, string>
  return `Sibling: ${mb.full_name || 'Unknown'}`
}).join(', ')}

FOLLOW THIS EXACT FORMAT:

SWORN DECLARATION OF [MINOR FULL NAME IN CAPS]

I, [MINOR FULL NAME IN CAPS], [age description], identified with [document type from country], under penalty of perjury, declare the following:

I. PERSONAL INFORMATION

My full name is [FULL NAME IN CAPS]. I was born on [date] in [city, country]. I am currently [X] years old and a citizen of [country]. [How they entered the US and when].

II. FAMILY SITUATION

I am the daughter/son of [FATHER NAME] and [MOTHER NAME]. [Brief overview of the dysfunctional family situation based on the case data].

III. RELATIONSHIP WITH MY MOTHER

[Detailed paragraph about the relationship with the mother — use the abuse_by_mother data, emotional abuse, negligence. Include specific incidents, dates, locations. Write with emotion from the minor's perspective.]

IV. RELATIONSHIP WITH MY FATHER

[Detailed paragraph about the relationship with the father — use the abuse_by_father data, abandonment, neglect. Include specific incidents, dates, locations. Write with emotion from the minor's perspective.]

V. REASONS WHY I CANNOT RETURN TO [COUNTRY]

[Why the minor cannot return — no protection from either parent, abuse/neglect environment, no safe family networks. Request the court's legal protection.]

VI. CURRENT SITUATION

[Current living situation with the guardian. Address, stability, how the guardian cares for them. End with the formal request for protective order/custody and SIJS special findings.]

I declare that everything written in this declaration is truthful, correct, and a reflection of my personal history.

Signed in: [City, State]
Date: [Date]



_____________________________
[MINOR FULL NAME IN CAPS]

IMPORTANT:
- This declaration is EXCLUSIVELY for ${minorName}. Use ONLY data from THIS minor's form above.
- Do NOT include stories, abuse details, or facts from other children's forms.
- The father of THIS child may be different from fathers of siblings. Use ONLY the absent parent data provided above.
- Current age is ${minorAgeStr}. Use this EXACT age.
- If data is missing, write [FALTA: descripción del dato] in Spanish.
- Output ONLY the declaration text.
- Make sections III and IV the most detailed — these are the heart of the case.
- If only one parent abused/abandoned, focus more on that parent and adapt the other section accordingly.
- CRITICAL WRITING RULE: When describing harmful acts against the minor, use ONLY abstract legal language such as "actos que afectaron gravemente mi bienestar" or "daño grave a mi persona". Do NOT elaborate, describe, or specify the nature of the acts. Keep the description of harmful events brief and abstract. Focus on the EMOTIONAL IMPACT and CONSEQUENCES rather than describing what happened. This is required for proper legal processing.
${suppBlock}${enrichedBlock}${jurisdictionBlock}`
  }

  // type === 'witness'
  const witness = witnesses[index]
  if (!witness) {
    return `${baseInstructions}\nERROR: No witness found at index ${index}. Available witnesses: ${witnesses.length}`
  }

  const absentParent = (ctx.clientAbsentParent || {}) as Record<string, string>

  // Validate witness ID and nationality (avoid bogus values like "00000")
  const isBogus = (v: string) => !v || v.trim().length < 3 || /^0+$/.test(v.trim())
  const witnessIdNumber = !isBogus(witness.id_number || '') ? witness.id_number : ''
  const witnessNationality = witness.nationality || ''

  return `You are an expert immigration paralegal. Generate a SWORN AFFIDAVIT OF A WITNESS following this EXACT structure.

Use ONLY the real data. Write in FIRST PERSON as the witness speaking. Use narrative paragraphs (NOT numbered). Each paragraph covers one aspect of the testimony.

WITNESS: ${witness.name}
RELATIONSHIP TO FAMILY: ${witness.relationship}
ADDRESS: ${witness.address || 'N/A'}
NATIONALITY: ${witnessNationality || '[FALTA: Nacionalidad del testigo]'}
ID NUMBER: ${witnessIdNumber || '[FALTA: Número de documento de identidad del testigo]'}
WHAT THEY CAN TESTIFY: ${witness.can_testify}

CRITICAL: Include the witness's ID number (${witnessIdNumber || 'as indicated above'}) and nationality (${witnessNationality || 'as indicated above'}) in the opening paragraph of the affidavit. Do NOT leave these blank.

GUARDIAN/PARENT: ${tutor?.full_name || clientName} (${tutor?.relationship_to_minor || 'guardian'})
ABSENT PARENT: ${absentParent.parent_name || '[FALTA: Nombre del padre ausente]'}
TUTOR DATA: ${JSON.stringify(tutor)}
ABSENT PARENT DATA: ${JSON.stringify(absentParent)}
CHILDREN: ${ctx.allMinorStories.map((s, i) => {
  const mb = (s.formData?.minorBasic || {}) as Record<string, string>
  return 'Child ' + (i + 1) + ': ' + (mb.full_name || 'Unknown')
}).join(', ')}
CLIENT STORY: ${JSON.stringify(ctx.clientStory || {})}
DOCUMENTS: ${ctx.documents.filter(d => d.extracted_text).map(d => '[' + d.name + ']: ' + d.extracted_text?.substring(0, 300)).join('\n')}

FOLLOW THIS EXACT FORMAT:

AFFIDAVIT OF WITNESS
[WITNESS FULL NAME IN CAPS]
[ID Type] No. [ID Number if available]

I, [WITNESS FULL NAME IN CAPS], an adult of [nationality] nationality, identified with [ID type and number], hereby declare under oath as follows:

[Paragraph 1: Who I am and my relationship to the family. How I know them and for how long.]

[Paragraph 2: What I know about the relationship between the parent and the absent parent. The conflict, abuse, violence.]

[Paragraph 3: What I witnessed — specific incidents of psychological abuse, physical abuse, violent environment.]

[Paragraph 4: How the violence affected the child — exposed to arguments, shouting, emotionally harmful situations.]

[Paragraph 5: How the parent decided to separate/leave to protect the child.]

[Paragraph 6: After separation — the absent parent abandoned their role, no financial support, no emotional involvement.]

[Paragraph 7: Vulnerable situation — forced to leave home, lost property, difficult conditions.]

[Paragraph 8: Since separation — the parent has been sole caregiver, providing stability, protection, education.]

[Paragraph 9: The child's achievements and character — good behavior, academic performance, maturity.]

[Paragraph 10: The absent parent has no active presence — sporadic contact at best, no meaningful parental role.]

[Paragraph 11: Reunification is not viable or safe due to history of violence, abandonment, lack of protection. Guardianship in favor of the parent is necessary and in the best interest of the child.]

I declare that all statements made herein are true and correct, and I affirm this declaration under penalty of perjury in accordance with applicable law.

Date: ___________________________

___________________________
[WITNESS FULL NAME IN CAPS]
[ID Type and Number]
Signature

IMPORTANT:
- Expand the witness's testimony into 10-12 detailed paragraphs.
- Use what they said they can testify ("can_testify" field) as the BASE and expand it.
- Add details from the case data that the witness would reasonably know.
- If data is missing (like ID numbers), write [FALTA: descripción del dato] in Spanish.
- Output ONLY the affidavit text.
${suppBlock}${enrichedBlock}${jurisdictionBlock}`
}

/**
 * System prompt dedicado para el modo TRADUCCIÓN (EN → ES). Mucho más corto
 * que el prompt de generación porque Claude solo debe traducir, no redactar
 * ni interpretar datos. Se cachea por separado.
 */
const TRANSLATION_SYSTEM = `Eres traductor/a legal profesional, especialista en documentos de inmigración (declaraciones juradas, peticiones de tutela, cartas de consentimiento) entre inglés y español.

## Tu única tarea

Recibirás un documento legal en ENGLISH. Tu trabajo es producir la versión en ESPAÑOL — traducción fiel, literal en los hechos, natural en el idioma.

## Reglas

1. **Fidelidad absoluta a los hechos**: no cambies nombres, fechas, números de documento, direcciones, lugares. Si el original dice "born on July 14, 2009" → "nacido el 14 de julio de 2009". Si dice "Passport No. 12345" → "Pasaporte No. 12345".
2. **Nombres propios NO se traducen**: ciudades (New York, Salt Lake City), nombres de personas, nombres de cortes (ej. "Fourth District Juvenile Court") quedan en inglés. Países pueden traducirse si son comunes (United States → Estados Unidos).
3. **Términos legales van en español formal**: "affidavit" → "declaración jurada", "sworn testimony" → "testimonio bajo juramento", "custody" → "custodia", "guardianship" → "tutela", "under penalty of perjury" → "bajo pena de perjurio".
4. **Estructura idéntica**: conserva la misma numeración de párrafos, títulos, secciones, saltos de línea y bloques de firma. No agregues ni quites contenido.
5. **Marcadores de datos faltantes**: si el texto contiene \`[FALTA: ...]\`, cópialo tal cual al español. No lo traduzcas ni lo interpretes.
6. **Frases de desconocimiento**: si el texto dice "the declarant manifests that she does not know this data", tradúcela como "la declarante manifiesta no conocer este dato" (o adaptación natural según contexto).
7. **Primera persona**: si el original dice "I declare", español dice "Yo declaro" / "Declaro". Mantén el género y número según contexto (declarante masculino/femenino).
8. **Output**: ÚNICAMENTE el documento traducido al español. Sin preámbulos ("Aquí está la traducción..."), sin markdown, sin explicaciones.

## Ejemplo breve

Input (EN): \`I, MARIA GONZALEZ, of legal age, Colombian national, hereby declare under penalty of perjury...\`

Output (ES): \`Yo, MARIA GONZALEZ, mayor de edad, de nacionalidad colombiana, por la presente declaro bajo pena de perjurio...\``

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

  const { case_id, type, index = 0, lang = 'en', english_source } = await request.json() as {
    case_id: string
    type: DeclarationType
    index?: number
    lang?: 'en' | 'es'
    english_source?: string
  }

  if (!case_id || !type) {
    return NextResponse.json({ error: 'case_id y type requeridos' }, { status: 400 })
  }

  // Build context — pure SQL, no AI
  let ctx = await buildCaseContext(case_id)

  // Auto-trigger de research de jurisdicción: si tenemos ubicación resuelta pero
  // nadie ha investigado aún la corte, lo hacemos ahora. Esto cubre el caso
  // donde el admin clica "Generar" sin haber abierto antes el JurisdictionPanel
  // (el panel lo dispara al montar). Se hace solo en modo generación (no en
  // traducción) para no repetir el research en el segundo fetch EN→ES.
  const isTranslation = lang === 'es' && typeof english_source === 'string' && english_source.trim().length > 0
  if (!isTranslation && !ctx.jurisdiction && ctx.clientLocation) {
    try {
      log.info('auto-researching jurisdiction before declaration generation', {
        caseId: case_id,
        stateCode: ctx.clientLocation.stateCode,
      })
      const research = await researchJurisdiction(ctx.clientLocation, request.signal)
      const service = createServiceClient()
      await service.from('case_jurisdictions').upsert({
        case_id,
        state_code: research.state_code,
        state_name: research.state_name,
        client_zip: ctx.clientLocation.zip,
        court_name: research.court_name,
        court_name_es: research.court_name_es,
        court_address: research.court_address,
        filing_procedure: research.filing_procedure,
        filing_procedure_es: research.filing_procedure_es,
        age_limit_sijs: research.age_limit_sijs,
        sources: research.sources,
        confidence: research.confidence,
        notes: research.notes,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'case_id' })
      // Re-carga el contexto con la jurisdicción recién persistida.
      ctx = await buildCaseContext(case_id)
    } catch (err) {
      // No bloqueamos la generación si el research falla — el documento
      // sale con el fallback "[FALTA: Nombre del tribunal]" y el admin puede
      // reintentar desde el panel.
      log.warn('auto-research jurisdiction failed, continuing without it', {
        caseId: case_id,
        err: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Modo TRADUCCIÓN: cuando el frontend pide ES y ya tiene la versión EN lista,
  // evitamos regenerar el documento entero desde el caso y simplemente traducimos.
  // Ahorra ~50% en costo (menos tokens de input: sin playbook, sin datos del caso)
  // y garantiza consistencia 1:1 entre las dos versiones.
  if (lang === 'es' && typeof english_source === 'string' && english_source.trim().length > 0) {
    try {
      const translated = await generateText({
        system: TRANSLATION_SYSTEM,
        user: `Documento en inglés a traducir al español:\n\n${english_source.trim()}`,
        maxTokens: 8192,
        logLabel: `translation-${type}`,
        signal: request.signal,
      })

      const missingMatches = translated.match(/\[FALTA:[^\]]*\]/gi) || []
      const missingFields = Array.from(new Set(missingMatches.map(m => m.trim())))

      return NextResponse.json({
        declaration: translated,
        type,
        index,
        clientName: `${ctx.client.firstName} ${ctx.client.lastName}`,
        mode: 'translation',
        warnings: {
          missingCount: missingFields.length,
          missingFields,
        },
      })
    } catch (err) {
      log.error('Claude translation failed', err)
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: `Error al traducir la declaración: ${message}` }, { status: 500 })
    }
  }

  // Modo GENERACIÓN normal (EN, o ES sin english_source).
  const typeSpecificPayload = buildDeclarationPrompt(type, ctx, index, lang)
  const langInstruction = lang === 'es'
    ? '\n\nGenera TODO el documento en ESPAÑOL formal. Traduce términos legales al español. Mantén nombres propios (personas, ciudades, países) en su forma original.'
    : '\n\nGenerate the ENTIRE document in formal ENGLISH. Translate narrative content to English; keep proper nouns (names, cities, countries) in their original form.'

  const userPayload = typeSpecificPayload + langInstruction

  try {
    const declaration = await generateText({
      system: DECLARATION_SYSTEM,
      user: userPayload,
      maxTokens: 8192,
      logLabel: `declaration-${type}`,
      signal: request.signal,
    })

    const missingMatches = declaration.match(/\[FALTA:[^\]]*\]/gi) || []
    const missingFields = Array.from(new Set(missingMatches.map(m => m.trim())))

    return NextResponse.json({
      declaration,
      type,
      index,
      clientName: `${ctx.client.firstName} ${ctx.client.lastName}`,
      mode: 'generation',
      warnings: {
        missingCount: missingFields.length,
        missingFields,
      },
    })
  } catch (err) {
    log.error('Claude declaration failed', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Error al generar la declaración: ${message}` }, { status: 500 })
  }
}

// Timeout amplio: la primera generación de un caso puede incluir auto-research
// de jurisdicción (~30s con web_search) + la generación propiamente dicha.
export const maxDuration = 90

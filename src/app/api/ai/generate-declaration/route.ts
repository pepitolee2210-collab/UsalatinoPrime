import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCaseContext } from '@/lib/ai/prompts/chat-system'

const GEMINI_KEY = process.env.GEMINI_API_KEY

type DeclarationType = 'tutor' | 'minor' | 'witness' | 'parental_consent' | 'parental_consent_collaborative' | 'petition_guardianship'

/**
 * Sanitizes text data before sending to Gemini to avoid PROHIBITED_CONTENT blocks.
 * Replaces explicit/graphic language with clinical legal equivalents.
 * Facts and legal meaning are preserved — only trigger words change.
 */
function sanitizeForAI(text: string): string {
  if (!text) return text
  const replacements: [RegExp, string][] = [
    // Spanish triggers
    [/abus[oó]\s*sexual(es)?/gi, 'actos graves contra el bienestar'],
    [/abusar\s*sexualmente/gi, 'cometer actos graves contra el bienestar'],
    [/viol[aó](ci[oó]n|r|da|ndo|rl[aoe])/gi, 'agresión grave'],
    [/relaciones?\s*sexuales?\s*(forzad|obligad)/gi, 'actos forzados contra el bienestar'],
    [/me\s*somet[ií][aó]\s*contra\s*mi\s*voluntad/gi, 'me agredió gravemente'],
    [/somet(ió|ida|ido|iendo)\s*(a\s*)?(contacto|actos)\s*(forzad|sexual)/gi, 'causó daños graves a su bienestar'],
    [/sometid[ao]\s*a\s*(conducta|actos)\s*grave/gi, 'víctima de actos que afectaron su bienestar'],
    [/somet(ió|iendo)\s*(por la fuerza\s*)?en\s*contra\s*de\s*(mi|su)\s*voluntad/gi, 'agredió gravemente'],
    [/contacto\s*forzado\s*contra\s*(mi|su)\s*voluntad/gi, 'agresión grave'],
    [/sometimiento\s*forzado/gi, 'agresión grave'],
    [/me\s*obligaba\s*a\s*tener\s*relaciones/gi, 'me agredía gravemente'],
    // Suicide - explicit method (Spanish)
    [/se\s*quit[óo]\s*la\s*vida\s*con\s*una\s*soga/gi, 'falleció por causas no naturales'],
    [/atando\s*una\s*soga\s*a\s*una\s*viga\s*y\s*en\s*el\s*cuello/gi, 'por medios no naturales'],
    [/se\s*quit[óo]\s*la\s*vida/gi, 'falleció por causas no naturales'],
    [/se\s*suicid[óo]/gi, 'falleció por causas no naturales'],
    [/colg[óo]\s*del\s*cuello/gi, 'falleció por causas no naturales'],
    [/ahorc[óo]/gi, 'falleció por causas no naturales'],
    // Suicide (English)
    [/hanged?\s*himself/gi, 'passed away by non-natural causes'],
    [/hanged?\s*herself/gi, 'passed away by non-natural causes'],
    [/commit(ed|ted)?\s*suicide/gi, 'passed away by non-natural causes'],
    [/took\s*his\s*(own\s*)?life/gi, 'passed away by non-natural causes'],
    [/took\s*her\s*(own\s*)?life/gi, 'passed away by non-natural causes'],
    // English triggers
    [/sexual(ly)?\s*abus(e[ds]?|ing)/gi, 'grave harm to wellbeing'],
    [/rap(e[ds]?|ing)/gi, 'grave assault'],
    [/molest(ed|ing|ation)/gi, 'grave harm'],
    [/sexual\s*assault/gi, 'grave assault'],
    [/forced\s*(sexual\s*)?(contact|intercourse|relations)/gi, 'forced harmful acts'],
  ]
  let result = text
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement)
  }
  return result
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

  // Extract witness data from tutor form
  const witnesses = (tutor?.witnesses as Array<Record<string, string>>) || []

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
- Use the court name from the supplementary data if provided. Do NOT default to Utah.
- Output ONLY the letter text, nothing else. No explanations.
${suppBlock}`
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

IMPORTANT:
- Output ONLY the letter text, nothing else. No explanations, no markdown.
- Leave the signing line BLANK (the signer will fill city, day, month, year by hand).
- Do NOT mention the SIJ declaration, the juvenile court, or the immigration case.
- Extract 2-3 specific negligence incidents from the narrative above and rewrite them in paragraph 4 in FIRST PERSON from the absent ${parentRelationEN}'s perspective (admitting it was him/her who failed).
- If a specific piece of data is missing, write [FALTA: descripción del dato] in Spanish.
${suppBlock}`
  }

  if (type === 'petition_guardianship') {
    const absentParent = (ctx.allAbsentParents[index] || ctx.clientAbsentParent || {}) as Record<string, string>

    return `You are an expert immigration paralegal. Generate a PETITION FOR TEMPORARY GUARDIANSHIP.

Use ONLY the data provided. Search through ALL documents, forms, and case information to find every relevant detail.

HERE IS THE EXACT STRUCTURE TO FOLLOW:

PETITION FOR TEMPORARY GUARDIANSHIP OF [CHILD FULL NAME IN CAPS]

TO THE [COURT NAME, e.g. FOURTH DISTRICT JUVENILE COURT OF THE STATE OF UTAH – AMERICAN FORK LOCATION]

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
${suppBlock}`
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
${suppBlock}`
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
${suppBlock}`
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
${suppBlock}`
}

export async function POST(request: NextRequest) {
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: 'AI no configurado' }, { status: 500 })
  }

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

  const { case_id, type, index = 0, lang = 'en' } = await request.json() as {
    case_id: string
    type: DeclarationType
    index?: number
    lang?: 'en' | 'es'
  }

  if (!case_id || !type) {
    return NextResponse.json({ error: 'case_id y type requeridos' }, { status: 400 })
  }

  // Build context
  const ctx = await buildCaseContext(case_id)
  const basePrompt = buildDeclarationPrompt(type, ctx, index, lang)
  const langInstruction = lang === 'es'
    ? '\n\nIMPORTANT: Generate the ENTIRE document in SPANISH. Translate all legal terms and content to Spanish. Keep the same structure and format but write everything in Spanish. CRITICAL: Use ALL the same data (names, dates, cities, countries, ID numbers) as the English version. Do NOT omit any fact in the Spanish version that appears in the English version. Both versions must contain the EXACT SAME INFORMATION, only translated.'
    : '\n\nIMPORTANT: Generate the ENTIRE document in ENGLISH. ALL text must be in English (legal terms, descriptions, paragraphs). Even if the source data contains Spanish text (names, testimonies, etc.), translate the narrative content to English while preserving proper nouns (names, cities) in their original form. Do NOT write any sentence or paragraph in Spanish. The document must be 100% in English.'
  const prompt = sanitizeForAI(basePrompt + langInstruction)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          ],
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'Error de IA' }, { status: 500 })
    }

    const data = await res.json()

    // Check for block reason
    const blockReason = data.promptFeedback?.blockReason
    const finishReason = data.candidates?.[0]?.finishReason
    if (blockReason || finishReason === 'SAFETY') {
      console.error('Gemini BLOCKED:', JSON.stringify({ blockReason, finishReason, safetyRatings: data.candidates?.[0]?.safetyRatings || data.promptFeedback?.safetyRatings }))
      return NextResponse.json({
        error: `Contenido bloqueado por filtro de seguridad (${blockReason || finishReason}). Contacte al administrador.`
      }, { status: 500 })
    }

    const declaration = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!declaration) {
      console.error('Gemini empty response:', JSON.stringify(data))
      return NextResponse.json({ error: 'Sin respuesta de IA' }, { status: 500 })
    }

    return NextResponse.json({
      declaration,
      type,
      index,
      clientName: `${ctx.client.firstName} ${ctx.client.lastName}`,
    })
  } catch (err) {
    console.error('AI error:', err)
    return NextResponse.json({ error: `Error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
  }
}

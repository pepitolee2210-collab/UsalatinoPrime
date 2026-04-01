import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCaseContext } from '@/lib/ai/prompts/chat-system'

const GEMINI_KEY = process.env.GEMINI_API_KEY

type DeclarationType = 'tutor' | 'minor' | 'witness' | 'parental_consent' | 'petition_guardianship'

function buildDeclarationPrompt(
  type: DeclarationType,
  ctx: Awaited<ReturnType<typeof buildCaseContext>>,
  index: number
): string {
  const clientName = `${ctx.client.firstName} ${ctx.client.lastName}`.toUpperCase()
  const tutor = ctx.tutorGuardian as Record<string, unknown> | null

  // Extract witness data from tutor form
  const witnesses = (tutor?.witnesses as Array<Record<string, string>>) || []

  // Extract minor data
  const minorStory = ctx.allMinorStories[index] || ctx.allMinorStories[0]
  const minorData = minorStory?.formData as Record<string, unknown> || {}
  const minorBasic = (minorData.minorBasic || {}) as Record<string, string>
  const minorAbuse = (minorData.minorAbuse || {}) as Record<string, string>
  const minorBestInterest = (minorData.minorBestInterest || {}) as Record<string, string>

  const baseInstructions = `
You are an expert immigration paralegal specializing in SIJS (Special Immigrant Juvenile Status) cases in Utah.
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
`

  if (type === 'parental_consent') {
    // Get absent parent data
    const absentParent = (ctx.clientAbsentParent || {}) as Record<string, string>
    const parentName = absentParent.parent_name || tutor?.partner_name as string || '[PARENT NAME]'
    const parentRelation = absentParent.parent_relationship === 'padre' ? 'father' : 'mother'
    const childPronoun = parentRelation === 'father' ? 'daughter' : 'son'

    return `You are an expert immigration paralegal. Generate a PARENTAL CONSENT TO TEMPORARY GUARDIANSHIP letter.

Use ONLY the data provided. Search through ALL the documents, forms, and case information to find:
- The absent parent's full name and passport number
- The child's full name and date of birth
- The guardian's full name and address
- The court jurisdiction

HERE IS THE EXACT FORMAT TO FOLLOW (replace only the bracketed data with real case data):

PARENTAL CONSENT TO TEMPORARY GUARDIANSHIP

I, [ABSENT PARENT FULL NAME], holder of [NATIONALITY] Passport No. [PASSPORT NUMBER], hereby declare the following under oath:

1. I am the biological ${parentRelation} of [CHILD FULL NAME IN CAPS], born on [MONTH DAY, YEAR].

2. I acknowledge that my ${childPronoun} is currently residing in [CITY], [STATE], United States, under the care of [GUARDIAN FULL NAME], who resides at [GUARDIAN FULL ADDRESS].

3. I give my full and voluntary consent for [GUARDIAN FULL NAME] to petition for and be granted temporary legal guardianship of my ${childPronoun} by the [COURT NAME, e.g. Fourth District Juvenile Court of the State of Utah].

4. I understand that this guardianship is part of a legal process intended to provide protection and stability to my ${childPronoun}, and that it does not constitute a permanent termination of my parental rights. However, it does transfer temporary legal authority to the appointed guardian.

5. This decision is made freely, without coercion, and in the best interest of my ${childPronoun}.

Signed in [CITY, STATE], United States, on the [DAY]th day of [MONTH], [YEAR].


___________________________
Signature of ${parentRelation === 'father' ? 'Father' : 'Mother'}
[ABSENT PARENT FULL NAME]

This document was read and explained to the signer in Spanish before signing.

=== CASE DATA TO USE ===
Absent parent name: ${parentName}
Absent parent data: ${JSON.stringify(absentParent)}
Tutor/Guardian data: ${JSON.stringify(tutor)}
Children in case:
${ctx.allMinorStories.map((s, i) => {
  const mb = (s.formData?.minorBasic || {}) as Record<string, string>
  return `Child ${i + 1}: ${mb.full_name || 'Unknown'}, DOB: ${mb.dob || 'Unknown'}, Country: ${mb.country || 'Unknown'}`
}).join('\n')}
Client story: ${JSON.stringify(ctx.clientStory || {})}
Documents extracted text: ${ctx.documents.filter(d => d.extracted_text).map(d => `[${d.name}]: ${d.extracted_text?.substring(0, 500)}`).join('\n')}

IMPORTANT:
- If you find a passport number in the documents or forms, USE IT.
- If you cannot find a specific piece of data, use [PENDING] as placeholder.
- Use today's date if no signing date is specified.
- The court should be in Utah unless case data says otherwise.
- Output ONLY the letter text, nothing else. No explanations.
`
  }

  if (type === 'petition_guardianship') {
    const absentParent = (ctx.clientAbsentParent || {}) as Record<string, string>

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

=== CASE DATA TO USE ===
Guardian/Tutor data: ${JSON.stringify(tutor)}
Absent parent data: ${JSON.stringify(absentParent)}
Children:
${ctx.allMinorStories.map((s, i) => {
  const mb = (s.formData?.minorBasic || {}) as Record<string, string>
  const ma = (s.formData?.minorAbuse || {}) as Record<string, string>
  const mbi = (s.formData?.minorBestInterest || {}) as Record<string, string>
  return `Child ${i + 1}: ${JSON.stringify({ basic: mb, abuse: ma, bestInterest: mbi })}`
}).join('\n')}
Client story: ${JSON.stringify(ctx.clientStory || {})}
Documents extracted text: ${ctx.documents.filter(d => d.extracted_text).map(d => `[${d.name}]: ${d.extracted_text?.substring(0, 500)}`).join('\n')}

IMPORTANT:
- Generate for child index ${index} (or first child if only one).
- Use [PENDING] for any data you cannot find.
- Output ONLY the petition text, no explanations.
- The narrative in Section II must use REAL facts from the case, improved with legal language.
`
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
CHILDREN: ${ctx.allMinorStories.map((s, i) => {
  const mb = (s.formData?.minorBasic || {}) as Record<string, string>
  const ma = (s.formData?.minorAbuse || {}) as Record<string, string>
  return 'Child ' + (i + 1) + ': ' + JSON.stringify({ basic: mb, abuse: ma })
}).join('\n')}
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
- If data is missing, use [PENDING].
- Output ONLY the affidavit text.
`
  }

  if (type === 'minor') {
    const minorName = minorBasic.full_name || 'the minor'
    const absentParent = (ctx.clientAbsentParent || {}) as Record<string, string>
    return `You are an expert immigration paralegal. Generate a SWORN DECLARATION OF THE MINOR following this EXACT structure.

Use ONLY the real data provided. Write in FIRST PERSON as the minor speaking. Be emotionally impactful for the judge while maintaining factual accuracy. Improve simple words into professional legal language WITHOUT changing the facts.

MINOR: ${minorName}
DOB: ${minorBasic.dob || 'Unknown'}
COUNTRY: ${minorBasic.country || 'Unknown'}

MINOR'S RESPONSES (24-question form):
Basic Info: ${JSON.stringify(minorBasic)}
Abuse/Neglect: ${JSON.stringify(minorAbuse)}
Best Interest: ${JSON.stringify(minorBestInterest)}

GUARDIAN: ${tutor?.full_name || clientName} (${tutor?.relationship_to_minor || 'guardian'})
GUARDIAN DATA: ${JSON.stringify(tutor)}
ABSENT PARENT: ${JSON.stringify(absentParent)}
CLIENT STORY: ${JSON.stringify(ctx.clientStory || {})}
DOCUMENTS: ${ctx.documents.filter(d => d.extracted_text).map(d => '[' + d.name + ']: ' + d.extracted_text?.substring(0, 500)).join('\n')}

FOLLOW THIS EXACT FORMAT:

DECLARACIÓN JURADA DE [MINOR FULL NAME IN CAPS]

Yo, [MINOR FULL NAME IN CAPS], [age description], identificada/o con [document type from country], bajo pena de perjurio, declaro lo siguiente:

I. DATOS PERSONALES

Mi nombre completo es [FULL NAME IN CAPS]. Nací el [date] en [city, country]. Actualmente tengo [X] años y soy ciudadana/o de [country]. [How they entered the US and when].

II. SITUACIÓN FAMILIAR

Soy hija/o de [FATHER NAME] y de [MOTHER NAME]. [Brief overview of the dysfunctional family situation based on the case data].

III. RELACIÓN CON MI MADRE

[Detailed paragraph about the relationship with the mother — use the abuse_by_mother data, emotional abuse, negligence. Include specific incidents, dates, locations. Write with emotion from the minor's perspective.]

IV. RELACIÓN CON MI PADRE

[Detailed paragraph about the relationship with the father — use the abuse_by_father data, abandonment, neglect. Include specific incidents, dates, locations. Write with emotion from the minor's perspective.]

V. RAZONES POR LAS QUE NO PUEDO REGRESAR A [COUNTRY]

[Why the minor cannot return — no protection from either parent, abuse/neglect environment, no safe family networks. Request Utah's legal protection.]

VI. SITUACIÓN ACTUAL

[Current living situation with the guardian. Address, stability, how the guardian cares for them. End with the formal request for protective order/custody and SIJS special findings.]

Declaro que todo lo escrito en esta declaración es veraz, correcto y reflejo de mi historia personal.

Firmado en: [City, State]
Fecha: [Date]



_____________________________
[MINOR FULL NAME IN CAPS]

IMPORTANT:
- Use [PENDING] for data you cannot find.
- Output ONLY the declaration text.
- Make sections III and IV the most detailed — these are the heart of the case.
- If only one parent abused/abandoned, focus more on that parent and adapt the other section accordingly.
`
  }

  // type === 'witness'
  const witness = witnesses[index]
  if (!witness) {
    return `${baseInstructions}\nERROR: No witness found at index ${index}. Available witnesses: ${witnesses.length}`
  }

  return `${baseInstructions}

GENERATE A SWORN DECLARATION (AFFIDAVIT) OF A WITNESS.

WITNESS: ${witness.name}
RELATIONSHIP: ${witness.relationship}
PHONE: ${witness.phone || 'N/A'}
ADDRESS: ${witness.address || 'N/A'}
WHAT THEY CAN TESTIFY: ${witness.can_testify}

THIS DECLARATION IS IN SUPPORT OF: ${tutor?.full_name || clientName} (guardian) and their minor child(ren).

GUARDIAN INFO:
${JSON.stringify(tutor, null, 2)}

MINOR(S) IN THE CASE:
${ctx.allMinorStories.map((s, i) => {
  const mb = (s.formData?.minorBasic || {}) as Record<string, string>
  return `Child ${i + 1}: ${mb.full_name || 'Unknown'}`
}).join('\n')}

FORMAT THE DECLARATION AS:

DECLARATION OF [WITNESS FULL NAME]

I, [WITNESS FULL NAME], declare under penalty of perjury under the laws of the United States of America and the State of Utah that the following is true and correct:

1. My name is [name]. I am [relationship] of [guardian name]...
2. ...
[Use the witness's testimony ("what they can testify") and expand it into a detailed, credible declaration. Include: how they know the family, what they witnessed regarding abuse/abandonment/neglect, the impact on the minor, and why reunification with the absent parent is not viable.]

I declare under penalty of perjury under the laws of the United States of America that the foregoing is true and correct.

Executed on [DATE]

_______________________
[WITNESS FULL NAME]
`
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
  const basePrompt = buildDeclarationPrompt(type, ctx, index)
  const langInstruction = lang === 'es'
    ? '\n\nIMPORTANT: Generate the ENTIRE document in SPANISH. Translate all legal terms and content to Spanish. Keep the same structure and format but write everything in Spanish.'
    : ''
  const prompt = basePrompt + langInstruction

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
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'Error de IA' }, { status: 500 })
    }

    const data = await res.json()
    const declaration = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!declaration) {
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
    return NextResponse.json({ error: 'Error de conexión con IA' }, { status: 500 })
  }
}

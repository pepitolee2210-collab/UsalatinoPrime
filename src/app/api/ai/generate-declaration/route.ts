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
    return `${baseInstructions}

GENERATE A SWORN DECLARATION (AFFIDAVIT) OF THE GUARDIAN/PARENT.

DECLARANT: ${tutor?.full_name || clientName}
RELATIONSHIP TO MINOR: ${tutor?.relationship_to_minor || 'Mother/Guardian'}

GUARDIAN DATA (from 23-question legal form):
${JSON.stringify(tutor, null, 2)}

MINOR DECLARATIONS IN THIS CASE:
${ctx.allMinorStories.map((s, i) => {
  const mb = (s.formData?.minorBasic || {}) as Record<string, string>
  return `Child ${i + 1}: ${mb.full_name || 'Unknown'}, DOB: ${mb.dob || 'Unknown'}, Country: ${mb.country || 'Unknown'}`
}).join('\n')}

ADDITIONAL CONTEXT:
- Client story: ${JSON.stringify(ctx.clientStory || {})}
- Absent parent info: ${JSON.stringify(ctx.clientAbsentParent || {})}

FORMAT THE DECLARATION AS:

DECLARATION OF [FULL NAME]

I, [FULL NAME], declare under penalty of perjury under the laws of the United States of America and the State of Utah that the following is true and correct:

1. My name is [full name]. I am [age] years old...
2. ...
[Continue with all relevant facts organized logically: identity, relationship, arrival to US, circumstances of abuse/abandonment/neglect, current care of minor, why reunification is not viable]

I declare under penalty of perjury under the laws of the United States of America that the foregoing is true and correct.

Executed on [DATE]

_______________________
[FULL NAME]
`
  }

  if (type === 'minor') {
    const minorName = minorBasic.full_name || 'the minor'
    return `${baseInstructions}

GENERATE A SWORN DECLARATION (AFFIDAVIT) OF THE MINOR CHILD.

MINOR: ${minorName}
DOB: ${minorBasic.dob || 'Unknown'}
COUNTRY: ${minorBasic.country || 'Unknown'}

MINOR'S RESPONSES (from 24-question legal form):
Basic Info: ${JSON.stringify(minorBasic)}
Abuse/Neglect: ${JSON.stringify(minorAbuse)}
Best Interest: ${JSON.stringify(minorBestInterest)}

GUARDIAN INFO: ${tutor?.full_name || clientName} (${tutor?.relationship_to_minor || 'guardian'})

ADDITIONAL CONTEXT:
- Client story: ${JSON.stringify(ctx.clientStory || {})}
- Absent parent: ${JSON.stringify(ctx.clientAbsentParent || {})}

FORMAT THE DECLARATION AS:

DECLARATION OF [MINOR FULL NAME]

I, [MINOR FULL NAME], declare under penalty of perjury under the laws of the United States of America and the State of Utah that the following is true and correct:

1. My name is [name]. I am [age] years old...
2. ...
[Cover: identity, life in country of origin, abuse by father/mother, physical/emotional abuse, neglect, abandonment, arrival to US, current life, fear of return, desire to stay]

Write with sensitivity — this is a child's perspective. Make it emotionally impactful for the judge while maintaining factual accuracy.

I declare under penalty of perjury under the laws of the United States of America that the foregoing is true and correct.

Executed on [DATE]

_______________________
[MINOR FULL NAME]
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

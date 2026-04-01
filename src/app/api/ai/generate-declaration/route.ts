import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCaseContext } from '@/lib/ai/prompts/chat-system'

const GEMINI_KEY = process.env.GEMINI_API_KEY

type DeclarationType = 'tutor' | 'minor' | 'witness'

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

  const { case_id, type, index = 0 } = await request.json() as {
    case_id: string
    type: DeclarationType
    index?: number
  }

  if (!case_id || !type) {
    return NextResponse.json({ error: 'case_id y type requeridos' }, { status: 400 })
  }

  // Build context
  const ctx = await buildCaseContext(case_id)
  const prompt = buildDeclarationPrompt(type, ctx, index)

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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCaseContext } from '@/lib/ai/prompts/chat-system'

const GEMINI_KEY = process.env.GEMINI_API_KEY

type DeclarationType = 'tutor' | 'minor' | 'witness' | 'parental_consent' | 'petition_guardianship'

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
  index: number
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
  const suppBlock = supp ? `
=== ADDITIONAL DATA FROM ATTORNEY (use these to fill any missing information) ===
Court: ${JSON.stringify((supp as Record<string, unknown>).court || {})}
Guardian supplementary: ${JSON.stringify((supp as Record<string, unknown>).guardian || {})}
Absent parents supplementary: ${JSON.stringify((supp as Record<string, unknown>).absent_parents || [])}
Minors supplementary: ${JSON.stringify((supp as Record<string, unknown>).minors || [])}
Witnesses supplementary: ${JSON.stringify((supp as Record<string, unknown>).witnesses || [])}
IMPORTANT: Use this supplementary data to fill in any passport numbers, ID numbers, nationalities, court names, or other details that are missing from the main case data. Prefer this data over [PENDING] placeholders.
` : ''

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
    // Get absent parent for THIS specific child
    const absentParent = (ctx.allAbsentParents[index] || ctx.clientAbsentParent || {}) as Record<string, string>
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
- Use the court name from the supplementary data if provided. Do NOT default to Utah.
- Output ONLY the letter text, nothing else. No explanations.
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
- Use [PENDING] for any data you cannot find.
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
- If data is missing, use [PENDING].
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
- Use [PENDING] for data you cannot find.
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
  return `You are an expert immigration paralegal. Generate a SWORN AFFIDAVIT OF A WITNESS following this EXACT structure.

Use ONLY the real data. Write in FIRST PERSON as the witness speaking. Use narrative paragraphs (NOT numbered). Each paragraph covers one aspect of the testimony.

WITNESS: ${witness.name}
RELATIONSHIP TO FAMILY: ${witness.relationship}
ADDRESS: ${witness.address || 'N/A'}
WHAT THEY CAN TESTIFY: ${witness.can_testify}

GUARDIAN/PARENT: ${tutor?.full_name || clientName} (${tutor?.relationship_to_minor || 'guardian'})
ABSENT PARENT: ${absentParent.parent_name || '[PENDING]'}
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
- Use [PENDING] for data you cannot find (like ID numbers).
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
  const basePrompt = buildDeclarationPrompt(type, ctx, index)
  const langInstruction = lang === 'es'
    ? '\n\nIMPORTANT: Generate the ENTIRE document in SPANISH. Translate all legal terms and content to Spanish. Keep the same structure and format but write everything in Spanish.'
    : ''
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

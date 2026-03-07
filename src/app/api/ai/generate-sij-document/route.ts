import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/ai/gemini'
import { SIJ_SYSTEM_PROMPT, buildSijPrompt, SIJ_DOCUMENT_TYPES } from '@/lib/ai/prompts/sij-affidavit'
import type { SijGenerationInput } from '@/lib/ai/prompts/sij-affidavit'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, input } = body as { token?: string; input?: SijGenerationInput }

    if (!token || !input) {
      return NextResponse.json({ error: 'Token and input are required' }, { status: 400 })
    }

    // Validate document type
    const validTypes = SIJ_DOCUMENT_TYPES.map(d => d.id)
    if (!validTypes.includes(input.document_type)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    }

    // Validate required fields
    if (!input.minor_full_name || !input.minor_dob || !input.minor_country_of_birth) {
      return NextResponse.json({ error: 'Minor information is required' }, { status: 400 })
    }
    if (!input.declarant_full_name || !input.declarant_relationship) {
      return NextResponse.json({ error: 'Declarant information is required' }, { status: 400 })
    }
    if (!input.absent_parent_full_name) {
      return NextResponse.json({ error: 'Absent parent name is required' }, { status: 400 })
    }
    if (!input.key_facts || input.key_facts.trim().length < 20) {
      return NextResponse.json({ error: 'Key facts must be at least 20 characters' }, { status: 400 })
    }

    // Validate token → get case
    const supabase = createServiceClient()
    const { data: tokenData, error: tokenError } = await supabase
      .from('appointment_tokens')
      .select('client_id, case_id, is_active')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData || !tokenData.is_active) {
      return NextResponse.json({ error: 'Invalid or inactive token' }, { status: 403 })
    }

    // Build the user prompt with structured data
    const userPrompt = buildSijPrompt(input)

    // Call Gemini
    const gemini = getGeminiClient()
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      config: {
        systemInstruction: SIJ_SYSTEM_PROMPT,
        temperature: 0.7,
        topP: 0.9,
      },
      contents: userPrompt,
    })

    const generatedText = response.text

    if (!generatedText) {
      return NextResponse.json({ error: 'AI did not generate a response' }, { status: 500 })
    }

    // Save to case_form_submissions
    const docLabel = SIJ_DOCUMENT_TYPES.find(d => d.id === input.document_type)?.label || input.document_type
    const { data: submission, error: saveError } = await supabase
      .from('case_form_submissions')
      .upsert({
        case_id: tokenData.case_id,
        client_id: tokenData.client_id,
        form_type: input.document_type,
        form_data: {
          input,
          generated_document: generatedText,
          generated_at: new Date().toISOString(),
          model: GEMINI_MODEL,
        },
        status: 'draft',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'case_id,form_type',
      })
      .select('id')
      .single()

    if (saveError) {
      // Still return the document even if save fails
      console.error('Failed to save submission:', saveError)
    }

    return NextResponse.json({
      document: generatedText,
      document_type: input.document_type,
      document_label: docLabel,
      submission_id: submission?.id || null,
    })
  } catch (error) {
    console.error('AI generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate document' },
      { status: 500 }
    )
  }
}

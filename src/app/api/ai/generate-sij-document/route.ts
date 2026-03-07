import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/ai/gemini'
import { SIJ_SYSTEM_PROMPT, buildSijPrompt, SIJ_DOCUMENT_TYPES } from '@/lib/ai/prompts/sij-affidavit'
import { CREDIBLE_FEAR_SYSTEM_PROMPT, buildCredibleFearPrompt, CREDIBLE_FEAR_DOCUMENT_TYPES } from '@/lib/ai/prompts/credible-fear'
import { WITNESS_SYSTEM_PROMPT, buildWitnessPrompt, WITNESS_DOCUMENT_TYPES } from '@/lib/ai/prompts/witness-testimony'

type AgentType = 'sij' | 'credible_fear' | 'witness'

const AGENTS: Record<AgentType, {
  systemPrompt: string
  documentTypes: readonly { id: string; label: string }[]
  buildPrompt: (input: any) => string
  validateInput: (input: any) => string | null
}> = {
  sij: {
    systemPrompt: SIJ_SYSTEM_PROMPT,
    documentTypes: SIJ_DOCUMENT_TYPES,
    buildPrompt: buildSijPrompt,
    validateInput: (input) => {
      if (!input.minor_full_name) return 'Minor name is required'
      if (!input.declarant_full_name) return 'Declarant name is required'
      if (!input.absent_parent_full_name) return 'Absent parent name is required'
      if (!input.key_facts || input.key_facts.trim().length < 20) return 'Key facts must be at least 20 characters'
      return null
    },
  },
  credible_fear: {
    systemPrompt: CREDIBLE_FEAR_SYSTEM_PROMPT,
    documentTypes: CREDIBLE_FEAR_DOCUMENT_TYPES,
    buildPrompt: buildCredibleFearPrompt,
    validateInput: (input) => {
      if (!input.applicant_full_name) return 'Applicant name is required'
      if (!input.country_of_origin) return 'Country of origin is required'
      if (!input.who_harmed) return 'Who harmed is required'
      if (!input.what_happened || input.what_happened.trim().length < 20) return 'What happened must be at least 20 characters'
      if (!input.why_cannot_return) return 'Why cannot return is required'
      return null
    },
  },
  witness: {
    systemPrompt: WITNESS_SYSTEM_PROMPT,
    documentTypes: WITNESS_DOCUMENT_TYPES,
    buildPrompt: buildWitnessPrompt,
    validateInput: (input) => {
      if (!input.subject_full_name) return 'Subject name is required'
      if (!input.witness_full_name) return 'Witness name is required'
      if (!input.witness_relationship) return 'Witness relationship is required'
      if (!input.what_happened || input.what_happened.trim().length < 20) return 'What happened must be at least 20 characters'
      if (!input.what_witness_observed) return 'What witness observed is required'
      return null
    },
  },
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, agent, input } = body as {
      token?: string
      agent?: AgentType
      input?: any
    }

    if (!token || !agent || !input) {
      return NextResponse.json({ error: 'Token, agent, and input are required' }, { status: 400 })
    }

    const agentConfig = AGENTS[agent]
    if (!agentConfig) {
      return NextResponse.json({ error: 'Invalid agent type. Valid: sij, credible_fear, witness' }, { status: 400 })
    }

    // Validate document type
    const validTypes = agentConfig.documentTypes.map(d => d.id)
    if (!validTypes.includes(input.document_type)) {
      return NextResponse.json({ error: 'Invalid document type for this agent' }, { status: 400 })
    }

    // Validate input fields
    const validationError = agentConfig.validateInput(input)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
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

    // Build prompt and call Gemini
    const userPrompt = agentConfig.buildPrompt(input)
    const gemini = getGeminiClient()
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      config: {
        systemInstruction: agentConfig.systemPrompt,
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
    const docLabel = agentConfig.documentTypes.find(d => d.id === input.document_type)?.label || input.document_type
    const { data: submission, error: saveError } = await supabase
      .from('case_form_submissions')
      .upsert({
        case_id: tokenData.case_id,
        client_id: tokenData.client_id,
        form_type: `${agent}_${input.document_type}`,
        form_data: {
          agent,
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
      console.error('Failed to save submission:', saveError)
    }

    return NextResponse.json({
      document: generatedText,
      agent,
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

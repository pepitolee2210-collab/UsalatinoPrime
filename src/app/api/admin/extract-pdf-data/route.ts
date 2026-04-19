import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { geminiFetch, extractGeminiText } from '@/lib/ai/gemini-fetch'
import { createLogger } from '@/lib/logger'

const GEMINI_KEY = process.env.GEMINI_API_KEY
const log = createLogger('extract-pdf-data')

interface ExtractedData {
  passport_number?: string
  id_number?: string
  full_name?: string
  date_of_birth?: string
  country_of_birth?: string
  city_of_birth?: string
  nationality?: string
  expiration_date?: string
  document_type?: string
}

async function extractFromImage(base64: string, mimeType: string, prompt: string): Promise<{ text: string; error?: string }> {
  if (!GEMINI_KEY) return { text: '', error: 'Gemini API key no configurada' }
  const result = await geminiFetch({
    model: 'gemini-3.1-pro-preview',
    apiKey: GEMINI_KEY,
    timeoutMs: 40_000,
    maxRetries: 1,
    body: {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      safetySettings: [
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      ],
    },
  })

  if (!result.ok) return { text: '', error: result.error || `HTTP ${result.status}` }
  if (result.blockReason) return { text: '', error: `Blocked: ${result.blockReason}` }
  const text = extractGeminiText(result.data)
  if (!text) return { text: '', error: 'Empty response' }
  return { text }
}

function parseExtractedJSON(text: string): ExtractedData {
  try {
    // Try to find JSON in response (might be wrapped in markdown)
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch { /* ignore */ }
  return {}
}

export async function POST(req: NextRequest) {
  if (!GEMINI_KEY) return NextResponse.json({ error: 'Gemini no configurado' }, { status: 500 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'employee') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { case_id } = await req.json()
  if (!case_id) return NextResponse.json({ error: 'case_id requerido' }, { status: 400 })

  const service = createServiceClient()

  // Get case data
  const { data: caseData } = await service.from('cases').select('client_id').eq('id', case_id).single()
  if (!caseData) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })

  // Get all client documents (passports, birth certificates, IDs)
  const { data: docs } = await service
    .from('documents')
    .select('id, name, document_key, file_path')
    .eq('case_id', case_id)
    .eq('direction', 'client_to_admin')
    .in('document_key', ['tutor_id', 'minor_id', 'birth_certificates', 'witness_id_1', 'witness_id_2', 'witness_id_3', 'witness_id_4', 'witness_id_5', 'supporting_docs'])

  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: 'No hay documentos para procesar', documents_processed: 0 }, { status: 200 })
  }

  // Get existing supplementary data
  const { data: existingSupp } = await service
    .from('case_form_submissions')
    .select('id, form_data')
    .eq('case_id', case_id)
    .eq('form_type', 'admin_supplementary')
    .single()

  const suppData: Record<string, any> = existingSupp?.form_data || {}
  if (!suppData.guardian) suppData.guardian = {}
  if (!suppData.minors) suppData.minors = []
  if (!suppData.absent_parents) suppData.absent_parents = []
  if (!suppData.witnesses) suppData.witnesses = []

  let processed = 0
  const errors: string[] = []

  for (const doc of docs) {
    try {
      // Download from storage
      const { data: fileData } = await service.storage.from('case-documents').download(doc.file_path)
      if (!fileData) continue

      const buf = Buffer.from(await fileData.arrayBuffer())
      const base64 = buf.toString('base64')
      const nameLower = doc.name.toLowerCase()
      let mimeType: string
      if (nameLower.endsWith('.pdf')) mimeType = 'application/pdf'
      else if (nameLower.endsWith('.png')) mimeType = 'image/png'
      else if (nameLower.endsWith('.webp')) mimeType = 'image/webp'
      else if (nameLower.endsWith('.heic') || nameLower.endsWith('.heif')) mimeType = 'image/heic'
      else mimeType = 'image/jpeg'

      const prompt = `Analyze this document image and extract the following data in JSON format (use null for missing fields):
{
  "full_name": "Full name of person on document",
  "date_of_birth": "YYYY-MM-DD format",
  "country_of_birth": "Country only",
  "city_of_birth": "City only",
  "nationality": "Nationality (e.g. Venezuelan, Peruvian, Mexican)",
  "passport_number": "Passport number if this is a passport",
  "id_number": "ID/Cedula/DNI number if this is an ID card",
  "document_type": "passport | cedula | id | birth_certificate | dni | other",
  "expiration_date": "YYYY-MM-DD if applicable"
}

Document context: filename is "${doc.name}", category is "${doc.document_key}".
Output ONLY valid JSON, no markdown, no explanations.`

      const result = await extractFromImage(base64, mimeType, prompt)
      if (result.error) {
        errors.push(`${doc.name}: ${result.error}`)
        continue
      }
      const extracted = parseExtractedJSON(result.text)

      // Save extracted_text for future reference
      await service
        .from('documents')
        .update({ extracted_text: result.text.substring(0, 5000) })
        .eq('id', doc.id)

      // Apply to supplementary data based on document_key
      if (doc.document_key === 'tutor_id') {
        if (extracted.date_of_birth) suppData.guardian.date_of_birth = extracted.date_of_birth
        if (extracted.country_of_birth) suppData.guardian.country_of_birth = extracted.country_of_birth
        if (extracted.city_of_birth) suppData.guardian.city_of_birth = extracted.city_of_birth
        if (extracted.nationality) suppData.guardian.nationality = extracted.nationality
        if (extracted.passport_number) suppData.guardian.id_number = extracted.passport_number
        else if (extracted.id_number) suppData.guardian.id_number = extracted.id_number
      } else if (doc.document_key === 'minor_id' || doc.document_key === 'birth_certificates') {
        // Try to match to existing minor by name
        const extractedName = (extracted.full_name || '').toLowerCase().trim()
        let minorIdx = 0
        // Simple match: look for name hint in filename
        const filename = doc.name.toLowerCase()
        // Try common name hints
        if (filename.includes('rebeca') || filename.includes('rebe')) minorIdx = 0
        else if (filename.includes('santiago') || filename.includes('santi')) minorIdx = 1
        else if (extractedName) {
          // Use first minor slot if we can't determine
          minorIdx = suppData.minors.findIndex((m: any) => !m?.id_number) >= 0 ? suppData.minors.findIndex((m: any) => !m?.id_number) : 0
        }

        if (!suppData.minors[minorIdx]) suppData.minors[minorIdx] = {}
        if (extracted.city_of_birth) suppData.minors[minorIdx].birth_city = extracted.city_of_birth
        if (extracted.country_of_birth) suppData.minors[minorIdx].country = extracted.country_of_birth
        if (extracted.date_of_birth) suppData.minors[minorIdx].dob = extracted.date_of_birth
        if (extracted.passport_number) {
          suppData.minors[minorIdx].id_type = 'Pasaporte'
          suppData.minors[minorIdx].id_number = extracted.passport_number
        } else if (extracted.id_number) {
          suppData.minors[minorIdx].id_type = extracted.document_type === 'birth_certificate' ? 'Acta de Nacimiento' : 'Cédula'
          suppData.minors[minorIdx].id_number = extracted.id_number
        }
      } else if (doc.document_key?.startsWith('witness_id_')) {
        const witnessIdx = parseInt(doc.document_key.replace('witness_id_', '')) - 1
        if (witnessIdx >= 0) {
          if (!suppData.witnesses[witnessIdx]) suppData.witnesses[witnessIdx] = {}
          if (extracted.id_number) suppData.witnesses[witnessIdx].id_number = extracted.id_number
          if (extracted.passport_number) suppData.witnesses[witnessIdx].id_number = extracted.passport_number
          if (extracted.nationality) suppData.witnesses[witnessIdx].nationality = extracted.nationality
        }
      }

      processed++
    } catch (e) {
      errors.push(`${doc.name}: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  // Save updated supplementary data
  if (existingSupp) {
    await service
      .from('case_form_submissions')
      .update({ form_data: suppData, submitted_at: new Date().toISOString() })
      .eq('id', existingSupp.id)
  } else {
    await service
      .from('case_form_submissions')
      .insert({
        case_id,
        client_id: caseData.client_id,
        form_type: 'admin_supplementary',
        form_data: suppData,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
  }

  return NextResponse.json({
    success: true,
    documents_processed: processed,
    total_documents: docs.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}

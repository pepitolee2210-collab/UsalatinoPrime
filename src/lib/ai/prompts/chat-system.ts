import { createServiceClient } from '@/lib/supabase/service'

interface CaseContext {
  caseId: string
  caseNumber: string
  serviceName: string
  serviceSlug: string
  client: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }
  formData: Record<string, unknown>
  henryNotes: unknown
  documents: { name: string; document_key: string; status: string; extracted_text: string | null }[]
  clientStory: Record<string, unknown> | null
  clientWitnesses: Record<string, unknown> | null
  clientAbsentParent: Record<string, unknown> | null
  allAbsentParents: Record<string, unknown>[]
  tutorGuardian: Record<string, unknown> | null
  allMinorStories: { minorIndex: number; formData: Record<string, unknown>; status: string }[]
  supplementaryData: Record<string, unknown> | null
}

export async function buildCaseContext(caseId: string): Promise<CaseContext> {
  const supabase = createServiceClient()

  const [caseRes, docsRes, storyRes, witnessRes, parentRes, tutorRes, allStoriesRes, supplementaryRes, allParentsRes] = await Promise.all([
    supabase
      .from('cases')
      .select('*, client:profiles(first_name, last_name, email, phone), service:service_catalog(name, slug)')
      .eq('id', caseId)
      .single(),
    supabase
      .from('documents')
      .select('name, document_key, status, extracted_text')
      .eq('case_id', caseId)
      .eq('direction', 'client_to_admin'),
    supabase
      .from('case_form_submissions')
      .select('form_data, status')
      .eq('case_id', caseId)
      .eq('form_type', 'client_story')
      .single(),
    supabase
      .from('case_form_submissions')
      .select('form_data, status')
      .eq('case_id', caseId)
      .eq('form_type', 'client_witnesses')
      .single(),
    supabase
      .from('case_form_submissions')
      .select('form_data, status')
      .eq('case_id', caseId)
      .eq('form_type', 'client_absent_parent')
      .single(),
    // New: tutor_guardian (30 questions)
    supabase
      .from('case_form_submissions')
      .select('form_data, status')
      .eq('case_id', caseId)
      .eq('form_type', 'tutor_guardian')
      .single(),
    // New: ALL client_story submissions (multiple children)
    supabase
      .from('case_form_submissions')
      .select('form_data, status, minor_index')
      .eq('case_id', caseId)
      .eq('form_type', 'client_story')
      .order('minor_index', { ascending: true }),
    // Admin supplementary data (passport numbers, court info, etc.)
    supabase
      .from('case_form_submissions')
      .select('form_data')
      .eq('case_id', caseId)
      .eq('form_type', 'admin_supplementary')
      .single(),
    // ALL absent parent submissions
    supabase
      .from('case_form_submissions')
      .select('form_data, minor_index')
      .eq('case_id', caseId)
      .eq('form_type', 'client_absent_parent')
      .order('minor_index', { ascending: true }),
  ])

  const caseData = caseRes.data
  const client = Array.isArray(caseData?.client) ? caseData.client[0] : caseData?.client
  const service = Array.isArray(caseData?.service) ? caseData.service[0] : caseData?.service

  return {
    caseId,
    caseNumber: caseData?.case_number || 'Sin número',
    serviceName: service?.name || 'Desconocido',
    serviceSlug: service?.slug || '',
    client: {
      firstName: client?.first_name || '',
      lastName: client?.last_name || '',
      email: client?.email || '',
      phone: client?.phone || '',
    },
    formData: caseData?.form_data || {},
    henryNotes: caseData?.henry_notes || null,
    documents: docsRes.data || [],
    clientStory: storyRes.data?.form_data || null,
    clientWitnesses: witnessRes.data?.form_data || null,
    clientAbsentParent: parentRes.data?.form_data || null,
    allAbsentParents: (allParentsRes.data || []).map(p => p.form_data),
    tutorGuardian: tutorRes.data?.form_data || null,
    allMinorStories: (allStoriesRes.data || []).map(s => ({
      minorIndex: s.minor_index,
      formData: s.form_data,
      status: s.status,
    })),
    supplementaryData: supplementaryRes.data?.form_data || null,
  }
}

export function buildSystemPrompt(ctx: CaseContext): string {
  const parts: string[] = []

  parts.push(BASE_SYSTEM_PROMPT)

  // Case info
  parts.push(`\n## DATOS DEL CASO ACTUAL
- Caso: ${ctx.caseNumber}
- Servicio: ${ctx.serviceName}
- Cliente: ${ctx.client.firstName} ${ctx.client.lastName}
- Email: ${ctx.client.email}
- Teléfono: ${ctx.client.phone}`)

  // Form data (intake)
  if (ctx.formData && Object.keys(ctx.formData).length > 0) {
    parts.push(`\n## DATOS DEL FORMULARIO DE INTAKE
${formatFormData(ctx.formData)}`)
  }

  // Documents uploaded by client (with extracted text)
  if (ctx.documents.length > 0) {
    const docSections = ctx.documents.map(d => {
      let entry = `### ${d.name} (${d.document_key})`
      if (d.extracted_text && !d.extracted_text.startsWith('[Error')) {
        entry += `\nDatos extraídos:\n${d.extracted_text}`
      } else {
        entry += `\n(Documento subido, pendiente de procesamiento)`
      }
      return entry
    }).join('\n\n')
    parts.push(`\n## DOCUMENTOS SUBIDOS POR EL CLIENTE (${ctx.documents.length} archivos)
${docSections}`)
  }

  // Client story
  if (ctx.clientStory) {
    parts.push(`\n## RELATO DEL CLIENTE (llenado por el cliente en el wizard)
${formatFormData(ctx.clientStory)}`)
  }

  // Witnesses
  if (ctx.clientWitnesses) {
    parts.push(`\n## TESTIGOS REGISTRADOS
${formatFormData(ctx.clientWitnesses)}`)
  }

  // Absent parent
  if (ctx.clientAbsentParent) {
    parts.push(`\n## SITUACIÓN DEL PADRE/MADRE AUSENTE
${formatFormData(ctx.clientAbsentParent)}`)
  }

  // Henry notes
  if (ctx.henryNotes) {
    const notes = typeof ctx.henryNotes === 'string' ? ctx.henryNotes : JSON.stringify(ctx.henryNotes)
    parts.push(`\n## NOTAS DE HENRY
${notes}`)
  }

  return parts.join('\n')
}

function formatFormData(data: Record<string, unknown>): string {
  return Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      if (typeof v === 'object') return `- ${label}: ${JSON.stringify(v)}`
      return `- ${label}: ${v}`
    })
    .join('\n')
}

const BASE_SYSTEM_PROMPT = `Eres un asistente legal especializado en inmigración de Estados Unidos. Trabajas con Henry, un consultor de inmigración de USA Latino que atiende casos de Visa Juvenil (Special Immigrant Juvenile - SIJ), asilo, ajuste de estatus y otros servicios migratorios.

## TU ROL
- Eres el asistente de IA de Henry dentro de su plataforma de gestión de casos
- Tienes acceso a TODOS los datos del caso actual (cliente, documentos, relato, testigos)
- Henry te escribe en español de forma natural e informal
- Tú respondes en español para conversar, pero TODOS los documentos legales los generas en INGLÉS (como requieren las cortes de EE.UU.)

## CONOCIMIENTO LEGAL - VISA JUVENIL (SIJ)
### Qué es SIJ
- Special Immigrant Juvenile Status (SIJS) permite a menores abusados/abandonados/negligidos obtener residencia
- Requiere: (1) orden de corte estatal de custodia, (2) hallazgos SIJ del juez, (3) petición I-360

### Documentos clave que Henry genera
1. **Declaración jurada del tutor (madre/padre)** - AFFIDAVIT: relato detallado del abandono, bajo juramento
2. **Declaración jurada de testigos** - AFFIDAVIT: familiares/amigos que corroboran el abandono
3. **Carta de cesión de custodia voluntaria** - CONSENT REGARDING CUSTODY: del padre ausente SI coopera
4. **Consent email** - Email corto del padre confirmando que recibió documentos del caso
5. **Declaración del menor** - AFFIDAVIT: perspectiva del niño/a sobre el abandono
6. **Petición de custodia** - CUSTODY PETITION: solicitud formal al juez

### Formato de Affidavit (OBLIGATORIO)
Los affidavits SIEMPRE deben tener:
- Encabezado: "AFFIDAVIT OF [NOMBRE COMPLETO EN MAYÚSCULAS]"
- Apertura: "I, [nombre], born on [fecha], a resident of [país], holder of [tipo ID] identification number [número], declare under penalty of perjury that the following statements are true and correct to the best of my knowledge."
- Puntos numerados con los hechos
- Cierre: "I declare under penalty of perjury that the foregoing is true and correct."
- Firma, fecha, país

### Lo que valoran los jueces de Utah
- Evidencia de abandono real (fechas, hechos concretos)
- Falta de apoyo económico documentada
- Ausencia emocional del padre
- Buena conducta del tutor (paga impuestos, trabaja, cuida al menor)
- Buen desempeño del menor (escuela, comportamiento)
- Testigos creíbles (familiares cercanos, maestros, vecinos)
- AFFIDAVIT tiene más peso que DECLARATION (usar "affidavit" siempre)

## SITUACIONES DEL PADRE AUSENTE (ADAPTATIVO)
Cada caso es diferente. Adapta tus recomendaciones según la situación:

### Si el padre COOPERA:
- Genera carta de cesión de custodia voluntaria (Consent Regarding Custody)
- Genera consent email (confirmación de recepción de documentos)
- El proceso es más rápido y limpio
- Documentos necesarios: carta firmada + email + affidavit del tutor

### Si el padre está AUSENTE (sin contacto):
- Los affidavits deben ser MÁS FUERTES y detallados
- Se necesitan MÁS testigos (mínimo 2)
- Puede requerirse publicación legal de notificación
- Incluir: fechas del último contacto, intentos de comunicación fallidos
- Documentos: affidavits reforzados + declaraciones de familiares cercanos

### Si el padre FALLECIÓ:
- No se necesita custodia del padre
- Enfoque diferente: documentar circunstancias, acta de defunción
- Los affidavits se centran en la historia post-fallecimiento

### Si el padre NUNCA FUE CONOCIDO:
- Abandono desde el nacimiento
- Verificar si aparece en acta de nacimiento
- Declaración de no reconocimiento paterno

## REGLAS DE GENERACIÓN DE DOCUMENTOS
1. SIEMPRE usa datos reales del caso (nombres, fechas, países) — NUNCA inventes datos
2. Si te falta un dato, PREGUNTA antes de inventar
3. Los documentos van en INGLÉS con formato legal profesional
4. Usa "I declare under penalty of perjury" en todos los affidavits
5. Incluye ciudad, país, y fecha de firma al final
6. Para nombres, usa EXACTAMENTE como aparecen en los documentos del caso
7. Si el caso tiene múltiples hijos con padres diferentes, cada hijo requiere documentos separados

## FORMATO DE RESPUESTA
- Cuando generes un documento, ponlo dentro de un bloque con encabezado claro
- Separa claramente la conversación del documento
- Después de generar, pregunta si Henry quiere modificar algo
- Si Henry pide cambios, actualiza el documento completo (no solo la parte cambiada)

## IMPORTANTE
- NO repitas información que Henry ya conoce
- Sé directo y profesional
- Si Henry pide algo que no tiene suficientes datos, dile qué falta
- Puedes sugerir documentos adicionales que fortalezcan el caso
- Siempre ten en mente: el objetivo es demostrar el ABANDONO ante el juez`

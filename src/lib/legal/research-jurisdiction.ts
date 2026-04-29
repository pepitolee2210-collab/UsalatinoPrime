import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { jsonrepair } from 'jsonrepair'
import { createLogger } from '@/lib/logger'
import type { ClientLocation } from './resolve-client-location'
import { getStateCourtHint } from './state-court-registry'
import { getRegisteredSlugCatalogMarkdown } from './automated-forms-registry'
import {
  validateSIJCorePackage,
  buildTargetedQueries,
  describeMissingFamilies,
  type SIJCoreFamily,
} from './sij-core-validator'
import type { UsStateCode } from '@/lib/timezones/us-states'

const log = createLogger('research-jurisdiction')

const RESEARCH_MODEL = 'claude-opus-4-7'

/**
 * Resultado estructurado de la investigación. Se guarda tal cual en
 * `case_jurisdictions`. Las URLs en `sources` son la prueba auditable de
 * que la información viene de fuentes oficiales (.gov/.us).
 */
export type FilingChannel = 'in_person' | 'email' | 'portal' | 'mail' | 'hybrid'

export type AttachmentType =
  | 'birth_certificate'
  | 'school_records'
  | 'medical_records'
  | 'psych_evaluation'
  | 'parental_consent'
  | 'abandonment_proof'
  | 'other'

export interface RequiredForm {
  name: string
  url_official: string
  description_es: string
  is_mandatory: boolean
  /**
   * Slug estable para identificar el form en la UI (ej. 'tx-fm-sapcr-100').
   * Cuando esté presente, la UI puede activar features extras (formulario
   * interactivo, prefill, generación local). Sin slug, el form se trata como
   * link externo solamente.
   */
  slug?: string | null
}

export interface FilingStep {
  step_number: number
  title_es: string
  detail_es: string
  estimated_time: string | null
  requires_client_action: boolean
}

export interface AttachmentRequirement {
  type: AttachmentType
  description_es: string
}

export interface FeesInfo {
  amount_usd: number
  currency: 'USD'
  waivable: boolean
  waiver_form_name: string | null
  waiver_form_url: string | null
}

/**
 * Radicación de la presentación (intake) — etapa 1 según Henry.
 * Los formularios administrativos que el clerk requiere ANTES de asignar
 * número de caso. Cada juzgado tiene los suyos (coversheets, cartas de
 * solicitud, formularios de registro inicial). Varían por distrito
 * dentro del mismo estado.
 */
export interface IntakePacket {
  required_forms: RequiredForm[]
  filing_steps: FilingStep[]
  filing_channel: FilingChannel | null
  procedure_es: string | null
  notes: string | null
}

export interface JurisdictionResearchResult {
  state_code: string
  state_name: string
  court_name: string
  court_name_es: string | null
  court_address: string | null
  filing_procedure: string | null
  filing_procedure_es: string | null
  age_limit_sijs: 18 | 21 | null
  sources: string[]
  confidence: 'high' | 'medium' | 'low'
  notes: string | null
  /** Radicación de la presentación (etapa 1) — formularios administrativos */
  intake_packet: IntakePacket
  /** Radicación del procedimiento del caso (etapa 2) — lo que evalúa el juez */
  filing_channel: FilingChannel | null
  required_forms: RequiredForm[]
  filing_steps: FilingStep[]
  attachments_required: AttachmentRequirement[]
  fees: FeesInfo | null
  /**
   * Familias SIJS core que la IA NO encontró tras los reintentos. Vacío
   * cuando la investigación pasó la validación. Cuando contiene entries,
   * el caller persiste research_status='incomplete' en lugar de 'completed'
   * y muestra un badge en la UI para que Henry sepa qué falta agregar a
   * mano (o re-investigar después).
   */
  _missing_families?: SIJCoreFamily[]
}

/**
 * Zod schema — Claude a veces omite campos opcionales. `.nullable()` donde
 * aplica; el client hace el fallback a null.
 */
// Schema permisivo: Claude no siempre se ajusta a enums estrechos.
// Validamos lo crítico (state_code, court_name, sources) y dejamos pasar
// el resto con coerciones suaves. La limpieza fina (filtro .gov/.us, etc.)
// la hace post-hoc el código abajo.
const FormSchema = z.object({
  name: z.string().min(1),
  url_official: z.string().min(1),
  description_es: z.string().min(1),
  is_mandatory: z.boolean().catch(true),
  slug: z.string().optional().nullable().transform(v => v ?? null),
})

const StepSchema = z.object({
  step_number: z.number().int().positive().catch(1),
  title_es: z.string().min(1),
  detail_es: z.string().min(1),
  estimated_time: z.string().nullable().optional().transform(v => v ?? null),
  requires_client_action: z.boolean().catch(true),
})

const ResearchSchema = z.object({
  state_code: z.string().min(2).max(4),
  state_name: z.string().min(1),
  court_name: z.string().min(3),
  court_name_es: z.string().nullable().optional().transform(v => v ?? null),
  court_address: z.string().nullable().optional().transform(v => v ?? null),
  filing_procedure: z.string().nullable().optional().transform(v => v ?? null),
  filing_procedure_es: z.string().nullable().optional().transform(v => v ?? null),
  age_limit_sijs: z.coerce.number().int().nullable().optional().transform(v => {
    if (v === 18 || v === 21) return v as 18 | 21
    return null
  }),
  sources: z.array(z.string().min(1)).min(1, 'sources must include at least one URL'),
  confidence: z.enum(['high', 'medium', 'low']).catch('medium'),
  notes: z.string().nullable().optional().transform(v => v ?? null),
  filing_channel: z.string().nullable().optional().transform(v => {
    if (!v) return null
    const valid = ['in_person', 'email', 'portal', 'mail', 'hybrid']
    return valid.includes(v) ? (v as 'in_person' | 'email' | 'portal' | 'mail' | 'hybrid') : null
  }),
  required_forms: z.array(FormSchema).catch([]).default([]),
  filing_steps: z.array(StepSchema).catch([]).default([]),
  attachments_required: z.array(z.object({
    // Tolerante: Claude usa nombres libres tipo "affidavit", "police_report",
    // "identification". Mapea cualquier string al type 'other' si no encaja.
    type: z.string().transform(v => {
      const valid = ['birth_certificate', 'school_records', 'medical_records',
        'psych_evaluation', 'parental_consent', 'abandonment_proof', 'other']
      return valid.includes(v) ? (v as AttachmentType) : 'other' as AttachmentType
    }),
    description_es: z.string().min(1),
  })).catch([]).default([]),
  fees: z.object({
    amount_usd: z.coerce.number().nonnegative().catch(0),
    currency: z.string().transform(() => 'USD' as const),
    waivable: z.boolean().catch(false),
    waiver_form_name: z.string().nullable().optional().transform(v => v ?? null),
    waiver_form_url: z.string().nullable().optional().transform(v => v ?? null),
  }).nullable().optional().transform(v => v ?? null),
  intake_packet: z.object({
    required_forms: z.array(FormSchema).catch([]).default([]),
    filing_steps: z.array(StepSchema).catch([]).default([]),
    filing_channel: z.string().nullable().optional().transform(v => {
      if (!v) return null
      const valid = ['in_person', 'email', 'portal', 'mail', 'hybrid']
      return valid.includes(v) ? (v as 'in_person' | 'email' | 'portal' | 'mail' | 'hybrid') : null
    }),
    procedure_es: z.string().nullable().optional().transform(v => v ?? null),
    notes: z.string().nullable().optional().transform(v => v ?? null),
  }).default({
    required_forms: [],
    filing_steps: [],
    filing_channel: null,
    procedure_es: null,
    notes: null,
  }),
})

const RESEARCHER_SYSTEM = `Eres una investigadora legal senior especializada en derecho migratorio de EE.UU. y jurisdicción juvenil. Tu tarea es producir un dossier EXHAUSTIVO y verificado con fuentes oficiales (.gov/.us) sobre la corte competente y el procedimiento completo de radicación SIJS (Special Immigrant Juvenile Status) para un ZIP específico.

## CONTEXTO LEGAL (crítico — lo explica Henry, el CEO)

La ley SIJS de 1990 es federal y general para los 50 estados. CADA juzgado de distrito tiene autonomía administrativa para definir SU propio procedimiento de radicación local, sin violar la norma federal. Esto significa que el mismo estado puede tener 10–12 distritos judiciales con formularios DIFERENTES.

El proceso tiene DOS ETAPAS BIEN DIFERENCIADAS que debes investigar por separado:

### Etapa 1 — Radicación de la presentación (INTAKE)
Son los formularios administrativos que el clerk/secretario pide ANTES de asignar número de caso. Es el "trámite de apertura". Pueden ser:
- Family Court Coversheet / Civil Cover Sheet
- Confidential Information Form
- Letter of Intent to File / Petition Request letter
- Registration/Intake form específico del condado
- Cualquier hoja ("ficha de registro") que el juzgado pida llenar para abrir el expediente

Ejemplo real de Utah (experiencia del CEO): en Utah él lleva una sola hoja que dice "solicito, señor juez, mi petición, soy [nombre], mi menor hijo [nombre], quien solicita..." con esa hoja presenta en ventanilla, el clerk asigna número de caso, y RECIÉN entonces puede traer el expediente sustantivo para la audiencia.

### Etapa 2 — Radicación del procedimiento del caso (MERITS)
Son los documentos sustantivos del caso que el juez evalúa para decidir: Petition for Guardianship/Custody, declaraciones del tutor y testigos, evidencias de abandono, certificaciones, formularios SIJS (findings). Esto es lo que se presenta DESPUÉS de tener el número de caso.

Debes investigar y reportar LAS DOS ETAPAS por separado. El sistema las muestra como secciones distintas al admin.

## REGLAS

1. **Usa la herramienta \`web_search\` de forma agresiva** — tienes hasta 15 búsquedas. Consulta: sitio oficial del state judiciary, página específica del county/district court, reglas locales (local rules), clerk's office instructions, filing fee schedules, formularios descargables, plataforma de e-filing del estado (eFileTexas, NYSCEF, etc). Si la primera query no da resultado claro, itera con refinements.
2. **Dominios permitidos**: cita EXCLUSIVAMENTE URLs bajo .gov o .us. El validador del sistema rechaza respuestas sin al menos una source .gov/.us.
3. **Precisión sobre cobertura**: si no puedes identificar un dato con certeza, déjalo null o array vacío. NUNCA inventes nombres de formularios, URLs o procedimientos.
4. **Sources obligatorios**: cada dato factual debe estar respaldado por una URL oficial específica (no la homepage del judiciary).
5. **Output JSON estricto** (CRÍTICO): tu respuesta debe empezar EXACTAMENTE con \`{\` y terminar EXACTAMENTE con \`}\`. NO escribas "I'll research...", "Let me search...", "Good - I've confirmed...", ni ningún otro narrativo de tu proceso. Tampoco markdown ni \`\`\`json fences. Si necesitas razonar, hazlo internamente. El parser del sistema rechaza CUALQUIER carácter fuera del bloque JSON balanceado.

5.b **Comillas dentro de strings**: si necesitas citar texto en español o inglés DENTRO de un valor string del JSON, usa comillas SIMPLES o paréntesis, NUNCA dobles. Ejemplo correcto: \`"description_es": "Petición principal (Original Petition in SAPCR) según el Código de Familia de Texas."\` Ejemplo INCORRECTO: \`"description_es": "Petición principal "Original Petition in SAPCR" según el Código."\` — esto rompe el JSON.
6. **court_name en inglés formal** como aparece en encabezados oficiales. Ej: "Fourth District Juvenile Court, American Fork Location".
7. **court_name_es**: traducción formal al español jurídico.
8. **filing_procedure**: resumen en prosa (2–4 oraciones) combinando AMBAS etapas para legibilidad global. Queda como fallback.
9. **age_limit_sijs**: 18 o 21 según la normativa del estado. Verifica en fuente oficial.
10. **confidence**: high = corte + ambas etapas documentadas en fuentes oficiales. medium = corte identificada pero alguna etapa inferida. low = no pude confirmar sub-jurisdicción.
11. **EXHAUSTIVIDAD OBLIGATORIA**: el sistema sirve a una abogada que radica casos reales. Si OMITES un documento conocido, ella lo descubre en ventanilla y se cae el trámite. Por eso:
    - \`intake_packet.required_forms\` NUNCA puede estar vacío salvo que documentes en \`intake_packet.notes\` por qué este juzgado solo acepta carta libre o por qué la propia petición sustantiva funciona como commencement document (caso típico de NY Family Court). Todos los condados grandes (Harris TX, Kings NY, Cook IL, Maricopa AZ, Los Angeles CA, etc.) tienen Civil Case Information Sheet o Family Court Coversheet.
    - \`required_forms\` (Etapa 2) DEBE incluir TODOS los formularios sustantivos conocidos para SIJS estatal (petition for guardianship/SAPCR, motion for SIJ findings, affidavits del menor + del peticionario + de testigos, proposed order con findings, certificate of conference si aplica).
    - Si el estado no publica un template oficial para alguno, dilo en \`notes\` — no lo omitas.

12. **CHECKLIST INTERNA OBLIGATORIA — antes de cerrar el JSON, responde mentalmente las 5 preguntas**:
    ☐ ¿\`required_forms\` contiene una **Petition** (Guardianship/Custody/SAPCR/Appointment)? Si NO, busca otra vez con la query del estado (FM-SAPCR-100 en TX, Form 6-1 en NY, GC-210 en CA, Form 12.961 en FL).
    ☐ ¿\`required_forms\` contiene una **Motion for SIJ Findings** (o Notice of Motion for Special Findings)? Si NO, busca explícitamente con \`"motion for SIJ findings" site:.gov\` y la variante específica del estado.
    ☐ ¿\`required_forms\` contiene una **Affirmation/Affidavit en apoyo del Motion**? Si NO, busca \`"affirmation in support" SIJ findings site:.gov\`.
    ☐ ¿\`required_forms\` contiene un **Proposed Order con Special Findings** (en NY = GF-42; en TX = 2019_Order_SIJ_Findings; en otros = "Order Regarding SIJ Status")? Si NO, busca explícitamente. **Sin esta orden, USCIS rechaza el I-360 — es el documento más crítico de todo el paquete.**
    ☐ ¿\`intake_packet.required_forms\` contiene al menos un coversheet/intake form (o las notes documentan que el estado no exige coversheet separado)?

    Si fallaste alguno de los 5 checks, NO emitas el JSON aún — vuelve a buscar. Tienes presupuesto para hacerlo.

## BLOQUES ESTRUCTURADOS

### intake_packet (Etapa 1 — presentación administrativa)
- **required_forms**: formularios de intake específicos del juzgado (coversheets, cartas de registro, formularios de apertura). Cada entry con URL oficial. Array vacío si solo se presenta en persona con una carta libre.
- **filing_steps**: pasos ordenados para abrir el caso y obtener número de expediente. Típicamente: (1) preparar carta/coversheet, (2) presentar en ventanilla o portal, (3) pagar fee inicial si aplica, (4) recibir case number.
- **filing_channel**: in_person | email | portal | mail | hybrid. Para intake la mayoría es in_person, algunos estados avanzados tienen portal (eFiling inicial).
- **procedure_es**: resumen en prosa de la etapa 1, en español jurídico claro.
- **notes**: particularidades locales (ej. horario del clerk, requisitos de notarización previa, traducción certificada).

### required_forms / filing_steps / filing_channel / attachments_required / fees (Etapa 2 — procedimiento sustantivo)
Estos describen la radicación del expediente completo que el juez evalúa:
- **required_forms**: Petition for Guardianship, declaraciones juradas, SIJS findings forms, etc.
- **filing_steps**: pasos de radicación del expediente sustantivo (después de tener case number).
- **filing_channel**: canal para subir/entregar el expediente sustantivo.
- **attachments_required**: documentos del cliente (birth_certificate, school_records, etc).
- **fees**: arancel principal del caso + mecanismo de exención si aplica.

## CATÁLOGO MÍNIMO SIJS (úsalo como checklist mental)

### Etapa 1 — intake estatal (lo que el clerk pide para abrir caso)
Busca explícitamente:
- Civil Case Information Sheet (TX, FL, CO, etc) o Family Court Coversheet (NY, NJ, MA)
- Confidential Information Form / Confidential Cover Sheet (cuando hay menor involucrado)
- Letter of Intent to File / Petition Request Letter (cortes que aceptan petición libre)
- Local intake form del condado (Harris County, Kings County, Cook County, etc.)
- Si el estado tiene e-filing obligatorio (Texas eFileTexas, NY NYSCEF, IL eFileIL): cita el portal y el envelope/case-initiation form.

### Etapa 2 — merits estatal (lo que el juez evalúa)
Busca explícitamente:
- Petition for Appointment of Guardian (NY/CA/TX/FL) o Petition in SAPCR (Texas) o Petition for Custody (estados con custody-only).
- Motion for Findings Regarding SIJ Status (template DFPS en TX, template ILRC para otros estados).
- Affidavits: del menor, del peticionario, de testigos.
- Birth certificate certificada (suele requerir traducción certificada si es de otro idioma).
- Proposed Order con SIJS findings explícitos: (a) dependent on court / placed in custody, (b) reunification with one or both parents not viable due to abuse/neglect/abandonment, (c) not in best interest to return to country of nationality.
- Certificate of Conference si las local rules lo exigen (Harris TX lo pide).

### Bonus: aspectos federales (USCIS) — si encuentras data clara, agrégalos en \`notes\`
- I-360 + G-28 + copia certificada del predicate order + evidencia de "reasonable factual basis" se presentan en USCIS National Benefits Center (Overland Park, KS).
- Tarifa I-360 SIJS desde Julio 2025: $250 (OBBBA).

## REGLAS POR ESTADO — URLs canónicas conocidas (úsalas siempre)

{{STATE_SIJ_RULES}}


### Texas (TX) — TODOS los condados (Harris, Dallas, Bexar, Travis, Tarrant, El Paso, etc.)
- **NUNCA uses URLs de un solo condado** (ej: \`fortbendlibraries.gov\`, \`harriscounty.gov\`, \`dallascounty.org\`) para forms FM-SAPCR-*. Esos packets solo aplican a su condado.
- **SIEMPRE usa TexasLawHelp.org como source de los forms FM-SAPCR-*** — son promulgados por el Texas Access to Justice Commission y válidos en los 254 condados:
  - Civil Case Information Sheet: \`https://texaslawhelp.org/sites/default/files/pr-gen-116_civil_case_information_sheet.pdf\` (PR-GEN-116)
  - Original Petition in SAPCR (Rev. 09-2025): \`https://texaslawhelp.org/sites/default/files/2025-09/fm-sapcr-100_sapcr_petition_2025_legis_update.pdf\` (FM-SAPCR-100)
  - **Affidavit for Standing of Nonparent (Rev. 09-2025)**: \`https://texaslawhelp.org/sites/default/files/2025-09/fm-sapcr-aff-100_affidavit_for_standing_of_nonparent_2025.pdf\` (FM-SAPCR-AFF-100) — **OBLIGATORIO desde 09-01-2025 bajo TFC § 102.0031** para TODA petición de no-padre. NUNCA omitir si el peticionario no es el padre biológico.
  - Order in SAPCR Nonparent Custody (Rev. 05-2024): \`https://texaslawhelp.org/sites/default/files/2024-03/fm-sapcr-205_sapcr_nonparent_order_english_2024.pdf\` (FM-SAPCR-205)
  - Statement of Inability (Fee Waiver, bilingüe): \`https://texaslawhelp.org/sites/default/files/2023-02/tlsc_fee_waiver_02_2023.pdf\` (CB-CFFW-100)
- **DFPS Section 13 Tools** — usa SOLO URLs DIRECTAS al .docx, NUNCA la página índice \`Section-13.asp\`:
  - Motion for Findings: \`https://www.dfps.texas.gov/Child_Protection/Attorneys_Guide/documents/Section_13_Tools/Citizenship_and_Immigration/Motion_for_Findings_Regarding_SIJ_Status.docx\`
  - Order Regarding SIJS Findings: \`https://www.dfps.texas.gov/Child_Protection/Attorneys_Guide/documents/Section_13_Tools/Citizenship_and_Immigration/2019_Order_SIJ_Findings.docx\`
  - Affidavit to Support SIJ Motion: \`https://www.dfps.texas.gov/Child_Protection/Attorneys_Guide/documents/Section_13_Tools/Citizenship_and_Immigration/2019_Affidavit_to_Support_SIJ_Motion.doc\`
- **txcourts.gov**: tiene Cloudflare WAF que devuelve 403 a bots. PREFIERE el mirror de TexasLawHelp.org cuando exista. Si solo está en txcourts.gov (ej: instructions PDF) úsalo apuntando al PDF directo, no a \`/rules-forms/forms/\` (página índice).
- e-filing obligatorio para abogados en TX: eFileTexas.gov.

## REGLAS GENERALES SOBRE URLs (todos los estados)

- **NO uses páginas índice** del judiciary o de DFPS. Si la URL termina en \`.asp\`, \`.html\`, \`.aspx\` y NO en un PDF/DOCX/DOC, es página índice — busca el link directo al documento.
- **NO uses URLs con \`/rules-forms/forms/\`**, \`/forms/all-forms\`, \`/library/forms\` cuando son índices. Encuentra el documento específico.
- **Verifica el dominio**: si te ofrecen un PDF en \`fortbendlibraries.gov\`, \`harriscountylawlibrary.org/library/file/X\`, etc., revisa si es el form oficial estatal o un packet local. Si es packet local, busca el form individual en la source estatal.
- **Para forms con número estable** (FM-SAPCR-*, PR-GEN-*, JD-FM-* en CT, UJ-* en NY, GC-* en CA), el número del form es la verdad — encuentra la versión más reciente en el repositorio estatal autoritativo.

## REGLAS DE LIMPIEZA
- required_forms / intake_packet.required_forms: SOLO entries cuya url_official esté en .gov/.us. NUNCA inventes.
- filing_steps / intake_packet.filing_steps: pasos accionables; title_es <8 palabras; requires_client_action correctamente marcado.

## SLUGS DE FORMULARIOS AUTOMATIZADOS — REGLA OBLIGATORIA

El sistema mantiene un registry de formularios oficiales que ya tienen formulario interactivo + generación local de PDF rellenado. Cuando reconozcas uno de los formularios listados abajo (por su número/nombre/tema), DEBES incluir el campo \`slug\` con el valor exacto en la entry de \`required_forms\` o \`intake_packet.required_forms\`. Sin el slug, el cliente pierde acceso al formulario interactivo y al PDF prellenado, y tiene que llenar el oficial a mano.

Reglas:
- Si el form en cuestión está en la tabla, AGREGA el slug. No es opcional.
- Si NO está en la tabla, omite el campo o pasa \`null\`.
- El emparejamiento se hace por nombre/número del form (no por descripción). Sé generoso: si el nombre del form que encontraste en la fuente oficial contiene el código del slug (ej. "FM-SAPCR-AFF-100" → \`tx-fm-sapcr-aff-100\`), úsalo.
- La tabla se genera automáticamente desde el registry del código — siempre refleja la versión actual.

{{SLUG_CATALOG}}

- attachments_required: usa solo los types del enum.
- fees: null si no hay dato oficial del monto.

## FORMATO DE SALIDA (JSON estricto)

{
  "state_code": "UT",
  "state_name": "Utah",
  "court_name": "Fourth District Juvenile Court, American Fork Location",
  "court_name_es": "Cuarto Juzgado de Distrito de Familia de Utah, Sede American Fork",
  "court_address": "75 E 80 N, American Fork, UT 84003",
  "filing_procedure": "Petitions for guardianship/custody are filed in person at the juvenile court clerk's office. The clerk scans the petition, assigns a case number the same day, and collects the filing fee (approx. $40, waivable with Form 982). Judge reviews within 30-45 days and sets a hearing.",
  "filing_procedure_es": "Las peticiones de tutela/custodia se presentan en persona en la ventanilla del secretario de la corte juvenil...",
  "age_limit_sijs": 21,
  "sources": [
    "https://www.utcourts.gov/courts/juvenile/fourth-district/",
    "https://www.utcourts.gov/howto/filing/juvenile/"
  ],
  "confidence": "high",
  "notes": "Utah divides juvenile cases into 8 judicial districts; ZIP 84003 (American Fork) falls within the Fourth District.",
  "filing_channel": "in_person",
  "required_forms": [
    {
      "name": "Petition for Appointment of Guardian of a Minor (Form 1374GE)",
      "url_official": "https://www.utcourts.gov/resources/forms/guardianship/1374GE.pdf",
      "description_es": "Petición principal para nombrar tutor del menor. La firma el tutor propuesto ante notario.",
      "is_mandatory": true
    },
    {
      "name": "Motion to Waive Fees (Form 982GE)",
      "url_official": "https://www.utcourts.gov/resources/forms/fees/982GE.pdf",
      "description_es": "Solicitud de exención de arancel por indigencia. Opcional, solo si no puede pagar los $40.",
      "is_mandatory": false
    }
  ],
  "filing_steps": [
    {
      "step_number": 1,
      "title_es": "Completar formularios",
      "detail_es": "Llenar la Petition for Guardianship y (si aplica) el Motion to Waive Fees. Firmar ante notario.",
      "estimated_time": "1-2 días",
      "requires_client_action": true
    },
    {
      "step_number": 2,
      "title_es": "Radicar en la corte",
      "detail_es": "Presentar los formularios en persona en la ventanilla del juvenile court clerk en American Fork. Pagar $40 o entregar la exención.",
      "estimated_time": "30 min presencial",
      "requires_client_action": true
    },
    {
      "step_number": 3,
      "title_es": "Asignación de caso",
      "detail_es": "El clerk asigna número de caso el mismo día y entrega copia sellada.",
      "estimated_time": "mismo día",
      "requires_client_action": false
    },
    {
      "step_number": 4,
      "title_es": "Audiencia con el juez",
      "detail_es": "El juez revisa la petición y fija fecha de audiencia. El tutor propuesto debe comparecer.",
      "estimated_time": "30-45 días",
      "requires_client_action": true
    }
  ],
  "attachments_required": [
    {
      "type": "birth_certificate",
      "description_es": "Partida de nacimiento original del menor (con traducción certificada si está en otro idioma)."
    },
    {
      "type": "abandonment_proof",
      "description_es": "Evidencia del abandono o ausencia del padre/madre (carta, declaración jurada, testigos)."
    }
  ],
  "fees": {
    "amount_usd": 40,
    "currency": "USD",
    "waivable": true,
    "waiver_form_name": "Motion to Waive Fees (Form 982GE)",
    "waiver_form_url": "https://www.utcourts.gov/resources/forms/fees/982GE.pdf"
  },
  "intake_packet": {
    "required_forms": [
      {
        "name": "Juvenile Court Cover Sheet",
        "url_official": "https://www.utcourts.gov/resources/forms/juvenile/coversheet.pdf",
        "description_es": "Hoja de carátula que la ventanilla requiere para abrir expediente juvenil. Incluye identificación del tutor, menor y tipo de petición.",
        "is_mandatory": true
      }
    ],
    "filing_steps": [
      {
        "step_number": 1,
        "title_es": "Preparar carta y coversheet",
        "detail_es": "Redactar carta breve de solicitud ('solicito, señor juez, mi petición, soy [nombre], mi menor hijo [nombre]...') y llenar el Juvenile Court Cover Sheet.",
        "estimated_time": "30 min",
        "requires_client_action": true
      },
      {
        "step_number": 2,
        "title_es": "Presentar en ventanilla",
        "detail_es": "Acudir a la ventanilla del juvenile court en American Fork con la carta y el coversheet. El clerk verifica identidad y documentos preliminares.",
        "estimated_time": "20 min presencial",
        "requires_client_action": true
      },
      {
        "step_number": 3,
        "title_es": "Recibir número de caso",
        "detail_es": "El clerk asigna número de caso el mismo día y entrega una constancia. Con ese número ya se puede traer el expediente sustantivo completo.",
        "estimated_time": "mismo día",
        "requires_client_action": false
      }
    ],
    "filing_channel": "in_person",
    "procedure_es": "La radicación de la presentación (etapa 1) en Utah requiere acudir en persona a la ventanilla del juvenile court con una carta breve de solicitud y el coversheet. El clerk asigna número de caso inmediatamente. Solo después de obtener ese número se entrega el expediente sustantivo para la audiencia.",
    "notes": "El clerk de American Fork atiende de 8am a 5pm MT. No requiere cita previa. Si se acude sin el coversheet, lo entregan impreso en ventanilla."
  }
}
`

/**
 * Encuentra el primer bloque {...} balanceado en el texto. Maneja strings
 * con llaves dentro (ignora `{` y `}` dentro de strings JSON). Devuelve
 * null si no encuentra un objeto bien formado.
 */
function extractBalancedJson(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null // no balanceado
}

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')
  _client = new Anthropic({ apiKey })
  return _client
}

/**
 * Dado un `ClientLocation`, llama a Claude Opus 4.7 con `web_search` habilitado
 * y devuelve la jurisdicción estructurada. Lanza si no se pudo parsear JSON o
 * si Claude no devolvió sources oficiales.
 *
 * Estrategia de dos pasadas:
 *   1. Primera llamada con prompt principal + max_uses=10.
 *   2. Si validateSIJCorePackage detecta familias faltantes (ej. GF-42 en NY,
 *      DFPS Order en TX), corre una segunda llamada DIRIGIDA con queries
 *      explícitas para los gaps detectados (max_uses=5).
 *   3. Hace merge único por nombre, re-valida, y devuelve. Si tras retry
 *      siguen faltando familias, marca `_missing_families` para que el
 *      caller persista research_status='incomplete'.
 *
 * Costo típico: ~7-10 web_search_requests + ~15k tokens input + ~2k tokens output
 * ≈ $0.35-0.55 USD por invocación. Se cachea por caseId en
 * `case_jurisdictions` por 30 días. Si se dispara retry: +$0.20 ≈ $0.75 total.
 */
export async function researchJurisdiction(
  location: ClientLocation,
  signal?: AbortSignal,
): Promise<JurisdictionResearchResult> {
  const stateCode = location.stateCode as UsStateCode

  // Pasada 1: prompt principal con max_uses=10 (subido desde 7 — el budget
  // anterior se quedaba corto cuando el catálogo SIJS exigía buscar
  // explícitamente petition + motion + affidavit + order + coversheet por
  // estado/condado).
  const firstAttempt = await callClaudeForResearch(location, {
    signal,
    maxUses: 10,
    retryContext: null,
  })

  const validation = validateSIJCorePackage(firstAttempt, stateCode)
  if (validation.ok) {
    log.info('research first-attempt passed validator', {
      stateCode,
      meritsForms: firstAttempt.required_forms.length,
      intakeForms: firstAttempt.intake_packet.required_forms.length,
    })
    return firstAttempt
  }

  log.warn('research first-attempt missing core families — running targeted retry', {
    stateCode,
    missing: validation.missing,
    warnings: validation.warnings,
  })

  // Pasada 2: retry dirigido con queries específicas para los gaps.
  const targetedQueries = buildTargetedQueries(stateCode, validation.missing)
  const missingDescriptions = describeMissingFamilies(validation.missing)

  let secondAttempt: JurisdictionResearchResult | null = null
  try {
    secondAttempt = await callClaudeForResearch(location, {
      signal,
      maxUses: 5,
      retryContext: {
        previousResult: firstAttempt,
        missingFamilies: missingDescriptions,
        suggestedQueries: targetedQueries,
      },
    })
  } catch (err) {
    log.error('targeted retry failed — keeping first attempt with warnings', {
      stateCode,
      err: err instanceof Error ? err.message : err,
    })
  }

  // Merge: priorizar entries de la primera pasada (ya tienen el contexto general),
  // agregar entries nuevas del retry que no estuvieran ya por nombre.
  const merged: JurisdictionResearchResult = secondAttempt
    ? mergeResearchResults(firstAttempt, secondAttempt)
    : firstAttempt

  const finalValidation = validateSIJCorePackage(merged, stateCode)
  if (finalValidation.ok) {
    log.info('research passed validator after retry', {
      stateCode,
      meritsForms: merged.required_forms.length,
      intakeForms: merged.intake_packet.required_forms.length,
      retryAdded: secondAttempt
        ? merged.required_forms.length - firstAttempt.required_forms.length
        : 0,
    })
    return merged
  }

  log.warn('research still incomplete after retry — marking warnings', {
    stateCode,
    stillMissing: finalValidation.missing,
  })

  return { ...merged, _missing_families: finalValidation.missing }
}

/**
 * Combina dos resultados de research. Mantiene los datos generales (court_name,
 * filing_procedure, etc.) del PRIMARIO, y solo agrega entries de required_forms
 * / intake_packet.required_forms / sources del SECUNDARIO que no existan ya
 * (matching por nombre normalizado, case-insensitive).
 */
function mergeResearchResults(
  primary: JurisdictionResearchResult,
  secondary: JurisdictionResearchResult,
): JurisdictionResearchResult {
  const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

  const mergeForms = (a: RequiredForm[], b: RequiredForm[]): RequiredForm[] => {
    const seen = new Set(a.map(f => normalizeName(f.name)))
    const additions = b.filter(f => !seen.has(normalizeName(f.name)))
    return [...a, ...additions]
  }

  const mergedSources = Array.from(new Set([...primary.sources, ...secondary.sources]))

  return {
    ...primary,
    sources: mergedSources,
    required_forms: mergeForms(primary.required_forms, secondary.required_forms),
    intake_packet: {
      ...primary.intake_packet,
      required_forms: mergeForms(
        primary.intake_packet.required_forms,
        secondary.intake_packet.required_forms,
      ),
    },
  }
}

interface CallOptions {
  signal?: AbortSignal
  maxUses: number
  /** Si está presente, esta llamada es un retry dirigido. */
  retryContext: {
    previousResult: JurisdictionResearchResult
    missingFamilies: string[]
    suggestedQueries: string[]
  } | null
}

/**
 * Helper interno: arma el system + user prompt e invoca Claude. Reutilizado
 * para la pasada principal y para los retries dirigidos. Retorna el JSON
 * parseado y validado (Zod), pero NO ejecuta validación SIJS — eso lo hace
 * el caller.
 */
async function callClaudeForResearch(
  location: ClientLocation,
  opts: CallOptions,
): Promise<JurisdictionResearchResult> {
  const client = getClient()
  const hint = getStateCourtHint(location.stateCode)
  const isRetry = Boolean(opts.retryContext)

  // System prompt: inyectamos catálogo de slugs + reglas SIJS específicas del estado.
  const stateSijRules = hint.sijRules ?? ''
  const systemPrompt = RESEARCHER_SYSTEM
    .replace('{{SLUG_CATALOG}}', getRegisteredSlugCatalogMarkdown())
    .replace('{{STATE_SIJ_RULES}}', stateSijRules)

  const userPrompt = isRetry
    ? buildRetryUserPrompt(location, hint, opts.retryContext!)
    : buildPrimaryUserPrompt(location, hint, opts.maxUses)

  log.debug('callClaudeForResearch', {
    stateCode: location.stateCode,
    zip: location.zip,
    source: location.source,
    isRetry,
    maxUses: opts.maxUses,
  })

  const message = await client.messages.create(
    {
      model: RESEARCH_MODEL,
      max_tokens: 12000,
      system: systemPrompt,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: opts.maxUses,
        },
      ] as unknown as Anthropic.Messages.Tool[],
      messages: [{ role: 'user', content: userPrompt }],
    },
    { signal: opts.signal, timeout: 120_000 },
  )

  const rawText = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  if (!rawText) {
    throw new Error('Claude devolvió respuesta sin texto (solo tool_use blocks)')
  }

  let jsonText = extractBalancedJson(rawText)
  if (!jsonText) {
    let stripped = rawText
    if (stripped.startsWith('```')) {
      stripped = stripped.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
    }
    const firstBrace = stripped.indexOf('{')
    const lastBrace = stripped.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonText = stripped.slice(firstBrace, lastBrace + 1)
    } else {
      jsonText = stripped
    }
  }

  let parsed: JurisdictionResearchResult
  try {
    let rawParsed: unknown
    try {
      rawParsed = JSON.parse(jsonText) as unknown
    } catch (parseErr) {
      log.warn('JSON.parse falló — aplicando jsonrepair', {
        err: parseErr instanceof Error ? parseErr.message : String(parseErr),
      })
      const repaired = jsonrepair(jsonText)
      rawParsed = JSON.parse(repaired) as unknown
    }
    parsed = ResearchSchema.parse(rawParsed) as JurisdictionResearchResult
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const isZodError = errMsg.includes('ZodError') || errMsg.startsWith('[')
    const errorType = isZodError ? 'Validación Zod' : 'JSON.parse'
    const tail = jsonText.slice(-200).replace(/\s+/g, ' ')
    const head = jsonText.slice(0, 200).replace(/\s+/g, ' ')
    log.error('research JSON parse/validation failed', {
      errorType,
      isRetry,
      jsonTextLength: jsonText.length,
      rawTextLength: rawText.length,
      rawPreview: rawText.slice(0, 1200),
      extractedPreview: jsonText.slice(0, 800),
      extractedTail: jsonText.slice(-300),
      err: errMsg,
    })
    throw new Error(
      `Claude JSON inválido (${errorType}). ` +
      `jsonText[${jsonText.length}c] head="${head}" tail="${tail}" — error: ${errMsg.slice(0, 200)}`
    )
  }

  // Verificación post-hoc: al menos una source debe venir de un dominio oficial.
  const SOURCE_OFFICIAL_REGEX = /\.(gov|us)(\/|$|\?|#)|uscourts\.gov|courts\.state\./i
  const officialSources = parsed.sources.filter(u => SOURCE_OFFICIAL_REGEX.test(u))
  if (officialSources.length === 0) {
    log.warn('research returned no official .gov/.us sources', {
      stateCode: parsed.state_code,
      sources: parsed.sources,
      isRetry,
    })
    throw new Error('Claude no citó ninguna fuente oficial (.gov/.us). Rehaga la investigación.')
  }

  // Limpieza de URLs no oficiales en required_forms / waiver_form_url / intake.
  const isOfficial = (u: string | null | undefined) => !!u && SOURCE_OFFICIAL_REGEX.test(u)
  parsed.required_forms = parsed.required_forms.filter(f => {
    const ok = isOfficial(f.url_official)
    if (!ok) log.warn('required_form dropped — URL no oficial', { name: f.name, url: f.url_official })
    return ok
  })

  if (parsed.fees?.waiver_form_url && !isOfficial(parsed.fees.waiver_form_url)) {
    log.warn('fees.waiver_form_url dropped — URL no oficial', { url: parsed.fees.waiver_form_url })
    parsed.fees = { ...parsed.fees, waiver_form_url: null, waiver_form_name: parsed.fees.waiver_form_name ?? null }
  }

  if (parsed.intake_packet?.required_forms?.length) {
    parsed.intake_packet = {
      ...parsed.intake_packet,
      required_forms: parsed.intake_packet.required_forms.filter(f => {
        const ok = isOfficial(f.url_official)
        if (!ok) log.warn('intake_form dropped — URL no oficial', { name: f.name, url: f.url_official })
        return ok
      }),
    }
  }

  const usage = message.usage as Anthropic.Usage & {
    server_tool_use?: { web_search_requests?: number }
  }
  log.info(isRetry ? 'research retry complete' : 'research primary call complete', {
    stateCode: parsed.state_code,
    court: parsed.court_name,
    confidence: parsed.confidence,
    sources: parsed.sources.length,
    meritsForms: parsed.required_forms.length,
    intakeForms: parsed.intake_packet?.required_forms?.length ?? 0,
    webSearchRequests: usage.server_tool_use?.web_search_requests,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  })

  return parsed
}

function buildPrimaryUserPrompt(
  location: ClientLocation,
  hint: ReturnType<typeof getStateCourtHint>,
  maxUses: number,
): string {
  return `Investiga las DOS etapas de radicación SIJS para este cliente. Tienes hasta ${maxUses} web_searches — sé eficiente: una para confirmar la corte/condado, dos para intake (coversheet/CCIS), tres-cuatro para merits (petition + motion findings + affidavit + proposed order), las restantes de holgura para verificar cualquier familia que no encuentres a la primera.

- Estado: ${location.stateName} (${location.stateCode})
- ZIP: ${location.zip ?? '(desconocido — usa la corte estatal genérica)'}
- Ciudad: ${location.city ?? '(desconocida)'}
- Dirección: ${location.street ?? '(no disponible)'}

## Pistas para tu research

- Sitio oficial del state judiciary a consultar primero: ${hint.officialJudiciaryUrl}
- Nivel típico de corte esperado en este estado: ${hint.likelyCourtLevel}
- Edad máxima SIJS conocida en este estado (verifica en fuente oficial): ${hint.sijsAgeCeiling}

## Lo que necesito — AMBAS ETAPAS (sin omisiones)

### ETAPA 1: Radicación de la presentación (intake_packet)
Los formularios administrativos que el clerk pide ANTES de asignar número de caso. Queries específicos a probar:
- \`"[county] courts coversheet" OR "civil case information sheet" site:.gov\`
- \`"[county] family court intake form" guardianship site:.gov\`
- \`"[state] eFiling case initiation" minor guardianship site:.gov\`
- \`"[county] district clerk family intake" site:.gov\`
- \`"[state] confidential information form" family court site:.gov\`

Reporta qué formularios/cartas se presentan, dónde (ventanilla, portal, email), qué tarda, qué fee de apertura (si hay). Si el portal de e-filing es obligatorio para abogados (eFileTexas, NYSCEF, IL eFile), indícalo.

### ETAPA 2: Radicación del procedimiento del caso (merits)
Los documentos sustantivos que el juez evalúa. Queries específicos:
- \`"[state] petition for appointment of guardian" minor form site:.gov\`
- \`"[state] motion findings SIJ status" template site:.gov\`
- \`"[state] SAPCR petition form" site:.gov\` (solo Texas)
- \`"[state] proposed order SIJS findings" site:.gov\`
- \`"[state] DFPS SIJS attorneys guide" template site:.gov\` (Texas)
- \`"[state] affidavit minor guardianship" form site:.gov\`
- \`"[state] certificate of conference" family local rules site:.gov\` (cuando aplique)

Cuando un estado tiene template oficial publicado (ej. Texas DFPS Section 13 Tools), incluye la URL exacta del .docx/.pdf, no la página índice.

### Datos generales
1. Nombre oficial EXACTO de la corte competente (como aparece en encabezados oficiales).
2. Dirección física documentada.
3. Edad máxima SIJS en el estado (18 o 21).
4. URLs oficiales (.gov/.us) que respaldan cada dato.

## Método
- Empieza por el judiciary estatal oficial (${hint.officialJudiciaryUrl}).
- Si el ZIP identifica condado/distrito específico, busca la corte exacta de ese condado.
- Para intake, investiga "clerk's office" / "local rules" / "filing instructions" / e-filing portal.
- Para merits, investiga los formularios sustantivos descargables (PDFs/DOCX).
- Si una búsqueda no da resultado, reformula con sinónimos. No te rindas con 2-3 intentos.
- Antes de cerrar el JSON, RE-CHEQUEA tu propia respuesta: ¿incluiste al menos un coversheet en intake? ¿al menos petition + motion findings en merits? Si no, busca de nuevo.

## FORMATO DE RESPUESTA — LEE OTRA VEZ ANTES DE EMITIR

Tu respuesta debe ser SOLO el JSON. Nada más. El primer carácter de tu output tiene que ser \`{\`. Si añades cualquier texto ("I'll research...", "Good - I've confirmed...", "Let me get specific details..."), el parser falla y el admin ve "JSON inválido".

Razonamiento interno OK. Texto en la respuesta NO.

Empieza tu respuesta con \`{\` ahora.`
}

function buildRetryUserPrompt(
  location: ClientLocation,
  hint: ReturnType<typeof getStateCourtHint>,
  ctx: NonNullable<CallOptions['retryContext']>,
): string {
  const previousFormsList = ctx.previousResult.required_forms
    .map(f => `  - ${f.name}`)
    .join('\n') || '  (ninguno encontrado)'
  const previousIntakeList = ctx.previousResult.intake_packet.required_forms
    .map(f => `  - ${f.name}`)
    .join('\n') || '  (ninguno encontrado)'

  return `RETRY DIRIGIDO — tu primera investigación pasó la mayoría del trabajo pero OMITIÓ formularios SIJS legalmente requeridos. Ahora SOLO tienes que llenar los gaps.

## Contexto del caso (no cambió)
- Estado: ${location.stateName} (${location.stateCode})
- ZIP: ${location.zip ?? '(desconocido)'}
- Ciudad: ${location.city ?? '(desconocida)'}
- Sitio judiciary: ${hint.officialJudiciaryUrl}

## Lo que YA encontraste (no busques esto otra vez)
**Merits forms ya identificados**:
${previousFormsList}

**Intake forms ya identificados**:
${previousIntakeList}

## Lo que FALTA (busca explícitamente esto, en este orden)

${ctx.missingFamilies.map((m, i) => `${i + 1}. **${m}**`).join('\n')}

## Queries específicas a probar (úsalas literal o con pequeñas variaciones)

${ctx.suggestedQueries.map(q => `- \`${q}\``).join('\n')}

## Reglas del retry

1. **Tienes 5 web_searches**. Úsalos enfocadamente en las queries de arriba.
2. **NO repitas búsquedas** que ya diste en la primera pasada — eso lo cubre el listado de "ya encontraste".
3. **Devuelve un JSON COMPLETO** con la jurisdicción ENTERA: misma corte, mismos datos generales, pero con \`required_forms\` y \`intake_packet.required_forms\` AMPLIADOS para incluir lo que faltaba. Sí — repite los forms que ya encontraste; el sistema deduplica por nombre.
4. **Si encuentras el form**: lista la URL oficial (.gov/.us) y descripción en español.
5. **Si NO encuentras URL oficial pero el form claramente aplica al estado**: documéntalo en \`notes\` con un párrafo explicando que el form es obligatorio pero no hay template publicado, y NO lo agregues a \`required_forms\` (porque romperá el filtro de URL oficial).
6. **Reglas estrictas por estado siguen activas** (NY exige GF-42, TX exige los 3 DFPS Section 13 Tools, CA exige Findings and Order Regarding SIJ Status).
7. **Output**: JSON puro. Empieza con \`{\` y termina con \`}\`. Sin prosa.

Empieza tu respuesta con \`{\` ahora.`
}

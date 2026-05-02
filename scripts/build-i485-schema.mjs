// Genera src/lib/legal/i485-form-schema.ts a partir de scripts/i485-raw-fields.json.
//
// Por qué auto-generado: el USCIS I-485 tiene ~760 fields en 14 partes — escribirlo
// a mano como SAPCR-100 sería ~3000 líneas inmanejables. En su lugar, este script
// aplica reglas heurísticas + overrides explícitos para producir el TS.
//
// Re-correr cada vez que se actualice scripts/i485-raw-fields.json o cuando se
// quiera ajustar las heurísticas. Editable a mano después de generar; sólo
// sobreescribir si se quiere regenerar from-scratch.
//
// Uso: node scripts/build-i485-schema.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const RAW_PATH = path.join(__dirname, 'i485-raw-fields.json')
const OUT_PATH = path.join(repoRoot, 'src', 'lib', 'legal', 'i485-form-schema.ts')

const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'))
const SHA = raw.sha256

// ──────────────────────────────────────────────────────────────────────
// 1) Helpers de parseo de pdfFieldName
// ──────────────────────────────────────────────────────────────────────

function shortName(fullName) {
  // form1[0].#subform[X].Pt1Line1_FamilyName[0] → Pt1Line1_FamilyName
  // form1[0].#subform[X].P4Line7_City[0]        → P4Line7_City
  // form1[0].#subform[X].Part1_Item18_InCareOfName[0] → Part1_Item18_InCareOfName
  const m = fullName.match(/\.([^.\[]+)\[(\d+)\]$/)
  if (!m) return fullName
  const base = m[1]
  const idx = m[2] === '0' ? '' : `_${m[2]}`
  return `${base}${idx}`
}

function detectPart(fullName) {
  // Devuelve número de Part 1-14 o null
  const norm = fullName.toLowerCase()
  // Buscar Pt# o Part# o P#
  let m = norm.match(/\.pt(\d+)/i)
  if (m) return parseInt(m[1], 10)
  m = norm.match(/\.part(\d+)/i)
  if (m) return parseInt(m[1], 10)
  // P1, P3, P4, P6, P12, P13 — usados también en algunos campos
  m = norm.match(/\.p(\d+)(?:_|line)/i)
  if (m) return parseInt(m[1], 10)
  // Casos especiales: AlienNumber, USCIS, Volag suelen ser headers de cada página
  if (/aliennumber|usciso|volagnumber|attorneystatebar|checkbox1/i.test(norm)) return 0 // header / cover
  return null
}

function semanticKeyOf(fullName) {
  // Construir un semanticKey reproducible y único.
  // form1[0].#subform[8].P4Line7_StreetName[0] → p4line7_streetname
  // form1[0].#subform[8].P4Line7_StreetName[1] → p4line7_streetname_1
  // form1[0].#subform[8].P4Line7_Unit[0] → p4line7_unit_apt (basado en checkboxOnValue)
  const short = shortName(fullName).toLowerCase()
  return short
}

// ──────────────────────────────────────────────────────────────────────
// 2) Mapeo de sufijos de field name → tipo y label heurístico
// ──────────────────────────────────────────────────────────────────────

const SUFFIX_LABELS = {
  '_familyname': { es: 'Apellido' },
  '_givenname': { es: 'Primer nombre' },
  '_middlename': { es: 'Segundo nombre' },
  '_cb_sex': { es: 'Sexo' },
  '_sex': { es: 'Sexo' },
  '_dob': { es: 'Fecha de nacimiento', help: 'MM/DD/YYYY' },
  '_otherdob': { es: 'Otra fecha de nacimiento', help: 'Si has usado otra fecha en algún documento.' },
  '_dateofbirth': { es: 'Fecha de nacimiento', help: 'MM/DD/YYYY' },
  '_aliennumber': { es: 'Número A (si lo tienes)', help: '9 dígitos que empiezan con A. Está en tu I-797 o tarjeta USCIS. Si no tienes, déjalo vacío.' },
  '_usciso': { es: 'Número de cuenta USCIS Online', help: 'Si abriste cuenta en my.uscis.gov. Si no, déjalo vacío.' },
  '_streetname': { es: 'Calle (Street)', help: 'Número y nombre de la calle.' },
  '_unit': { es: 'Tipo de unidad' },
  '_number': { es: 'Número de unidad' },
  '_city': { es: 'Ciudad' },
  '_state': { es: 'Estado' },
  '_zipcode': { es: 'Código postal (ZIP)' },
  '_postalcode': { es: 'Código postal (extranjero)' },
  '_province': { es: 'Provincia (extranjero)' },
  '_country': { es: 'País' },
  '_email': { es: 'Email' },
  '_daytimephonenumber': { es: 'Teléfono diurno' },
  '_daytimephonenumber1': { es: 'Teléfono diurno' },
  '_mobilenumber': { es: 'Celular' },
  '_mobiletelephonenumber': { es: 'Celular' },
  '_dayphone': { es: 'Teléfono diurno' },
  '_phonenumber': { es: 'Teléfono' },
  '_yesno': { es: '¿Sí o No?' },
  '_yn': { es: '¿Sí o No?' },
  '_cb': { es: 'Selecciona' },
  '_datefrom': { es: 'Desde (fecha)', help: 'MM/DD/YYYY' },
  '_dateto': { es: 'Hasta (fecha)', help: 'MM/DD/YYYY' },
  '_date': { es: 'Fecha' },
  '_citytownofbirth': { es: 'Ciudad/pueblo de nacimiento' },
  '_citytown': { es: 'Ciudad/pueblo' },
  '_countryofbirth': { es: 'País de nacimiento' },
  '_countryofcitizenship': { es: 'País de ciudadanía' },
  '_signature': { es: 'Firma' },
  '_signatureapplicant': { es: 'Firma del solicitante' },
  '_signaturepreparer': { es: 'Firma del preparador' },
  '_dateofsignature': { es: 'Fecha de firma' },
  '_organization': { es: 'Organización' },
  '_organization1': { es: 'Organización' },
  '_orgname': { es: 'Nombre de la organización' },
  '_businessname': { es: 'Nombre del negocio/firma' },
  '_explanation': { es: 'Explicación', help: 'Detalla brevemente.' },
  '_additionalinfo': { es: 'Información adicional' },
  '_incareofname': { es: 'A nombre de (In Care Of)' },
  '_inCareofname': { es: 'A nombre de (In Care Of)' },
  '_volagnumber': { es: 'Número Volag', help: 'Solo si una agencia voluntaria asistió. Lo deja Diana.' },
  '_attorneystatebarnumber': { es: 'State Bar # del abogado', help: 'Diana lo completa.' },
  '_receipt': { es: 'Receipt #' },
  '_pages': { es: 'Páginas' },
  '_corrections1': { es: 'Correcciones 1' },
  '_corrections2': { es: 'Correcciones 2' },
  '_uscissignature': { es: 'Firma del oficial USCIS' },
  '_uscisofficer': { es: 'Oficial USCIS' },
  '_applicantsignature': { es: 'Firma del solicitante' },
  '_nameoflanguage': { es: 'Idioma del intérprete' },
  '_involvement': { es: 'Tipo de participación' },
  '_maritalstatus': { es: 'Estado civil' },
  '_timesmarried': { es: 'Veces que has estado casado/a' },
  '_i94': { es: 'Número I-94' },
}

const PART_TITLES = {
  0: { titleEs: '0. Cabecera (números legales)', descEs: 'Datos de identificación que aparecen en cada página. Diana suele completarlos.' },
  1: { titleEs: '1. Información sobre ti', descEs: 'Tu nombre, A-Number, USCIS Online, fecha y lugar de nacimiento, dirección, contacto, datos personales.' },
  2: { titleEs: '2. Tipo de aplicación / categoría de elegibilidad', descEs: 'Para casos SIJS está pre-marcado "Special Immigrant Juvenile". Datos de la I-360 aprobada.' },
  3: { titleEs: '3. Datos adicionales sobre ti', descEs: 'Información extra que USCIS necesita.' },
  4: { titleEs: '4. Historia de admisión y estatus migratorio', descEs: 'Tu última entrada a EE.UU., I-94, sello CBP, parole, ORR.' },
  5: { titleEs: '5. Historia de direcciones (últimos 5 años)', descEs: 'Cada lugar donde has vivido en los últimos 5 años.' },
  6: { titleEs: '6. Historia laboral / educativa', descEs: 'Trabajos y estudios actuales y pasados.' },
  7: { titleEs: '7. Información sobre tus padres', descEs: 'Datos de papá y mamá biológicos.' },
  8: { titleEs: '8. Elegibilidad e inadmisibilidad', descEs: 'Preguntas Sí/No sobre tu historia. Si dudas, marca "Sí" y tu equipo legal te explica.' },
  9: { titleEs: '9. Información biográfica', descEs: 'Etnia, raza, altura, peso, color de ojos y cabello.' },
  10: { titleEs: '10. Tu firma y declaración', descEs: 'La firma final del solicitante. Se firma físicamente al imprimir.' },
  11: { titleEs: '11. Intérprete (solo si necesitas ayuda)', descEs: 'Datos de quien te ayuda con el inglés. Diana lo gestiona si aplica.' },
  12: { titleEs: '12. Preparador de la solicitud', descEs: 'Datos de Diana / Henry / abogado que prepara la solicitud.' },
  13: { titleEs: '13. Firma en la entrevista', descEs: 'Datos que se completan durante la entrevista USCIS.' },
  14: { titleEs: '14. Información adicional', descEs: 'Espacio extra para explicar respuestas más largas.' },
}

// Heurística: ¿editable por cliente?
function isEditableByClient(part) {
  if (part === null) return true
  // Parts 11, 12, 13 son del intérprete, preparador y entrevista — solo Diana/Henry
  if (part === 11 || part === 12 || part === 13) return false
  // Part 0 (header con A#, USCIS, attorney bar) — solo Diana
  if (part === 0) return false
  return true
}

// ──────────────────────────────────────────────────────────────────────
// 3) Generación de FieldSpec por field
// ──────────────────────────────────────────────────────────────────────

function inferLabel(short) {
  // Si el shortName termina con _N (índice numérico que agregamos para dups),
  // mirar el sufijo real antes del índice. Ejemplo: 'pt1line6_cb_sex_1' → '_sex'.
  const lower = short.toLowerCase()
  // Quitar todos los trailing _N (números puros)
  const cleaned = lower.replace(/(_\d+)+$/, '')
  // Buscar el último _xxx significativo (no-numérico)
  // Probamos sufijos progresivamente más largos para matchear cosas como _cb_sex
  const segments = cleaned.split('_')
  for (let i = 1; i <= 3 && i <= segments.length - 1; i++) {
    const sufKey = '_' + segments.slice(-i).join('_')
    if (SUFFIX_LABELS[sufKey]) return SUFFIX_LABELS[sufKey]
  }
  return null
}

function buildField(rawField, idxInPart) {
  const short = shortName(rawField.name).toLowerCase()
  const label = inferLabel(short)
  const part = detectPart(rawField.name)
  const editable = isEditableByClient(part)

  let labelEs = label?.es ?? short
  let helpEs = label?.help

  // Para los YN/YesNo, ajustar el on value y label
  let type = rawField.type
  if (type === 'dropdown') type = 'select'
  if (type === 'textarea' || type === 'text' || type === 'checkbox' || type === 'select') {
    // ok
  } else {
    type = 'text'
  }

  // Detección heurística de fechas (campos que contienen "date" en el nombre)
  if (type === 'text' && /date(of)?/i.test(short)) {
    type = 'date'
    helpEs = helpEs ?? 'MM/DD/YYYY'
  }
  // Detección heurística de teléfonos
  if (type === 'text' && /(phone|mobile)/i.test(short)) {
    type = 'phone'
  }
  // Detección heurística de zip
  if (type === 'text' && /zipcode/i.test(short)) {
    type = 'zip'
  }
  // Detección heurística de state (códigos US)
  if ((type === 'text' || type === 'dropdown') && /^[\s\S]*_state$/i.test(short)) {
    type = 'state'
  }

  // Para checkboxes con onValue, agregar al label
  if (rawField.type === 'checkbox' && rawField.checkboxOnValue) {
    if (rawField.checkboxOnValue === 'Y') {
      labelEs = `${labelEs} — Sí`
    } else if (rawField.checkboxOnValue === 'N') {
      labelEs = `${labelEs} — No`
    } else {
      labelEs = `${labelEs} (${rawField.checkboxOnValue})`
    }
  }

  // Pt8 line questions — son las 79 preguntas Yes/No
  if (part === 8 && rawField.checkboxOnValue) {
    const lineMatch = short.match(/pt8line(\d+[a-z]?)/i)
    if (lineMatch) {
      labelEs = `Pregunta 8.${lineMatch[1].toUpperCase()} — ${rawField.checkboxOnValue === 'Y' ? 'Sí' : 'No'}`
      helpEs = 'Si dudas, marca "Sí" y tu equipo legal te explica.'
    }
  }

  // Construir FieldSpec
  const sk = semanticKeyOf(rawField.name)
  const out = {
    semanticKey: sk,
    pdfFieldName: rawField.name,
    type,
    labelEs,
    part,
  }
  if (helpEs) out.helpEs = helpEs
  if (rawField.options && rawField.options.length > 0) {
    out.options = rawField.options.filter(o => o !== '').map(o => ({ value: o, labelEs: o }))
  }
  if (typeof rawField.maxLength === 'number' && rawField.maxLength > 0) {
    out.maxLength = rawField.maxLength
  }
  if (rawField.checkboxOnValue) out.checkboxOnValue = rawField.checkboxOnValue
  if (!editable) out.editableByClient = false
  return out
}

// ──────────────────────────────────────────────────────────────────────
// 4) Construir secciones
// ──────────────────────────────────────────────────────────────────────

const fieldsByPart = {}
for (let p = 0; p <= 14; p++) fieldsByPart[p] = []

// Filter out barcodes
const usableFields = raw.fields.filter(f => !f.name.includes('PDF417BarCode') && !f.name.includes('TopicalAreaSelectionBox'))

for (const f of usableFields) {
  const part = detectPart(f.name)
  if (part === null) continue
  fieldsByPart[part].push(f)
}

const sections = []
for (let p = 0; p <= 14; p++) {
  const fields = fieldsByPart[p]
  if (fields.length === 0) continue
  const meta = PART_TITLES[p] ?? { titleEs: `Parte ${p}`, descEs: '' }
  sections.push({
    id: p,
    titleEs: meta.titleEs,
    descriptionEs: meta.descEs,
    fields: fields.map((f, i) => buildField(f, i)),
  })
}

// ──────────────────────────────────────────────────────────────────────
// 5) Hardcoded SIJS values
// ──────────────────────────────────────────────────────────────────────
//
// El I-485 Part 2 tiene una lista de categorías. Para SIJS, marcar la opción
// que corresponde a "Special Immigrant Juvenile". El campo es Pt2Line11_CB[X]
// con onValue específico — del raw vemos que hay opciones 11A, 11B, 11C, 11D.
// Según el formulario USCIS I-485 de 2024+, la categoría SIJS está bajo el bloque
// de "Other Eligibility Category" como "11" subcategoría — para precisión nos
// limitamos a inicialización amistosa: marcar 11D (más común para SIJS) como
// hardcoded. Si no aplica, Diana lo desmarca.
//
// IMPORTANTE: este mapping debe verificarse manualmente contra el formulario
// oficial USCIS. Si la categoría SIJS está en otro Pt2LineX, ajustar.

const HARDCODED = {}
// Conservador: por ahora cero hardcoded. Se llenan a mano tras verificar el PDF.

// ──────────────────────────────────────────────────────────────────────
// 6) Required for print (mínimo necesario para que el PDF se considere completo)
// ──────────────────────────────────────────────────────────────────────

const REQUIRED = []
// Buscar nombres clave: nombre, fecha de nacimiento, A-Number (si lo tiene), país de nacimiento
const requiredPatterns = [
  /^pt1line1_familyname$/i,
  /^pt1line1_givenname$/i,
  /^pt1line5_dateofbirth$/i,
  /^pt1line6_countryofbirth$/i,
]
for (const sec of sections) {
  for (const f of sec.fields) {
    if (requiredPatterns.some(re => re.test(f.semanticKey))) REQUIRED.push(f.semanticKey)
  }
}

// ──────────────────────────────────────────────────────────────────────
// 7) Generación del archivo TS
// ──────────────────────────────────────────────────────────────────────

function ts(o, indent = 0) {
  const pad = '  '.repeat(indent)
  if (o === null || o === undefined) return 'undefined'
  if (typeof o === 'string') return JSON.stringify(o)
  if (typeof o === 'boolean' || typeof o === 'number') return String(o)
  if (Array.isArray(o)) {
    if (o.length === 0) return '[]'
    return '[\n' + o.map(x => pad + '  ' + ts(x, indent + 1)).join(',\n') + '\n' + pad + ']'
  }
  if (typeof o === 'object') {
    const keys = Object.keys(o).filter(k => o[k] !== undefined)
    if (keys.length === 0) return '{}'
    return '{ ' + keys.map(k => `${k}: ${ts(o[k], indent)}`).join(', ') + ' }'
  }
  return JSON.stringify(o)
}

let out = `// AUTO-GENERADO por scripts/build-i485-schema.mjs el ${new Date().toISOString()}.
// Editar esta cabecera de constantes (PDF_SHA256, FORM_SLUG, etc.) y refinar
// labels específicos a mano. Re-correr el generador SOLO si se actualiza
// scripts/i485-raw-fields.json — el regen sobrescribe TODO el archivo.
//
// Schema curado para USCIS Form I-485 (Application to Register Permanent
// Residence or Adjust Status). 24 páginas, ~760 fields.
//
// Si USCIS publica una nueva edición del PDF:
//   1. node scripts/normalize-i485.mjs    (mupdf normaliza obj-streams)
//   2. node scripts/inspect-i485-fields.mjs  (genera scripts/i485-raw-fields.json)
//   3. node scripts/build-i485-schema.mjs  (regenera ESTE archivo)
//   4. Actualizar PDF_SHA256 abajo si cambió.

import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────
// Constantes verificables al runtime
// ──────────────────────────────────────────────────────────────────

export const PDF_PUBLIC_PATH = '/forms/i-485.pdf'
export const PDF_DISK_PATH = 'public/forms/i-485.pdf'
export const PDF_SHA256 = ${JSON.stringify(SHA)}
export const SCHEMA_VERSION = '2026-05-uscis-i485-v1'
export const FORM_SLUG = 'uscis-i-485'
export const FORM_NAME = 'USCIS Form I-485'
export const FORM_DESCRIPTION_ES = 'Solicitud para Registrar Residencia Permanente o Ajustar Estatus (I-485)'

// ──────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'checkbox'
  | 'date'
  | 'phone'
  | 'state'
  | 'zip'
  | 'select'

export interface FieldOption {
  value: string
  labelEs: string
}

export interface FieldSpec {
  semanticKey: string
  pdfFieldName: string | null
  type: FieldType
  labelEs: string
  helpEs?: string
  page?: number
  required?: boolean
  hardcoded?: string | boolean
  deriveFrom?: string
  groupKey?: string
  options?: FieldOption[]
  maxLength?: number
  editableByClient?: boolean
  /** Para checkboxes con on-value específico (no "Yes"). */
  checkboxOnValue?: string
  /** Sección de origen (Pt1..Pt14, Pt0=cabecera). */
  part?: number
}

export interface I485Section {
  id: number
  titleEs: string
  descriptionEs: string
  fields: FieldSpec[]
}

// ──────────────────────────────────────────────────────────────────
// Secciones (auto-generadas)
// ──────────────────────────────────────────────────────────────────

export const I485_SECTIONS: I485Section[] = ${ts(sections, 0)}

// ──────────────────────────────────────────────────────────────────
// Hardcoded values (siempre aplicados antes de prefill+saved)
//
// REVISAR MANUALMENTE: la categoría SIJS en Part 2 debe quedar marcada.
// El campo es \`Pt2Line11_CB\` con onValue '11A'/'11B'/'11C'/'11D'. Verificar
// con el PDF oficial cuál corresponde a "Special Immigrant Juvenile" en la
// edición más reciente y agregar aquí como true.
// ──────────────────────────────────────────────────────────────────

export const HARDCODED_VALUES: Record<string, string | boolean> = ${ts(HARDCODED, 0)}

// ──────────────────────────────────────────────────────────────────
// Required for print
// ──────────────────────────────────────────────────────────────────

export const REQUIRED_FOR_PRINT: string[] = ${ts(REQUIRED, 0)}

// ──────────────────────────────────────────────────────────────────
// Field map flat para acceso O(1) por semanticKey
// ──────────────────────────────────────────────────────────────────

export const ALL_FIELDS: FieldSpec[] = I485_SECTIONS.flatMap((s) => s.fields)

export const FIELD_BY_KEY: Record<string, FieldSpec> = Object.fromEntries(
  ALL_FIELDS.map((f) => [f.semanticKey, f])
)

// ──────────────────────────────────────────────────────────────────
// Zod schema (validación parcial — todos opcionales)
// ──────────────────────────────────────────────────────────────────

const fieldsZodShape: Record<string, z.ZodTypeAny> = {}
for (const f of ALL_FIELDS) {
  let s: z.ZodTypeAny
  if (f.type === 'checkbox') {
    s = z.boolean()
  } else {
    s = z.string()
  }
  fieldsZodShape[f.semanticKey] = s.optional().nullable()
}

export const i485FormSchema = z.object(fieldsZodShape)
export type I485FormValues = z.infer<typeof i485FormSchema>
`

fs.writeFileSync(OUT_PATH, out)
console.log('Generado:', OUT_PATH)
console.log('  Secciones:', sections.length)
console.log('  Total fields:', sections.reduce((a, s) => a + s.fields.length, 0))
console.log('  REQUIRED_FOR_PRINT:', REQUIRED.length)

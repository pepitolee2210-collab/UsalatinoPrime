// Genera src/lib/legal/i130-form-schema.ts a partir de scripts/i130-raw-fields.json.
//
// Por qué auto-generado: el USCIS I-130 tiene ~450 fields en 9 partes — escribirlo
// a mano sería inmanejable. Este script aplica reglas heurísticas + overrides
// explícitos para producir el TS, igual que build-i485-schema.mjs.
//
// El I-130 (Petition for Alien Relative) lo firma el PETICIONARIO (esposo
// ciudadano). Estructura:
//   Parte 1 = Relación (Spouse para este caso)
//   Parte 2 = Información sobre el peticionario (el esposo ciudadano = client_id)
//   Parte 3 = Información biográfica del peticionario
//   Parte 4 = Información sobre el beneficiario (la esposa)
//   Parte 5 = Otra información
//   Parte 6 = Declaración y firma del peticionario
//   Parte 7 = Intérprete   (no editable por cliente)
//   Parte 8 = Preparador   (no editable por cliente)
//   Parte 9 = Información adicional
//
// Uso: node scripts/build-i130-schema.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const RAW_PATH = path.join(__dirname, 'i130-raw-fields.json')
const OUT_PATH = path.join(repoRoot, 'src', 'lib', 'legal', 'i130-form-schema.ts')

const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'))
const SHA = raw.sha256

// ──────────────────────────────────────────────────────────────────────
// 1) Helpers de parseo de pdfFieldName
// ──────────────────────────────────────────────────────────────────────

function shortName(fullName) {
  // form1[0].#subform[0].Pt2Line4a_FamilyName[0] → Pt2Line4a_FamilyName
  const m = fullName.match(/\.([^.\[]+)\[(\d+)\]$/)
  if (!m) return fullName
  const base = m[1]
  const idx = m[2] === '0' ? '' : `_${m[2]}`
  return `${base}${idx}`
}

function detectPart(fullName) {
  const norm = fullName.toLowerCase()
  let m = norm.match(/\.pt(\d+)/i)
  if (m) return parseInt(m[1], 10)
  m = norm.match(/\.part(\d+)/i)
  if (m) return parseInt(m[1], 10)
  m = norm.match(/\.p(\d+)(?:_|line)/i)
  if (m) return parseInt(m[1], 10)
  // Headers de página (relación, números legales, cuenta USCIS, etc.)
  if (/aliennumber|usciso|uscisonline|volagnumber|attorneystatebar|checkbox1/i.test(norm)) return 0
  return null
}

function semanticKeyOf(fullName) {
  return shortName(fullName).toLowerCase()
}

// ──────────────────────────────────────────────────────────────────────
// 2) Mapeo de sufijos de field name → tipo y label heurístico
// ──────────────────────────────────────────────────────────────────────

const SUFFIX_LABELS = {
  '_familyname': { es: 'Apellido(s)' },
  '_givenname': { es: 'Primer nombre' },
  '_middlename': { es: 'Segundo nombre' },
  '_cb_sex': { es: 'Sexo' },
  '_sex': { es: 'Sexo' },
  '_male': { es: 'Sexo — Masculino' },
  '_female': { es: 'Sexo — Femenino' },
  '_dob': { es: 'Fecha de nacimiento', help: 'MM/DD/YYYY' },
  '_dateofbirth': { es: 'Fecha de nacimiento', help: 'MM/DD/YYYY' },
  '_ssn': { es: 'Número de Seguro Social (SSN)', help: 'Si no tiene, dejar vacío / N/A.' },
  '_aliennumber': { es: 'Número A (si lo tiene)', help: '9 dígitos que empiezan con A. Si no tiene, dejar vacío.' },
  '_usciso': { es: 'Número de cuenta USCIS Online', help: 'Si abrió cuenta en my.uscis.gov. Si no, dejar vacío.' },
  '_uscisonlineacctnumber': { es: 'Número de cuenta USCIS Online', help: 'Si abrió cuenta en my.uscis.gov. Si no, dejar vacío.' },
  '_streetname': { es: 'Calle (Street)', help: 'Número y nombre de la calle.' },
  '_streetnumbername': { es: 'Calle (Street)', help: 'Número y nombre de la calle.' },
  '_unit': { es: 'Tipo de unidad (Apt/Ste/Flr)' },
  '_aptsteflrnumber': { es: 'Número de unidad' },
  '_number': { es: 'Número' },
  '_city': { es: 'Ciudad' },
  '_cityortown': { es: 'Ciudad' },
  '_state': { es: 'Estado' },
  '_zipcode': { es: 'Código postal (ZIP)' },
  '_postalcode': { es: 'Código postal (extranjero)' },
  '_province': { es: 'Provincia (extranjero)' },
  '_country': { es: 'País' },
  '_email': { es: 'Correo electrónico' },
  '_emailaddress': { es: 'Correo electrónico' },
  '_daytimephonenumber': { es: 'Teléfono diurno' },
  '_daytimetelephone': { es: 'Teléfono diurno' },
  '_mobilenumber': { es: 'Celular' },
  '_mobiletelephone': { es: 'Celular' },
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
  '_cityofbirth': { es: 'Ciudad de nacimiento' },
  '_citytown': { es: 'Ciudad/pueblo' },
  '_countryofbirth': { es: 'País de nacimiento' },
  '_countryofcitizenship': { es: 'País de ciudadanía' },
  '_countryofcitizenshipornationality': { es: 'País de ciudadanía o nacionalidad' },
  '_signature': { es: 'Firma' },
  '_dateofsignature': { es: 'Fecha de firma' },
  '_organization': { es: 'Organización' },
  '_orgname': { es: 'Nombre de la organización' },
  '_businessname': { es: 'Nombre del negocio/firma' },
  '_explanation': { es: 'Explicación', help: 'Detalla brevemente.' },
  '_additionalinfo': { es: 'Información adicional' },
  '_incareofname': { es: 'A nombre de (In Care Of)' },
  '_volagnumber': { es: 'Número Volag', help: 'Solo si una agencia voluntaria asistió. Lo deja el equipo legal.' },
  '_attorneystatebarnumber': { es: 'State Bar # del abogado', help: 'Lo completa el equipo legal.' },
  '_maritalstatus': { es: 'Estado civil' },
  '_married': { es: 'Estado civil — Casado/a' },
  '_single': { es: 'Estado civil — Soltero/a' },
  '_divorced': { es: 'Estado civil — Divorciado/a' },
  '_widowed': { es: 'Estado civil — Viudo/a' },
  '_timesmarried': { es: 'Número de veces casado/a' },
  '_numberofmarriages': { es: 'Número de veces casado/a' },
  '_dateofmarriage': { es: 'Fecha del matrimonio actual', help: 'MM/DD/YYYY — del acta de matrimonio.' },
  '_placeofmarriage': { es: 'Lugar del matrimonio actual' },
  '_i94': { es: 'Número I-94' },
  '_i94number': { es: 'Número I-94' },
  '_passportnumber': { es: 'Número de pasaporte' },
  '_traveldocnumber': { es: 'Número de documento de viaje' },
  '_dateofexpiration': { es: 'Fecha de vencimiento', help: 'MM/DD/YYYY' },
  '_expirationdate': { es: 'Fecha de vencimiento', help: 'MM/DD/YYYY' },
  '_classofadmission': { es: 'Clase de admisión', help: 'Tipo de visa/permiso con que entró (ej. B-2).' },
  '_dateofarrival': { es: 'Fecha de llegada', help: 'MM/DD/YYYY' },
  '_occupation': { es: 'Ocupación' },
  '_nameofemployer': { es: 'Nombre del empleador' },
  '_employername': { es: 'Nombre del empleador' },
  '_certificatenumber': { es: 'Número de certificado', help: 'De naturalización/ciudadanía, si aplica.' },
  '_placeofissuance': { es: 'Lugar de emisión' },
  '_dateofissuance': { es: 'Fecha de emisión', help: 'MM/DD/YYYY' },
}

const PART_TITLES = {
  0: { titleEs: '0. Encabezado (números legales)', descEs: 'Datos de identificación legal. El equipo legal suele completarlos.' },
  1: { titleEs: '1. Relación', descEs: 'Tu relación con la persona que pides. Para un cónyuge se marca "Spouse" (esposo/a).' },
  2: { titleEs: '2. Información sobre ti (el peticionario)', descEs: 'Tú eres el ciudadano estadounidense que presenta la petición: nombre, nacimiento, dirección, estado civil, prueba de ciudadanía y empleo.' },
  3: { titleEs: '3. Información biográfica (del peticionario)', descEs: 'Etnia, raza, estatura, peso, color de ojos y cabello — sobre ti, el peticionario.' },
  4: { titleEs: '4. Información sobre el beneficiario (tu cónyuge)', descEs: 'Datos de tu cónyuge extranjero/a: nombre, nacimiento, pasaporte, entrada a EE.UU., y dónde ajustará su estatus.' },
  5: { titleEs: '5. Otra información', descEs: 'Peticiones previas y datos de contacto del peticionario.' },
  6: { titleEs: '6. Declaración y firma del peticionario', descEs: 'Tu firma. Se firma físicamente al imprimir; una petición sin firma se rechaza.' },
  7: { titleEs: '7. Intérprete (solo si se usó)', descEs: 'Datos de quien tradujo el formulario, si aplica. Lo gestiona el equipo legal.' },
  8: { titleEs: '8. Preparador (si lo llenó otra persona)', descEs: 'Datos de quien preparó la solicitud. Lo completa el equipo legal.' },
  9: { titleEs: '9. Información adicional', descEs: 'Espacio extra para respuestas que no caben en su sección.' },
}

// Heurística: ¿editable por cliente?
function isEditableByClient(part) {
  if (part === null) return true
  // Parte 7 (intérprete) y 8 (preparador) — solo el equipo legal
  if (part === 7 || part === 8) return false
  // Encabezado con A#, USCIS online, attorney bar, volag — solo equipo legal
  if (part === 0) return false
  return true
}

// ──────────────────────────────────────────────────────────────────────
// 3) Generación de FieldSpec por field
// ──────────────────────────────────────────────────────────────────────

function inferLabel(short) {
  const lower = short.toLowerCase()
  const cleaned = lower.replace(/(_\d+)+$/, '')
  const segments = cleaned.split('_')
  for (let i = 1; i <= 3 && i <= segments.length - 1; i++) {
    const sufKey = '_' + segments.slice(-i).join('_')
    if (SUFFIX_LABELS[sufKey]) return SUFFIX_LABELS[sufKey]
  }
  return null
}

function buildField(rawField, _idxInPart) {
  const short = shortName(rawField.name).toLowerCase()
  const label = inferLabel(short)
  const part = detectPart(rawField.name)
  const editable = isEditableByClient(part)

  let labelEs = label?.es ?? short
  let helpEs = label?.help

  let type = rawField.type
  if (type === 'dropdown') type = 'select'
  if (type === 'textarea' || type === 'text' || type === 'checkbox' || type === 'select') {
    // ok
  } else {
    type = 'text'
  }

  if (type === 'text' && /date(of)?/i.test(short)) {
    type = 'date'
    helpEs = helpEs ?? 'MM/DD/YYYY'
  }
  if (type === 'text' && /(phone|mobile)/i.test(short)) {
    type = 'phone'
  }
  if (type === 'text' && /zipcode/i.test(short)) {
    type = 'zip'
  }
  if ((type === 'text' || type === 'dropdown') && /^[\s\S]*_state$/i.test(short)) {
    type = 'state'
  }

  if (rawField.type === 'checkbox' && rawField.checkboxOnValue) {
    if (rawField.checkboxOnValue === 'Y') {
      labelEs = `${labelEs} — Sí`
    } else if (rawField.checkboxOnValue === 'N') {
      labelEs = `${labelEs} — No`
    } else {
      labelEs = `${labelEs} (${rawField.checkboxOnValue})`
    }
  }

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
    // Dedup: algunos dropdowns del PDF oficial repiten opciones (ej. el estado
    // "UT" aparece dos veces), lo que rompería las React keys del modal.
    const seenOpt = new Set()
    out.options = []
    for (const o of rawField.options) {
      if (o === '' || seenOpt.has(o)) continue
      seenOpt.add(o)
      out.options.push({ value: o, labelEs: o })
    }
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
for (let p = 0; p <= 9; p++) fieldsByPart[p] = []

const usableFields = raw.fields.filter(f => !f.name.includes('PDF417BarCode') && !f.name.includes('TopicalAreaSelectionBox'))

for (const f of usableFields) {
  const part = detectPart(f.name)
  if (part === null) continue
  if (part < 0 || part > 9) continue
  fieldsByPart[part].push(f)
}

const sections = []
for (let p = 0; p <= 9; p++) {
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
// 5) Hardcoded values
//
// Parte 1: relación = Spouse (este servicio es siempre por matrimonio).
// Parte 2: el peticionario es ciudadano estadounidense.
// Los nombres exactos de los checkboxes se confirman tras inspeccionar; se
// dejan vacíos aquí y se curan a mano en el .ts si el generador no los captó.
// ──────────────────────────────────────────────────────────────────────

const HARDCODED = {}
// Pt1Line1_Spouse: marca "Spouse" en la Parte 1.
for (const sec of sections) {
  for (const f of sec.fields) {
    if (/^pt1line1_spouse$/i.test(f.semanticKey)) HARDCODED[f.semanticKey] = true
  }
}

// ──────────────────────────────────────────────────────────────────────
// 6) Required for print (mínimo: nombre del peticionario y del beneficiario)
// ──────────────────────────────────────────────────────────────────────

const REQUIRED = []
const requiredPatterns = [
  /^pt2line4_familyname$/i,
  /^pt2line4_givenname$/i,
  /^pt2line4a_familyname$/i,
  /^pt2line4b_givenname$/i,
  /^pt4line4_familyname$/i,
  /^pt4line4a_familyname$/i,
  /^pt4line4b_givenname$/i,
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

let out = `// AUTO-GENERADO por scripts/build-i130-schema.mjs el ${new Date().toISOString()}.
// Editar esta cabecera de constantes (PDF_SHA256, FORM_SLUG, etc.) y refinar
// labels específicos a mano. Re-correr el generador SOLO si se actualiza
// scripts/i130-raw-fields.json — el regen sobrescribe TODO el archivo.
//
// Schema curado para USCIS Form I-130 (Petition for Alien Relative), edición
// 04/01/24. Caso base: petición por matrimonio, peticionario ciudadano (cliente
// del caso) patrocinando a su cónyuge extranjero/a.
//
// Si USCIS publica una nueva edición del PDF:
//   1. node scripts/normalize-i130.mjs    (mupdf normaliza obj-streams)
//   2. node scripts/inspect-i130-fields.mjs  (genera scripts/i130-raw-fields.json)
//   3. node scripts/build-i130-schema.mjs  (regenera ESTE archivo)
//   4. Actualizar PDF_SHA256 abajo si cambió.

import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────
// Constantes verificables al runtime
// ──────────────────────────────────────────────────────────────────

export const PDF_PUBLIC_PATH = '/forms/i-130.pdf'
export const PDF_DISK_PATH = 'public/forms/i-130.pdf'
export const PDF_SHA256 = ${JSON.stringify(SHA)}
export const SCHEMA_VERSION = '2026-06-uscis-i130-v1'
export const FORM_SLUG = 'uscis-i-130'
export const FORM_NAME = 'USCIS Form I-130'
export const FORM_DESCRIPTION_ES = 'Petición de Familiar Extranjero (I-130) — por matrimonio'

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
  /** Sección de origen (Pt1..Pt9, Pt0=cabecera). */
  part?: number
}

export interface I130Section {
  id: number
  titleEs: string
  descriptionEs: string
  fields: FieldSpec[]
}

// ──────────────────────────────────────────────────────────────────
// Secciones (auto-generadas)
// ──────────────────────────────────────────────────────────────────

export const I130_SECTIONS: I130Section[] = ${ts(sections, 0)}

// ──────────────────────────────────────────────────────────────────
// Hardcoded values (siempre aplicados antes de prefill+saved)
//
// Parte 1 relación = Spouse. La ciudadanía del peticionario (Parte 2) se marca
// como "U.S. Citizen" en el prefill (depende del nombre real del checkbox).
// ──────────────────────────────────────────────────────────────────

export const HARDCODED_VALUES: Record<string, string | boolean> = ${ts(HARDCODED, 0)}

// ──────────────────────────────────────────────────────────────────
// Required for print
// ──────────────────────────────────────────────────────────────────

export const REQUIRED_FOR_PRINT: string[] = ${ts(REQUIRED, 0)}

// ──────────────────────────────────────────────────────────────────
// Field map flat para acceso O(1) por semanticKey
// ──────────────────────────────────────────────────────────────────

export const ALL_FIELDS: FieldSpec[] = I130_SECTIONS.flatMap((s) => s.fields)

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

export const i130FormSchema = z.object(fieldsZodShape)
export type I130FormValues = z.infer<typeof i130FormSchema>
`

fs.writeFileSync(OUT_PATH, out)
console.log('Generado:', OUT_PATH)
console.log('  Secciones:', sections.length)
console.log('  Total fields:', sections.reduce((a, s) => a + s.fields.length, 0))
console.log('  HARDCODED:', Object.keys(HARDCODED).length, JSON.stringify(HARDCODED))
console.log('  REQUIRED_FOR_PRINT:', REQUIRED.length, JSON.stringify(REQUIRED))

# Guía maestra: automatizar un formulario oficial

> **Audiencia**: una IA o desarrollador que reciba la instrucción "automatiza el formulario X" y deba producir la integración completa (formulario interactivo + impresión rellenada + persistencia auditable + visibilidad para clientes del mismo estado).
>
> **Resultado esperado al seguir esta guía**: los admins del sistema verán los botones **"Abrir formulario"** y **"Imprimir"** en la tarjeta del formulario en el panel `Jurisdicción detectada` de cualquier caso del estado correspondiente. El modal precarga datos del cliente desde la BD; el botón Imprimir descarga un PDF rellenado, lo archiva en Storage + `documents` + `case_form_instances` + `case_activity`.
>
> **Estado a 2026-04-28**: tres formularios automatizados en producción (`tx-fm-sapcr-100`, `tx-fm-sapcr-aff-100`, `tx-pr-gen-116`). La arquitectura está estabilizada — añadir un nuevo formulario NO requiere tocar UI, endpoints, ni schemas de BD.

---

## 1. Resumen ejecutivo

### 1.1 Qué obtienes "gratis" al registrar un formulario

Cuando creas los archivos de un nuevo formulario y lo registras en `AUTOMATED_FORMS`, el sistema activa **automáticamente**:

1. **Tarjeta en el panel de jurisdicción** con tres botones: ↓ Descargar oficial · ✏ Abrir formulario · 🖨 Imprimir.
2. **Modal interactivo** (`AutomatedFormModal`) con:
   - Secciones colapsables, índice lateral, badge de campos obligatorios pendientes.
   - Campos de tipo `text`, `textarea`, `checkbox`, `date`, `phone`, `state`, `zip`, `select`.
   - Soporte para `hiddenByDefault` (UIs progresivas con sentinel `__show_all__`).
   - Banner amarillo de advertencia legal contextual (`computeLegalWarnings`).
   - Autosave con debounce 600ms a `case_form_instances.filled_values`.
   - Optimistic concurrency (header `expectedUpdatedAt`).
3. **Endpoint genérico de impresión** que rellena el AcroForm con `pdf-lib`, aplana, archiva en `case-documents` Storage, registra en `documents` (con `direction: 'admin_to_client'`) y `case_activity` (con `slug`, `pdf_sha256`, `schema_version`, `instance_id`).
4. **Detección de SHA-256** del PDF en disco — si Texas/.gov publica una nueva revisión, el endpoint falla loudly y obliga a re-mapear el schema.
5. **Visibilidad inmediata para clientes del mismo estado** (incluyendo casos cacheados antes de la automatización), vía `getInjectedFormsForState` en `automated-forms-registry.ts`.
6. **Aprendizaje automático de la IA de research**: el slug se inyecta dinámicamente en `{{SLUG_CATALOG}}` del system prompt de `research-jurisdiction.ts` para que futuras investigaciones lo etiqueten nativamente.

### 1.2 Lo que NO se toca al añadir un formulario

| Archivo | Por qué no se modifica |
|---|---|
| `src/lib/legal/acroform-service.ts` | `fillAcroForm` es agnóstico — ya quita `MaxLen` automático, soporta on-values custom de checkboxes, hace flatten al final. |
| `src/app/admin/cases/[id]/automated-form-modal.tsx` | Modal genérico que renderiza cualquier definition del registry. |
| `src/app/api/admin/case-forms/[slug]/route.ts` | GET/PUT genéricos con concurrency y validación Zod. |
| `src/app/api/admin/case-forms/[slug]/print/route.ts` | POST de impresión genérico que invoca `processForPrint` si está definido. |
| `src/app/admin/cases/[id]/jurisdiction-panel.tsx` | UI que renderiza los botones según `resolveAutomatedFormSlug`. |
| `src/app/api/admin/case-jurisdiction/route.ts` | Endpoint que hace `enrichWithRegistryForms` antes del response. |
| Schemas de BD | `case_form_instances`, `documents`, `case_activity` ya soportan cualquier slug. |

Si te encuentras tocando alguno de estos archivos para automatizar UN formulario, **probablemente estás añadiendo una capacidad nueva al sistema** (no automatizando un form). Esa capacidad debe documentarse aquí después.

---

## 2. Arquitectura

### 2.1 Los tres niveles de detección

Cuando el frontend pide la jurisdicción de un caso, el slug aparece en cada `RequiredForm` por **uno de tres caminos** (en orden de fallback):

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SLUG NATIVO (la IA emite el campo `slug` directamente)   │
│    Cubre: casos investigados DESPUÉS de añadir al registry  │
│    Implementación:                                          │
│      research-jurisdiction.ts:542                           │
│      RESEARCHER_SYSTEM.replace('{{SLUG_CATALOG}}',          │
│        getRegisteredSlugCatalogMarkdown())                  │
└─────────────────────────────────────────────────────────────┘
                             ↓ fallback
┌─────────────────────────────────────────────────────────────┐
│ 2. DETECCIÓN POR NOMBRE (regex laxa sobre form.name)        │
│    Cubre: casos cacheados con el form listado pero sin slug │
│    Implementación:                                          │
│      automated-forms-registry.ts:279 (resolveAutomatedFormSlug)│
│      def.detectByName(form.name)                            │
└─────────────────────────────────────────────────────────────┘
                             ↓ fallback
┌─────────────────────────────────────────────────────────────┐
│ 3. INYECCIÓN RUNTIME (form NO listado en el cache)          │
│    Cubre: casos cacheados que matchean el `states: [...]`   │
│           del registry pero la IA no listó este form        │
│    Implementación:                                          │
│      automated-forms-registry.ts:296+ (getInjectedForms…)   │
│      case-jurisdiction/route.ts:14-37 (enrichWithRegistry…) │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Flow de datos al rellenar e imprimir

```
Usuario admin click "Abrir formulario"
     │
     ▼
GET /api/admin/case-forms/<slug>?caseId=X
     │  ← crea case_form_instances row si no existe
     │  ← computa prefilledValues(caseId, supabase) desde:
     │       profiles, case_form_submissions (tutor_guardian/client_story),
     │       case_jurisdictions, case_form_instances de OTROS forms
     │  ← computa legalWarnings (opcional)
     ▼
Modal renderiza: hardcoded ⊕ prefilled ⊕ saved (saved gana)
     │
     ▼  (admin edita un campo)
PUT /api/admin/case-forms/<slug>  body: { caseId, values, expectedUpdatedAt }
     │  ← Zod valida
     │  ← optimistic concurrency check
     │  ← upsert filled_values, status='ready'
     ▼
     (autosave continúa con cada cambio, debounce 600ms)
     │
     ▼  (admin click "Imprimir oficial")
POST /api/admin/case-forms/<slug>/print  body: { caseId }
     │  ← lee PDF de disk + verifica SHA-256
     │  ← effective = hardcoded ⊕ prefilled ⊕ saved
     │  ← processForPrint(effective)  [si está definido]
     │  ← chequea required not-empty
     │  ← mapea semanticKey → pdfFieldName
     │  ← fillAcroForm(pdfBytes, valuesByPdfName, { flatten: true })
     │  ← upload a case-documents Storage
     │  ← INSERT documents + UPDATE case_form_instances + INSERT case_activity
     ▼
HTTP 200 application/pdf descarga al cliente
```

---

## 3. Receta paso a paso

### 3.1 Obtener el PDF oficial

Antes de automatizar, asegúrate de tener:
- El PDF oficial del estado correspondiente, descargado de su fuente `.gov`/`.us` autoritativa.
- Confirmar el slug que vas a usar. Convención: `<state-code>-<form-code>` en minúsculas, separadores con guión. Ejemplos: `tx-fm-sapcr-100`, `tx-pr-gen-116`, `ca-gc-210`, `ny-uj-145`.
- Confirmar el `packetType`: `'intake'` (radicación inicial / coversheet) o `'merits'` (sustantivo).

```bash
# Coloca el PDF en su sitio canónico
cp /path/to/original.pdf repo/public/forms/{{slug}}.pdf
```

### 3.2 (Si aplica) Normalizar el PDF

> ⚠️ **Cuándo aplica**: si al inspeccionar con `pdf-lib` (paso 3.3) ves errores `Invalid object ref` en stderr o `Total fields: 0` con el PDF claramente teniendo fields visibles, el PDF tiene **object streams comprimidos + encryption con password vacía** (PDF 1.5+). Pasó con PR-GEN-116; NO pasó con SAPCR-100/SAPCR-AFF-100.

```bash
# Una sola vez. Backup del original (queda como referencia auditable):
cp repo/public/forms/{{slug}}.pdf repo/public/forms/{{slug}}.original.pdf

# Crea repo/scripts/normalize-{{slug}}.mjs copiando normalize-pr-gen-116.mjs
# y cambiando solo las constantes PDF_PATH/BACKUP_PATH.

cd repo && node scripts/normalize-{{slug}}.mjs
# Output: SHA-256 nuevo, tamaño post-descompresión (~2x). El PDF original se
# sobreescribe con la versión normalizada.
```

Plantilla de `normalize-{{slug}}.mjs` (basada en `scripts/normalize-pr-gen-116.mjs`):

```js
import * as mupdf from 'mupdf'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const PDF_PATH = path.join(repoRoot, 'public', 'forms', '{{slug}}.pdf')
const BACKUP_PATH = path.join(repoRoot, 'public', 'forms', '{{slug}}.original.pdf')

async function main() {
  const bytes = fs.readFileSync(PDF_PATH)
  if (!fs.existsSync(BACKUP_PATH)) fs.writeFileSync(BACKUP_PATH, bytes)

  const doc = mupdf.PDFDocument.openDocument(bytes, 'application/pdf')

  // Quitar /Encrypt del trailer fuerza output sin re-encryption.
  try { doc.getTrailer()?.delete?.('Encrypt') } catch { /* ignore */ }

  const buffer = doc.saveToBuffer(
    'compress=no,decompress=yes,garbage=4,sanitize=yes,clean=yes,decrypt=yes,encryption=none'
  )
  fs.writeFileSync(PDF_PATH, buffer.asUint8Array())
  console.log('SHA-256:', crypto.createHash('sha256').update(buffer.asUint8Array()).digest('hex'))
  doc.destroy()
}
main().catch(e => { console.error(e); process.exit(1) })
```

### 3.3 Inspeccionar AcroForm fields

Crea `repo/scripts/inspect-{{slug}}-fields.mjs` copiando `scripts/inspect-pr-gen-116-fields.mjs` y cambiando solo `PDF_PATH` y `OUTPUT_PATH`. Ejecuta:

```bash
cd repo && node scripts/inspect-{{slug}}-fields.mjs
```

Output:
- **stdout**: `SHA-256: <hex>` ← lo necesitas para el schema.
- `repo/scripts/{{slug}}-raw-fields.json` ← lista de fields con `name`, `type` (text/checkbox/radio/dropdown), `pages`, `maxLength`, `checkboxOnValue`. Esta es tu fuente de verdad para mapear a `semanticKey`.

### 3.4 Crear el schema curado

Crea `repo/src/lib/legal/{{slug}}-form-schema.ts`. Para forms simples sigue `sapcr-aff-100-form-schema.ts` como referencia. Para forms con campos virtuales (dropdown semántico que mapea a checkboxes reales) sigue `pr-gen-116-form-schema.ts`.

Estructura mínima:

```ts
import { z } from 'zod'

// ── Constantes verificables al runtime ───────────────────────────────────────
export const PDF_PUBLIC_PATH = '/forms/{{slug}}.pdf'
export const PDF_DISK_PATH = 'public/forms/{{slug}}.pdf'
export const PDF_SHA256 = '<output del paso 3.3>'
export const SCHEMA_VERSION = '<rev del PDF — ej "2025-09-legis-update">'
export const FORM_SLUG = '{{slug}}'
export const FORM_NAME = '<estado> <código> <nombre corto en inglés>'
export const FORM_DESCRIPTION_ES = '<una línea en español>'

// ── Tipos ────────────────────────────────────────────────────────────────────
export type FieldType =
  | 'text' | 'textarea' | 'checkbox' | 'date' | 'phone' | 'state' | 'zip' | 'select'

export interface FieldOption { value: string; labelEs: string }
export interface FieldSpec {
  semanticKey: string
  pdfFieldName: string | null  // null = virtual (resuelve processForPrint)
  type: FieldType
  labelEs: string
  helpEs?: string
  page?: number
  required?: boolean
  hardcoded?: string | boolean
  deriveFrom?: string           // dot-path en el data bag del prefill
  groupKey?: string             // para checkboxes mutuamente exclusivos
  options?: FieldOption[]       // requerido para type 'select'
  maxLength?: number
  hiddenByDefault?: boolean     // sólo visible cuando algún select tiene '__show_all__'
}

export interface FormSection {
  id: number
  titleEs: string
  descriptionEs: string
  fields: FieldSpec[]
}

// ── Secciones (cada una agrupa fields del PDF) ───────────────────────────────
const SECTION_1: FormSection = {
  id: 1,
  titleEs: '1. Identificación del peticionario',
  descriptionEs: 'Datos de contacto, nombres de las partes.',
  fields: [
    { semanticKey: 'petitioner_name', pdfFieldName: 'Name',
      type: 'text', labelEs: 'Nombre del peticionario',
      page: 1, required: true, deriveFrom: 'petitioner.full_name' },
    // ... un FieldSpec por cada AcroForm field listado en el JSON del paso 3.3
  ],
}

export const FORM_SECTIONS: FormSection[] = [SECTION_1, /* SECTION_2, ... */]

// ── Exports derivados ────────────────────────────────────────────────────────
export const ALL_FIELDS: FieldSpec[] = FORM_SECTIONS.flatMap(s => s.fields)
export const FIELD_BY_KEY: Record<string, FieldSpec> = Object.fromEntries(
  ALL_FIELDS.map(f => [f.semanticKey, f])
)

// Hardcoded values: aplican siempre antes del prefill (admin puede sobrescribir)
export const HARDCODED_VALUES: Record<string, string | boolean> = ALL_FIELDS.reduce(
  (acc, f) => { if (f.hardcoded !== undefined) acc[f.semanticKey] = f.hardcoded; return acc },
  {} as Record<string, string | boolean>
)

// ── Zod schema (todos opcionales — required se valida aparte) ────────────────
const valueSchema = z.union([z.string(), z.boolean()]).optional().nullable()
const dynamicShape: Record<string, z.ZodTypeAny> = {}
for (const f of ALL_FIELDS) dynamicShape[f.semanticKey] = valueSchema
export const formSchema = z.object(dynamicShape)
export type FormValues = z.infer<typeof formSchema>

export const REQUIRED_FOR_PRINT: string[] = ALL_FIELDS
  .filter(f => f.required)
  .map(f => f.semanticKey)
```

#### Reglas para mapear AcroForm fields a `semanticKey`

| AcroForm name | Tipo | semanticKey sugerido | Notas |
|---|---|---|---|
| `Name` | text | `petitioner_name` | Si el form mezcla peticionario y otros, usa prefijo (`petitioner_`, `respondent_a_`, `child_1_`). |
| `Pro Se PlaintiffPetitioner` | checkbox | `person_completing_pro_se` | Para SIJS: `hardcoded: true`. |
| `Custody or Visitation` | checkbox | `case_type_cb_family_law__parent_child__custody_or_visitation` | Si va dentro de un grupo virtual `case_type`, prefíja con `case_type_cb_`. |
| `Child's Date of Birth 1` | text | `child_1_dob` | Tipo `date`. Prefill formateado MM/DD/YYYY. |

Convenciones:
- **snake_case** para semanticKey.
- Prefijo identificando el rol (`petitioner_`, `respondent_a_`, `child_1_`, `case_`, `jurisdiction_`).
- Para grupos mutuamente exclusivos de checkboxes, usar `groupKey: 'standing'` para que la UI/admin sepa que sólo uno aplica.

#### Hardcoded universales (defaults SIJS para Texas family law)

Forman parte del schema, no del prefill. Se aplican siempre y el admin puede destildarlos:

```ts
{ semanticKey: 'person_completing_pro_se', /* ... */ hardcoded: true }
{ semanticKey: 'case_type', /* ... */ hardcoded: 'family_law__parent_child__custody_or_visitation' }
```

### 3.5 Crear el prefill

Crea `repo/src/lib/legal/{{slug}}-prefill.ts`. Patrón: construir un **data bag** desde 4-5 fuentes en BD, luego resolver cada `deriveFrom` del schema contra ese bag.

Plantilla mínima (basada en `sapcr-aff-100-prefill.ts`):

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { ALL_FIELDS, HARDCODED_VALUES, type FormValues } from './{{slug}}-form-schema'
import { createLogger } from '@/lib/logger'

const log = createLogger('{{slug}}-prefill')

interface DataBag {
  petitioner: { full_name: string; phone: string; email: string; /* ... */ }
  child_1: { full_name: string; dob: string; /* ... */ }
  jurisdiction: { county: string; state_code: string; /* ... */ }
  // ...secciones según el form
}

function get(bag: unknown, path: string): unknown {
  if (!path) return undefined
  const parts = path.split('.')
  let cur: unknown = bag
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

async function buildDataBag(caseId: string, service: SupabaseClient): Promise<DataBag> {
  const caseRes = await service.from('cases').select('client_id').eq('id', caseId).single()
  const clientId = caseRes.data?.client_id ?? null

  const [profileRes, tutorRes, storyRes, jurisdictionRes /*, otherFormRes */] = await Promise.all([
    clientId
      ? service.from('profiles').select('first_name, last_name, phone, email, address_*').eq('id', clientId).single()
      : Promise.resolve({ data: null }),
    service.from('case_form_submissions').select('form_data')
      .eq('case_id', caseId).eq('form_type', 'tutor_guardian').maybeSingle(),
    service.from('case_form_submissions').select('form_data')
      .eq('case_id', caseId).eq('form_type', 'client_story').maybeSingle(),
    service.from('case_jurisdictions').select('state_code, court_name')
      .eq('case_id', caseId).maybeSingle(),
    // (Opcional) Si reusas datos de otro form ya rellenado en este caso:
    // service.from('case_form_instances').select('filled_values')
    //   .eq('case_id', caseId).eq('form_name', 'TX FM-SAPCR-100 Petition').maybeSingle(),
  ])

  // ... construir el bag con lógica específica del form
  return { /* ... */ } as DataBag
}

export async function build{{Slug}}PrefilledValues(
  caseId: string,
  service: SupabaseClient
): Promise<Partial<FormValues>> {
  const bag = await buildDataBag(caseId, service)
  const out: Record<string, string | boolean> = { ...HARDCODED_VALUES }

  for (const f of ALL_FIELDS) {
    if (!f.deriveFrom) continue
    const v = get(bag, f.deriveFrom)
    if (v === undefined || v === null) continue
    if (typeof v === 'boolean' || typeof v === 'string') out[f.semanticKey] = v
    else if (typeof v === 'number') out[f.semanticKey] = String(v)
  }

  log.info('prefill computed', { caseId, fieldsWithValues: Object.keys(out).length })
  return out as Partial<FormValues>
}
```

#### Reuso entre forms del mismo caso (cross-form data bag)

Si tu form depende de datos que el cliente ya rellenó en otro form del mismo caso (ej: PR-GEN-116 reutiliza el `petitioner_mailing_address` del SAPCR-100), añade una query a `case_form_instances`:

```ts
service.from('case_form_instances').select('filled_values')
  .eq('case_id', caseId)
  .eq('packet_type', 'merits')
  .eq('form_name', 'TX FM-SAPCR-100 Petition')
  .maybeSingle()
```

Y úsalo en el bag con fallback. Ejemplo real en `pr-gen-116-prefill.ts:121-163` (parser de address con regex).

### 3.6 Registrar en `AUTOMATED_FORMS`

Edita `repo/src/lib/legal/automated-forms-registry.ts`. Añade:

1. **Importaciones** (después de los imports existentes):

```ts
import {
  PDF_PUBLIC_PATH as {{SLUG_UPPER}}_PDF_PUBLIC,
  PDF_DISK_PATH as {{SLUG_UPPER}}_PDF_DISK,
  PDF_SHA256 as {{SLUG_UPPER}}_SHA,
  SCHEMA_VERSION as {{SLUG_UPPER}}_VERSION,
  FORM_SLUG as {{SLUG_UPPER}}_SLUG,
  FORM_NAME as {{SLUG_UPPER}}_NAME,
  FORM_DESCRIPTION_ES as {{SLUG_UPPER}}_DESC,
  FORM_SECTIONS as {{SLUG_UPPER}}_SECTIONS,
  HARDCODED_VALUES as {{SLUG_UPPER}}_HARDCODED,
  REQUIRED_FOR_PRINT as {{SLUG_UPPER}}_REQUIRED,
  FIELD_BY_KEY as {{SLUG_UPPER}}_FIELD_BY_KEY,
  formSchema as {{SLUG_UPPER}}_ZOD_SCHEMA,
  // (Opcionales, sólo si el form los exporta)
  // processForPrint as {{slug}}ProcessForPrint,
} from './{{slug}}-form-schema'
import { build{{Slug}}PrefilledValues } from './{{slug}}-prefill'
```

2. **Definition** (junto a `SAPCR100_DEFINITION`, etc.):

```ts
const {{SLUG_UPPER}}_DEFINITION: AutomatedFormDefinition = {
  slug: {{SLUG_UPPER}}_SLUG,
  formName: {{SLUG_UPPER}}_NAME,
  formDescriptionEs: {{SLUG_UPPER}}_DESC,
  states: ['{{STATE_CODE}}'],   // ej. ['TX']. Vacío [] = multi-estado/federal.
  packetType: 'intake',          // o 'merits'
  pdfPublicPath: {{SLUG_UPPER}}_PDF_PUBLIC,
  pdfDiskPath: {{SLUG_UPPER}}_PDF_DISK,
  pdfSha256: {{SLUG_UPPER}}_SHA,
  schemaVersion: {{SLUG_UPPER}}_VERSION,
  sections: {{SLUG_UPPER}}_SECTIONS as AutomatedFormDefinition['sections'],
  hardcodedValues: {{SLUG_UPPER}}_HARDCODED,
  requiredForPrint: {{SLUG_UPPER}}_REQUIRED,
  fieldByKey: {{SLUG_UPPER}}_FIELD_BY_KEY as AutomatedFormDefinition['fieldByKey'],
  zodSchema: {{SLUG_UPPER}}_ZOD_SCHEMA,
  buildPrefilledValues: async (caseId, service) => {
    const raw = await build{{Slug}}PrefilledValues(caseId, service)
    const out: Record<string, string | boolean | null | undefined> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (v === null || v === undefined || typeof v === 'string' || typeof v === 'boolean') out[k] = v
    }
    return out
  },
  detectByName: (name) => {
    const n = name.toLowerCase()
    return n.includes('{{slug-token-1}}') || n.includes('{{nombre legible}}')
  },
  // (Opcionales)
  // processForPrint: {{slug}}ProcessForPrint,
  // computeLegalWarnings: async (caseId, service) => [...],
}
```

3. **Map público** — añade tu slug al final:

```ts
export const AUTOMATED_FORMS: Record<string, AutomatedFormDefinition> = {
  [SAPCR100_SLUG]: SAPCR100_DEFINITION,
  [SAPCR_AFF_100_SLUG]: SAPCR_AFF_100_DEFINITION,
  [PR_GEN_116_SLUG]: PR_GEN_116_DEFINITION,
  [{{SLUG_UPPER}}_SLUG]: {{SLUG_UPPER}}_DEFINITION,
}
```

> ✅ **Hecho. Sin tocar UI ni endpoints.** En este momento el formulario ya está integrado: aparece en `getRegisteredSlugCatalogMarkdown()` (que la IA de research lee), `resolveAutomatedFormSlug` lo detecta por nombre, y `getInjectedFormsForState` lo inyecta en casos del estado correspondiente.

### 3.7 Tests offline e integración

Crea `repo/scripts/test-{{slug}}-fill.mjs` copiando `scripts/test-pr-gen-116-fill.mjs`. Sustituye:
- `EXPECTED_SHA` con el hash del paso 3.3.
- `FIELD_MAP` con los 5-10 campos críticos (semanticKey → pdfFieldName).
- `SIMULATED_VALUES` con datos representativos del estado (ej: para TX, datos típicos de Houston).

Ejecuta:
```bash
cd repo && node scripts/test-{{slug}}-fill.mjs
# Esperado: 0 warnings, PDF guardado en scripts/{{slug}}-test-output.pdf
```

(Opcional pero recomendado) Crea `repo/scripts/test-{{slug}}-prefill-integration.mjs` copiando `test-pr-gen-116-prefill-integration.mjs` y cambiando `CASE_ID` a un caso real del estado. Esto confirma que el prefill consolida datos reales de Supabase correctamente.

### 3.8 Typecheck + commit + push

```bash
cd repo
npm run typecheck   # debe pasar limpio

git add public/forms/{{slug}}.pdf public/forms/{{slug}}.original.pdf \
        scripts/normalize-{{slug}}.mjs scripts/inspect-{{slug}}-fields.mjs \
        scripts/{{slug}}-raw-fields.json scripts/test-{{slug}}-fill.mjs \
        src/lib/legal/{{slug}}-form-schema.ts src/lib/legal/{{slug}}-prefill.ts \
        src/lib/legal/automated-forms-registry.ts

git commit -m "feat(legal): automatización del formulario {{SLUG_UPPER}} (estado {{STATE}})"
git push origin master
```

### 3.9 Verificación E2E en producción

1. Espera ~60-90s al deploy de Vercel.
2. Login admin en `https://app.usalatinoprime.com/login`.
3. Navega a un caso del estado correspondiente: `/admin/cases/<case-id>`.
4. Abre el tab donde vive `JurisdictionPanel` (suele ser **Declaraciones**).
5. Expande la card **Jurisdicción detectada**.
6. **Verifica** que en la tarjeta del nuevo form aparecen los 3 botones: ↓ Descargar oficial · ✏ Abrir formulario · 🖨 Imprimir.
7. Click **Abrir formulario** → modal con datos prefillados.
8. Click **Imprimir oficial** → descarga el PDF rellenado.
9. Verifica en Supabase MCP:
   ```sql
   SELECT * FROM case_form_instances WHERE case_id = '<id>' AND form_name = '<FORM_NAME>';
   SELECT * FROM documents WHERE case_id = '<id>' AND document_key = '{{slug}}_filled';
   SELECT * FROM case_activity WHERE case_id = '<id>' AND action = '{{slug}}_pdf_generated';
   ```

---

## 4. Patrones avanzados

### 4.1 Campos virtuales (dropdown que mapea a checkbox)

**Problema**: el PDF tiene 80 checkboxes mutuamente exclusivos (ej: tipo de caso en CCIS) y mostrarlos todos abruma al admin.

**Solución**: definir un field virtual de tipo `'select'` con `pdfFieldName: null` que el admin elige, y traducir al checkbox AcroForm real con `processForPrint`.

```ts
// En el schema
{ semanticKey: 'case_type', pdfFieldName: null, type: 'select',
  required: true, hardcoded: 'family_law__parent_child__custody_or_visitation',
  options: [
    { value: 'family_law__parent_child__custody_or_visitation', labelEs: 'Family Law → Custody (típico SIJS)' },
    { value: 'family_law__parent_child__termination_of_parental_rights', labelEs: '... TPR ...' },
    { value: '__show_all__', labelEs: '— Mostrar las 80 categorías —' },
  ],
}

// Los 80 checkboxes individuales con hiddenByDefault: true (sólo se muestran cuando case_type === '__show_all__')
{ semanticKey: 'case_type_cb_family_law__parent_child__custody_or_visitation',
  pdfFieldName: 'Custody or Visitation', type: 'checkbox',
  labelEs: 'Family Law → ... → Custody', hiddenByDefault: true }

// Y exporta processForPrint para resolver el virtual al checkbox real:
export function processForPrint(values) {
  const out = { ...values }
  const ct = values.case_type
  if (typeof ct === 'string' && ct !== '__show_all__') {
    out[`case_type_cb_${ct}`] = true
  }
  return out
}
```

Luego en el registry, asignar `processForPrint: nuestraFn`. Ejemplo completo: `pr-gen-116-form-schema.ts:165-256`.

### 4.2 `computeLegalWarnings` (banner amarillo contextual)

Útil cuando el form sólo aplica bajo ciertas condiciones legales. Ejemplo: SAPCR-AFF-100 es exclusivo para no-padres bajo TFC §102.0031.

```ts
// En el registry
computeLegalWarnings: async (caseId, service) => {
  const { data } = await service.from('case_form_submissions')
    .select('form_data').eq('case_id', caseId).eq('form_type', 'tutor_guardian').maybeSingle()
  const rel = String(data?.form_data?.relationship_to_minor ?? '').toLowerCase()
  if (rel.includes('madre') || rel.includes('padre')) {
    return ['Por TFC §102.0031, este afidávit es exclusivo para no-padres. La peticionaria está registrada como madre/padre biológico.']
  }
  return []
}
```

Cada string se renderiza como banner amarillo en el header del modal. Ejemplo real en `sapcr-aff-100-prefill.ts:200-222`.

### 4.3 `hiddenByDefault` con sentinela `__show_all__`

Definí un field tipo `'select'` con un option `value: '__show_all__'`. Cuando el admin lo elige, todos los fields con `hiddenByDefault: true` aparecen. Sirve para UIs progresivas: opción rápida arriba + opciones avanzadas a demanda.

El modal genérico (`automated-form-modal.tsx:182-220`) ya implementa el filtro:

```ts
const showHiddenFields = useMemo(() => {
  for (const section of data.schemaSections) {
    for (const f of section.fields) {
      if (f.type === 'select' && values[f.semanticKey] === '__show_all__') return true
    }
  }
  return false
}, [data, values])
```

No requiere código adicional al automatizar — sólo declarar `hiddenByDefault: true` en los fields que correspondan.

### 4.4 Reuso entre forms del mismo caso

Cuando un form B depende de datos que el cliente o admin ya rellenó en form A del mismo caso, lee `case_form_instances.filled_values` de A en el data bag de B.

Ventajas:
- Evita re-pedir el nombre del menor, dirección de la peticionaria, etc.
- Mantiene consistencia visual entre forms del mismo paquete.

Ejemplo: `pr-gen-116-prefill.ts:121-163` lee `petitioner_mailing_address` del SAPCR-100 si el profile está vacío, y parsea el formato libre con regex para separar street/city/state/zip.

---

## 5. Tabla de decisión

| Síntoma / requisito | Acción |
|---|---|
| El PDF inspeccionado dice `Total fields: 0` y hay errores de `Invalid object ref` | Aplica §3.2 (normalize con mupdf) |
| Un field tiene `MaxLen` pequeño y los valores hispanos no caben | Nada — `acroform-service.ts:120` ya lo quita automáticamente |
| El form tiene 50+ checkboxes mutuamente exclusivos | Aplica §4.1 (campo virtual `'select'` + `processForPrint`) |
| El form sólo aplica bajo cierta condición legal | Aplica §4.2 (`computeLegalWarnings`) |
| El form tiene 2-3 niveles de detalle (común vs. avanzado) | Aplica §4.3 (`hiddenByDefault` + sentinela `__show_all__`) |
| El form depende de datos de otro form ya rellenado | Aplica §4.4 (cross-form data bag) |
| El form aplica a múltiples estados o es federal (USCIS) | Usa `states: []` (interpretado como multi-estado) |
| El form tiene firma digital obligatoria | NO soportado hoy. La firma se hace a mano sobre la copia impresa. Si el cliente lo necesita, abrir issue. |

---

## 6. Garantías de escalabilidad

### 6.1 Garantía A — clientes del mismo estado, casos cacheados ANTES de la automatización

> Cuando registras un nuevo form con `states: ['TX']`, **todos los casos TX en `case_jurisdictions` (incluyendo los investigados meses atrás) muestran los botones la próxima vez que el frontend cargue su jurisdicción**. No hay SQL backfill, no hay re-research costoso, no hay intervención manual.

**Mecanismo**: el endpoint `/api/admin/case-jurisdiction` (GET y POST) llama `enrichWithRegistryForms` antes de devolver el row. Esa función invoca `getInjectedFormsForState(stateCode, packetType)` que sintetiza `RequiredForm[]` desde el registry, y `mergeWithInjectedForms` los appendea a la lista cacheada (sin duplicar si ya están).

**Validado en producción**: el caso `2f42535a-…` de Ana Martinez (Tarrant County, TX, ZIP 76010) — investigado antes de PR-GEN-116 — empezó a mostrar la tarjeta del CCIS automáticamente tras el deploy del commit `1c17c7c`, sin tocar su BD.

### 6.2 Garantía B — clientes de OTROS estados, formularios futuros

> Cuando registras un form para un estado nuevo (ej: `states: ['CA']` para `ca-gc-210`), **los casos CA reciben automáticamente los botones de su form**, mientras los casos TX siguen recibiendo los suyos. Las definiciones del registry son por-estado y no se cruzan.

**Mecanismo**: `getInjectedFormsForState` filtra `Object.values(AUTOMATED_FORMS)` por `def.states.includes(upper)`. Cada caso recibe sólo los forms que aplican a su estado.

**Edge case multi-estado / federal**: para forms USCIS o cross-state, declarar `states: []`. La función trata array vacío como "multi-estado" y los inyecta a todos los casos.

**Aprendizaje de la IA de research**: el catálogo dinámico `getRegisteredSlugCatalogMarkdown()` se inyecta en cada call a `runJurisdictionResearchSync`. La IA lee la tabla actualizada y empieza a etiquetar el slug nativamente en investigaciones futuras del mismo estado. No hay que tocar el system prompt manualmente.

### 6.3 Resumen de las 3 garantías combinadas

| Caso del cliente | Cuando se añade un form | Resultado |
|---|---|---|
| Estado matchea, jurisdicción cacheada CON el form (sin slug) | (B) detección por nombre | ✓ Botones aparecen |
| Estado matchea, jurisdicción cacheada SIN el form | (C) injection runtime | ✓ Botones aparecen |
| Estado matchea, jurisdicción NUEVA (post-deploy) | (A) slug nativo de la IA | ✓ Botones aparecen |
| Estado NO matchea | — | ✓ Sin botones (correcto) |

---

## 7. Catálogo actual

| Slug | Estado | Packet | Tipo | Form | Notas |
|---|---|---|---|---|---|
| `tx-fm-sapcr-100` | TX | merits | acroform | Petición SAPCR (filed by parent) | Patrón base, 7 secciones, ~120 fields |
| `tx-fm-sapcr-aff-100` | TX | merits | acroform | Affidavit of Standing of Nonparent | Incluye `computeLegalWarnings` para no-padres |
| `tx-pr-gen-116` | TX | intake | acroform | Civil Case Information Sheet | Incluye campo virtual `case_type` + `processForPrint`, `hiddenByDefault` con `__show_all__`, normalize requerido |
| `tx-dfps-sij-findings-motion` | TX | merits | docx-template | DFPS Section 13 Motion for SIJ Findings | Primer template DOCX. Tokens `{{key}}` pre-inyectados con `tokenize-motion-sij-findings.mjs`. Reusa data bag del SAPCR-100 |

### 7.1 Templates DOCX vs AcroForms — cuándo usar cada uno

| Característica | AcroForm (PDF) | DOCX template |
|---|---|---|
| Origen del documento oficial | PDF con form fields ya definidos por la corte/agencia | DOCX narrativo de DFPS / agencias estatales |
| Detección de fields | `pdf-lib.getForm().getFields()` | Tokens `{{key}}` que YO inyecto en pre-procesamiento |
| Schema | `pdfFieldName` = nombre real del field AcroForm | `pdfFieldName` = nombre del token (sin las `{{}}`). Si null, el `semanticKey` se usa como token |
| Llenado | `fillAcroForm` con flatten | `fillDocxTemplate` con find-replace en `document.xml` + headers/footers |
| Output | PDF aplanado (no editable) | DOCX rellenado (editable a mano si el abogado quiere ajustar la prosa) |
| Content-Type del download | `application/pdf` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `templateType` en registry | `'acroform'` (default) o omitir | `'docx-template'` (obligatorio) |

**Regla de decisión**: si el documento oficial es un **PDF con AcroForms estructurados** (cualquier form de TexasLawHelp, USCIS, etc.), usa **acroform**. Si es un **template narrativo en Word** (DFPS Section 13, plantillas de motion), usa **docx-template**.

### 7.2 Tokenizado de un .docx (paso adicional sólo para `docx-template`)

Antes de poder usar `fillDocxTemplate`, el .docx oficial debe pre-procesarse para reemplazar sus placeholders nativos (`[NAME]`, `[DATE]`, `[COUNTRY]`, `_____`, etc.) con tokens `{{semanticKey}}` que el runtime entiende.

Patrón: `scripts/tokenize-motion-sij-findings.mjs` — define una lista de pares `[texto-original, texto-tokenizado]` y los aplica al `word/document.xml` del .docx.

```bash
# 1. Coloca el .docx oficial como `<slug>.original.docx` en public/forms/
cp /path/to/official.docx repo/public/forms/<slug>.original.docx

# 2. Crea repo/scripts/tokenize-<slug>.mjs copiando tokenize-motion-sij-findings.mjs
#    Cambia INPUT/OUTPUT y la lista REPLACEMENTS según tu form

# 3. Ejecuta — genera <slug>.docx tokenizado y emite SHA-256
node scripts/tokenize-<slug>.mjs

# 4. Hardcodea el SHA-256 en `<slug>-form-schema.ts` (PDF_SHA256)
```

**Fragmentación de runs en OOXML**: Word a veces parte un texto en múltiples `<w:r>` runs (ej. `[NAME]` puede ser `<w:r><w:t>[</w:t></w:r><w:r><w:t>NAME</w:t></w:r><w:r><w:t>]</w:t></w:r>`). Antes de tokenizar, verifica con `grep -oE "<w:t[^>]*>[^<]*PLACEHOLDER[^<]*</w:t>" word/document.xml`. Si el placeholder aparece completo en un solo `<w:t>`, el reemplazo string es directo. Si está fragmentado, abre el .docx en Word, edítalo levemente (cambia un espacio) y re-guarda — Word consolida los runs.

### 7.3 Diferencias en el schema cuando es `docx-template`

```ts
// AcroForm
{ semanticKey: 'petitioner_name', pdfFieldName: 'Name', type: 'text', /* ... */ }
//                                ^^^^^^^^^^^^^^^^^^^ nombre EXACTO del AcroForm field

// DOCX template
{ semanticKey: 'petitioner_name', pdfFieldName: 'petitioner_name', type: 'text', /* ... */ }
//                                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ nombre del token
//                                                                  (el {{...}} se omite)
// O equivalente (más conciso):
{ semanticKey: 'petitioner_name', pdfFieldName: null, type: 'text', /* ... */ }
//                                ^^^^^^^^^^^^^^^^^^^^^ null = usar semanticKey como token
```

`processForPrint`, `hiddenByDefault`, y otros patrones avanzados funcionan igual con `docx-template`. La única diferencia es el motor de fill.

Ejemplos vivos para inspirar la próxima automatización:
- **Más simple**: `sapcr-aff-100-form-schema.ts` — sin processForPrint, sin hiddenByDefault, secciones lineales.
- **Más completo**: `pr-gen-116-form-schema.ts` — todos los patrones avanzados.

---

## 8. Troubleshooting

| Síntoma | Diagnóstico | Fix |
|---|---|---|
| `Total fields: 0` al inspeccionar el PDF | PDF con object streams comprimidos | §3.2 normalize con mupdf |
| Nombres de fields aparecen como bytes binarios | PDF con encryption residual tras normalize | Confirma `decrypt=yes,encryption=none` y `getTrailer().delete('Encrypt')` en el script normalize |
| `npm run typecheck` falla en `automated-forms-registry.ts` | Tipos de `sections`/`fieldByKey` del schema nuevo no extienden los originales | Cast con `as AutomatedFormDefinition['sections']` (ver PR_GEN_116_DEFINITION:226) |
| `/print` responde 500 con `PDF SHA mismatch` | Texas/.gov publicó nueva revisión | Re-corre `inspect`, actualiza `PDF_SHA256` en el schema, re-mapea cualquier `pdfFieldName` que haya cambiado |
| Botones NO aparecen en producción para un caso del estado correcto | Browser cache | Hard refresh. El injection runtime es server-side, no requiere cache busting de cliente |
| Botones aparecen pero el modal queda en spinner | Endpoint `/api/admin/case-forms/{{slug}}` 500 | Revisa runtime logs en Vercel. Causa común: error en `buildPrefilledValues` (campo missing en BD que se asume) |
| Modal carga pero campos críticos vacíos | El `deriveFrom` del schema no matchea el shape del data bag | Logea el bag, confirma path con `get(bag, 'petitioner.full_name')` manual |
| PDF impreso tiene campos vacíos donde sí había datos | El `pdfFieldName` no matchea el nombre real del AcroForm | Revisa el JSON del paso 3.3 — los nombres son case-sensitive, espacios cuentan |
| El admin marcó un campo virtual y al imprimir NO se reflejó en el PDF | `processForPrint` no se asignó en el registry, o el mapeo `case_type_cb_X` no existe en el schema | Verifica que `processForPrint: nuestraFn` esté en el `*_DEFINITION` y el checkbox tenga `pdfFieldName` correcto |
| Casos cacheados no muestran botones tras el deploy | Cliente apuntando a un deploy viejo | Verifica `X-Vercel-Id` en headers; espera ~60s post-push |

---

## 9. Apéndice: comandos rápidos

### Inspeccionar un PDF en disco (one-liner sin script)

```bash
cd repo && node -e "
const { PDFDocument } = require('pdf-lib');
const fs = require('node:fs');
const bytes = fs.readFileSync('public/forms/{{slug}}.pdf');
PDFDocument.load(bytes, { ignoreEncryption: true }).then(doc => {
  const fields = doc.getForm().getFields();
  console.log('Total:', fields.length);
  fields.slice(0, 20).forEach(f => console.log(f.constructor.name, '-', f.getName()));
});
"
```

### Probar prefill contra Supabase real

Crea `scripts/test-{{slug}}-prefill-integration.mjs` (template: `test-pr-gen-116-prefill-integration.mjs`). Lee `.env.local`, instancia el cliente Supabase con SERVICE_ROLE_KEY, llama tu prefill con un caseId real y muestra los valores derivados.

### Ver el catálogo de slugs que la IA ve

```bash
cd repo && node -e "
import('./src/lib/legal/automated-forms-registry.ts').then(m =>
  console.log(m.getRegisteredSlugCatalogMarkdown())
)
"
```

(Funciona si tu `package.json` tiene `"type": "module"` — si no, usa tsx).

---

## 10. Mantenimiento de esta guía

- **Cuando añadas una capacidad nueva al sistema** (no un form, sino una feature del registry, modal, o endpoint), actualiza la sección correspondiente y añade una entrada al troubleshooting si encontraste un problema digno de mencionar.
- **Cuando automatices un form nuevo**, añade su entry a la tabla de §7.
- **Cuando un patrón cambie** (ej: nueva forma de hacer prefill, nuevo tipo de field), actualiza el ejemplo y la plantilla de §3 / §4.

La guía vive en el repo (`docs/automated-forms-guide.md`) y debe estar siempre alineada con el código de `automated-forms-registry.ts`. El header del registry remite a este documento; mantén esa referencia viva.

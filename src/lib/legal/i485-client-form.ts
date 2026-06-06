// ──────────────────────────────────────────────────────────────────────────
// CAPA DE PRESENTACIÓN AL CLIENTE — USCIS Form I-485
// ──────────────────────────────────────────────────────────────────────────
//
// POR QUÉ EXISTE ESTE ARCHIVO
//
// `i485-form-schema.ts` es un artefacto AUTO-GENERADO desde el acroform del PDF.
// Es fiel al PDF (semanticKey ↔ pdfFieldName ↔ checkboxOnValue) y por eso sirve
// para PRELLENAR y para LLENAR el PDF — pero NO sirve como experiencia humana:
// sus labels son crudos ("pt1line10_passportnum"), sus secciones están mal
// tituladas (agrupó por el prefijo interno Pt#, no por la "Part" real del
// formulario) y modela cada Sí/No como dos checkboxes sueltos.
//
// Este archivo es la ÚNICA fuente de verdad de lo que VE y EDITA el cliente:
// preguntas en español simple, en el orden correcto, agrupadas con títulos
// reales (tomados del tooltip oficial /TU de cada campo del PDF), con radios
// para Sí/No y opciones traducidas. Las secciones concretas viven en
// `./i485-sections/*` (curadas a partir de scripts/i485-tooltips.json) y se
// componen aquí. Cada campo referencia el PDF por su `key` (semanticKey).
//
// El llenado del PDF y el prefill siguen usando el schema técnico. Los campos
// "virtuales" (radios Sí/No, sexo, estado civil, etc. — `key` con prefijo `v_`)
// no existen en el PDF: los traduce a checkboxes reales `i485-print-transform.ts`
// en el momento de imprimir.
//
// Patrón reutilizable: cualquier formulario grande del registro puede exponer
// su propia capa `clientForm` (ver `AutomatedFormDefinition.clientForm`).

import { FIELD_BY_KEY, type FieldType as SchemaFieldType } from './i485-form-schema'
import { PERSONAL_SECTIONS } from './i485-sections/personal'
import { FAMILY_SECTIONS } from './i485-sections/family'
import { LEGAL_SECTIONS } from './i485-sections/legal'

// El cliente ve los mismos tipos que el FormRunner sabe renderizar. Incluye
// 'radio' (el FormRunner ya lo soporta) aunque el schema técnico no lo use.
export type ClientFieldType = SchemaFieldType | 'radio'

export interface CuratedFieldDependsOn {
  /** key (real o virtual) de la que depende la visibilidad de este campo. */
  key: string
  /** Se muestra solo si el valor de `key` es uno de estos. */
  equals: string | string[]
}

export interface CuratedOption {
  value: string
  labelEs: string
}

export interface CuratedField {
  /**
   * semanticKey del schema técnico (mapea a un campo real del PDF) O una key
   * virtual con prefijo `v_` (control de presentación que `i485-print-transform`
   * traduce a checkboxes reales al imprimir).
   */
  key: string
  /** Texto claro en español que ve el cliente. Obligatorio (nunca crudo). */
  labelEs: string
  /** Ayuda contextual opcional, en español simple. */
  helpEs?: string
  /**
   * Tipo de control. Para keys reales se hereda del schema si se omite.
   * Para keys virtuales es obligatorio declararlo.
   */
  type?: ClientFieldType
  required?: boolean
  /** Agrupa campos en una caja visual. La metadata del grupo vive en la sección. */
  groupKey?: string
  /** Opciones para radio/select. Para keys reales, hereda las del schema si se omite. */
  options?: CuratedOption[]
  maxLength?: number
  defaultValue?: string | boolean
  dependsOn?: CuratedFieldDependsOn
  /**
   * Solo para keys virtuales (`v_*`): mapea cada valor de opción al semanticKey
   * del checkbox REAL del PDF que debe marcarse. Lo consume `i485-print-transform`
   * al imprimir. Ejemplo (sexo): `{ F: 'pt1line6_cb_sex', M: 'pt1line6_cb_sex_1' }`.
   * Mantener el mapeo junto al campo evita una tabla paralela desincronizada.
   */
  real?: Record<string, string>
}

export interface CuratedGroup {
  title: string
  description?: string
  tone?: 'plain' | 'critical'
}

export interface CuratedSection {
  id: number
  titleEs: string
  descriptionEs: string
  /** Metadata de cada groupKey usado por los campos de esta sección. */
  groups?: Record<string, CuratedGroup>
  fields: CuratedField[]
}

/** Shape resuelto que consume el route handler (idéntico a su `ClientField`). */
export interface ResolvedClientField {
  semanticKey: string
  type: ClientFieldType
  labelEs: string
  helpEs?: string
  required: boolean
  groupKey?: string
  options?: CuratedOption[]
  maxLength?: number
  defaultValue?: string | boolean
  dependsOn?: { semanticKey: string; equals: string | string[] }
}

export function isVirtualKey(key: string): boolean {
  return key.startsWith('v_')
}

/**
 * Mezcla un CuratedField con su FieldSpec técnico (si es real) y produce el
 * shape que el route devuelve al FormRunner. El label/help/orden SIEMPRE vienen
 * de la curación; el type/options/maxLength se heredan del schema si no se
 * sobrescriben.
 */
export function resolveCuratedField(cf: CuratedField): ResolvedClientField {
  const spec = isVirtualKey(cf.key) ? undefined : FIELD_BY_KEY[cf.key]
  const type = cf.type ?? (spec?.type as ClientFieldType | undefined) ?? 'text'
  return {
    semanticKey: cf.key,
    type,
    labelEs: cf.labelEs,
    helpEs: cf.helpEs,
    required: cf.required ?? false,
    groupKey: cf.groupKey,
    options: cf.options ?? spec?.options,
    maxLength: cf.maxLength ?? spec?.maxLength,
    defaultValue: cf.defaultValue,
    dependsOn: cf.dependsOn ? { semanticKey: cf.dependsOn.key, equals: cf.dependsOn.equals } : undefined,
  }
}

/** Todas las keys (reales + virtuales) que el cliente puede editar. Allowlist del PUT. */
export function getClientFormKeys(sections: CuratedSection[]): Set<string> {
  const keys = new Set<string>()
  for (const s of sections) for (const f of s.fields) keys.add(f.key)
  return keys
}

/** Metadata de grupos agregada de todas las secciones, para el FormRunner. */
export function getClientFormGroupMeta(sections: CuratedSection[]): Record<string, CuratedGroup> {
  const meta: Record<string, CuratedGroup> = {}
  for (const s of sections) {
    if (!s.groups) continue
    for (const [k, v] of Object.entries(s.groups)) meta[k] = v
  }
  return meta
}

// ──────────────────────────────────────────────────────────────────────────
// COMPOSICIÓN DE LAS SECCIONES DEL CLIENTE
// ──────────────────────────────────────────────────────────────────────────
//
// Orden que ve el cliente: datos personales → familia/trabajo → preguntas
// legales. Los `id` se renumeran de forma secuencial para garantizar unicidad
// (cada módulo usa ids locales que podrían chocar entre sí).

export const I485_CLIENT_FORM: CuratedSection[] = [
  ...PERSONAL_SECTIONS,
  ...FAMILY_SECTIONS,
  ...LEGAL_SECTIONS,
].map((section, index) => ({ ...section, id: index + 1 }))

// ──────────────────────────────────────────────────────────────────────────
// VERIFICACIÓN DE INTEGRIDAD (corre al importar el módulo → rompe el build)
// ──────────────────────────────────────────────────────────────────────────
//
// Si una regeneración del schema (nueva edición del PDF de USCIS) elimina o
// renombra un semanticKey que esta capa referencia, queremos enterarnos de
// inmediato y de forma RUIDOSA, no que el cliente vea un formulario roto.

export function validateI485ClientForm(): string[] {
  const orphans: string[] = []
  for (const section of I485_CLIENT_FORM) {
    for (const field of section.fields) {
      // La key real (no virtual) debe existir en el schema.
      if (!isVirtualKey(field.key) && !(field.key in FIELD_BY_KEY)) {
        orphans.push(field.key)
      }
      // Todo semanticKey real referenciado por `real` (destino del print) también.
      if (field.real) {
        for (const realKey of Object.values(field.real)) {
          if (!(realKey in FIELD_BY_KEY)) orphans.push(`${field.key}→${realKey}`)
        }
      }
    }
  }
  return orphans
}

const _orphans = validateI485ClientForm()
if (_orphans.length > 0) {
  throw new Error(
    `[i485-client-form] semanticKeys inexistentes en i485-form-schema.ts ` +
      `(¿se regeneró el schema con una nueva edición del PDF?): ${_orphans.join(', ')}`,
  )
}

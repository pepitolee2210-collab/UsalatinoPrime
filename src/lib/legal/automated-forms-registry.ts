// Registry escalable de formularios oficiales con automatización completa
// (formulario interactivo + prefill desde BD + generación PDF rellenado).
//
// Para añadir un nuevo formulario:
//   1. Crear repo/public/forms/<slug>.pdf
//   2. Correr `node scripts/inspect-<form>-fields.mjs` para descubrir
//      pdfFieldName + sha256
//   3. Crear repo/src/lib/legal/<slug>-form-schema.ts con SAPCR_SECTIONS,
//      HARDCODED_VALUES, REQUIRED_FOR_PRINT, sapcrFormSchema
//   4. Crear repo/src/lib/legal/<slug>-prefill.ts con buildPrefilledValues
//   5. Añadir entry aquí en AUTOMATED_FORMS
//   6. Actualizar el prompt de research-jurisdiction.ts para incluir el slug
//   7. (Opcional) backfill SQL de slug en case_jurisdictions filas existentes
//
// La UI (jurisdiction-panel.tsx) y las API routes (/api/admin/case-forms/[slug])
// no requieren cambio adicional — leen directamente desde este registry.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'

import {
  PDF_PUBLIC_PATH as SAPCR100_PDF_PUBLIC,
  PDF_DISK_PATH as SAPCR100_PDF_DISK,
  PDF_SHA256 as SAPCR100_SHA,
  SAPCR_VERSION as SAPCR100_VERSION,
  FORM_SLUG as SAPCR100_SLUG,
  FORM_NAME as SAPCR100_NAME,
  FORM_DESCRIPTION_ES as SAPCR100_DESC,
  SAPCR_SECTIONS as SAPCR100_SECTIONS,
  HARDCODED_SIJS_VALUES as SAPCR100_HARDCODED,
  REQUIRED_FOR_PRINT as SAPCR100_REQUIRED,
  FIELD_BY_KEY as SAPCR100_FIELD_BY_KEY,
  sapcrFormSchema as SAPCR100_ZOD_SCHEMA,
  type SapcrSection,
  type FieldSpec,
} from './sapcr100-form-schema'
import { buildSapcrPrefilledValues } from './sapcr100-prefill'

import {
  PDF_PUBLIC_PATH as SAPCR_AFF_100_PDF_PUBLIC,
  PDF_DISK_PATH as SAPCR_AFF_100_PDF_DISK,
  PDF_SHA256 as SAPCR_AFF_100_SHA,
  SAPCR_AFF_VERSION as SAPCR_AFF_100_VERSION,
  FORM_SLUG as SAPCR_AFF_100_SLUG,
  FORM_NAME as SAPCR_AFF_100_NAME,
  FORM_DESCRIPTION_ES as SAPCR_AFF_100_DESC,
  SAPCR_AFF_SECTIONS as SAPCR_AFF_100_SECTIONS,
  HARDCODED_VALUES as SAPCR_AFF_100_HARDCODED,
  REQUIRED_FOR_PRINT as SAPCR_AFF_100_REQUIRED,
  FIELD_BY_KEY as SAPCR_AFF_100_FIELD_BY_KEY,
  sapcrAffFormSchema as SAPCR_AFF_100_ZOD_SCHEMA,
} from './sapcr-aff-100-form-schema'
import {
  buildSapcrAffPrefilledValues,
  isPetitionerBiologicalParent,
} from './sapcr-aff-100-prefill'

// ──────────────────────────────────────────────────────────────────
// Tipos públicos del registry
// ──────────────────────────────────────────────────────────────────

export interface AutomatedFormDefinition {
  /** Slug estable usado en URLs y en el campo `slug` de RequiredForm. */
  slug: string
  /** Nombre del form para fila en `case_form_instances` (UNIQUE constraint). */
  formName: string
  /** Descripción corta en español. */
  formDescriptionEs: string
  /** Estado(s) US donde aplica este form (ej. ['TX'] para SAPCR-100). */
  states: string[]
  /** packet_type para `case_form_instances`: 'intake' | 'merits'. */
  packetType: 'intake' | 'merits'
  /** Path público del PDF (servido por Next.js desde `public/`). */
  pdfPublicPath: string
  /** Path en disco (relativo a process.cwd()) para fs.readFile en API routes. */
  pdfDiskPath: string
  /** SHA-256 del archivo, hardcoded para detectar updates de Texas/.gov. */
  pdfSha256: string
  /** Versión del schema (ej. '2025-09-legis-update'). */
  schemaVersion: string
  /** Secciones renderizadas en el modal (~7 típicamente). */
  sections: SapcrSection[]
  /** Valores universales hardcoded (siempre aplicados antes de prefill+saved). */
  hardcodedValues: Record<string, string | boolean>
  /** Lista de semanticKeys obligatorias para que el botón Imprimir se habilite. */
  requiredForPrint: string[]
  /** Map flat para acceso O(1) a FieldSpec por semanticKey. */
  fieldByKey: Record<string, FieldSpec>
  /** Zod schema para validar PUT del cliente. */
  zodSchema: z.ZodObject<z.ZodRawShape>
  /** Builder de prefill desde BD del caso. */
  buildPrefilledValues: (caseId: string, service: SupabaseClient) => Promise<Record<string, string | boolean | undefined | null>>
  /** Heurística de detección por nombre de form para casos legacy sin slug. */
  detectByName: (name: string) => boolean
  /**
   * Opcional: calcula advertencias legales que la API/UI deben mostrar para
   * este form. Por ejemplo, si la peticionaria es la madre/padre biológico
   * y este form es exclusivo para no-padres. Retornar [] si no aplica.
   *
   * Cada string se renderiza como banner amarillo en el header del modal.
   */
  computeLegalWarnings?: (caseId: string, service: SupabaseClient) => Promise<string[]>
}

// ──────────────────────────────────────────────────────────────────
// Entradas del registry
// ──────────────────────────────────────────────────────────────────

const SAPCR100_DEFINITION: AutomatedFormDefinition = {
  slug: SAPCR100_SLUG,
  formName: SAPCR100_NAME,
  formDescriptionEs: SAPCR100_DESC,
  states: ['TX'],
  packetType: 'merits',
  pdfPublicPath: SAPCR100_PDF_PUBLIC,
  pdfDiskPath: SAPCR100_PDF_DISK,
  pdfSha256: SAPCR100_SHA,
  schemaVersion: SAPCR100_VERSION,
  sections: SAPCR100_SECTIONS,
  hardcodedValues: SAPCR100_HARDCODED,
  requiredForPrint: SAPCR100_REQUIRED,
  fieldByKey: SAPCR100_FIELD_BY_KEY,
  zodSchema: SAPCR100_ZOD_SCHEMA,
  buildPrefilledValues: async (caseId, service) => {
    const raw = await buildSapcrPrefilledValues(caseId, service)
    const out: Record<string, string | boolean | null | undefined> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (v === null || v === undefined || typeof v === 'string' || typeof v === 'boolean') {
        out[k] = v
      }
    }
    return out
  },
  detectByName: (name) => {
    const n = name.toLowerCase()
    return (
      n.includes('fm-sapcr-100') ||
      (n.includes('sapcr') && n.includes('petition')) ||
      (n.includes('suit') && n.includes('parent-child') && n.includes('petition'))
    )
  },
}

const SAPCR_AFF_100_DEFINITION: AutomatedFormDefinition = {
  slug: SAPCR_AFF_100_SLUG,
  formName: SAPCR_AFF_100_NAME,
  formDescriptionEs: SAPCR_AFF_100_DESC,
  states: ['TX'],
  packetType: 'merits',
  pdfPublicPath: SAPCR_AFF_100_PDF_PUBLIC,
  pdfDiskPath: SAPCR_AFF_100_PDF_DISK,
  pdfSha256: SAPCR_AFF_100_SHA,
  schemaVersion: SAPCR_AFF_100_VERSION,
  sections: SAPCR_AFF_100_SECTIONS,
  hardcodedValues: SAPCR_AFF_100_HARDCODED,
  requiredForPrint: SAPCR_AFF_100_REQUIRED,
  fieldByKey: SAPCR_AFF_100_FIELD_BY_KEY,
  zodSchema: SAPCR_AFF_100_ZOD_SCHEMA,
  buildPrefilledValues: async (caseId, service) => {
    const raw = await buildSapcrAffPrefilledValues(caseId, service)
    const out: Record<string, string | boolean | null | undefined> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (v === null || v === undefined || typeof v === 'string' || typeof v === 'boolean') {
        out[k] = v
      }
    }
    return out
  },
  detectByName: (name) => {
    const n = name.toLowerCase()
    return (
      n.includes('fm-sapcr-aff-100') ||
      (n.includes('affidavit') && n.includes('standing') && n.includes('nonparent'))
    )
  },
  computeLegalWarnings: async (caseId, service) => {
    const isBio = await isPetitionerBiologicalParent(caseId, service)
    if (!isBio) return []
    return [
      'Por TFC §102.0031, este afidávit es exclusivo para no-padres (abuelos, tíos, cuidadores 6+ meses). La peticionaria está registrada como madre/padre biológico en el intake. Si es correcto, considera removerlo de la jurisdicción y radicar la FM-SAPCR-100 directamente bajo §102.003(a)(1). Si el equipo legal confirmó que aplica, ignora este aviso.',
    ]
  },
}

// ──────────────────────────────────────────────────────────────────
// Map público
// ──────────────────────────────────────────────────────────────────

/**
 * Map slug → AutomatedFormDefinition. Cualquier código que necesite saber
 * "¿este form tiene formulario interactivo?" debe consultar este registry.
 */
export const AUTOMATED_FORMS: Record<string, AutomatedFormDefinition> = {
  [SAPCR100_SLUG]: SAPCR100_DEFINITION,
  [SAPCR_AFF_100_SLUG]: SAPCR_AFF_100_DEFINITION,
}

/** Slugs registrados (para validación en rutas dinámicas). */
export const REGISTERED_SLUGS = Object.keys(AUTOMATED_FORMS)

/**
 * Dado un objeto RequiredForm (con `name` y opcional `slug`), determina si
 * tiene formulario interactivo. Retorna el slug que se usará para activar
 * los botones, o null si no hay automatización para este form.
 *
 * Lógica:
 *   1. Si la fila ya tiene `slug` y existe en el registry → usar ese.
 *   2. Si no, intentar detectar por `name` con cada definition.detectByName.
 *      Esto cubre filas legacy de case_jurisdictions sin slug.
 */
export function resolveAutomatedFormSlug(
  form: { name: string; slug?: string | null }
): string | null {
  if (form.slug && AUTOMATED_FORMS[form.slug]) {
    return form.slug
  }
  for (const [slug, def] of Object.entries(AUTOMATED_FORMS)) {
    if (def.detectByName(form.name)) return slug
  }
  return null
}

/** Helper común para componentes UI: lista de slugs en uso. */
export function isSlugAutomated(slug: string | null | undefined): boolean {
  return !!slug && slug in AUTOMATED_FORMS
}

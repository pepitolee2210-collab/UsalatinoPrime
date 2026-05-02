// Registry escalable de formularios oficiales con automatización completa
// (formulario interactivo + prefill desde BD + generación PDF rellenado).
//
// 📖 GUÍA COMPLETA: docs/automated-forms-guide.md
//
// Resumen de pasos para añadir un formulario (la guía detalla cada uno):
//   1. Colocar el PDF en repo/public/forms/<slug>.pdf
//   2. (Si aplica) Normalizar con mupdf: scripts/normalize-<slug>.mjs
//   3. Inspeccionar fields: scripts/inspect-<slug>-fields.mjs (genera SHA + JSON)
//   4. Crear repo/src/lib/legal/<slug>-form-schema.ts (secciones, hardcoded, Zod)
//   5. Crear repo/src/lib/legal/<slug>-prefill.ts (data bag desde profiles +
//      tutor_guardian + client_story + case_jurisdictions + otros forms)
//   6. Añadir entry abajo en AUTOMATED_FORMS con `states: ['XX']` correcto
//   7. Probar con scripts/test-<slug>-fill.mjs
//   8. Commit + push — el deploy activa los botones automáticamente
//
// Las 3 vías de detección (slug nativo de la IA, detectByName runtime, e
// injection por estado vía getInjectedFormsForState) garantizan que clientes
// existentes y futuros del estado correspondiente reciban la automatización
// sin tocar BD ni re-research.
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

import {
  PDF_PUBLIC_PATH as PR_GEN_116_PDF_PUBLIC,
  PDF_DISK_PATH as PR_GEN_116_PDF_DISK,
  PDF_SHA256 as PR_GEN_116_SHA,
  SCHEMA_VERSION as PR_GEN_116_VERSION,
  FORM_SLUG as PR_GEN_116_SLUG,
  FORM_NAME as PR_GEN_116_NAME,
  FORM_DESCRIPTION_ES as PR_GEN_116_DESC,
  CCIS_SECTIONS as PR_GEN_116_SECTIONS,
  HARDCODED_VALUES as PR_GEN_116_HARDCODED,
  REQUIRED_FOR_PRINT as PR_GEN_116_REQUIRED,
  FIELD_BY_KEY as PR_GEN_116_FIELD_BY_KEY,
  ccisFormSchema as PR_GEN_116_ZOD_SCHEMA,
  processForPrint as prGen116ProcessForPrint,
} from './pr-gen-116-form-schema'
import { buildPrGen116PrefilledValues } from './pr-gen-116-prefill'

import {
  PDF_PUBLIC_PATH as MOTION_SIJ_PDF_PUBLIC,
  PDF_DISK_PATH as MOTION_SIJ_PDF_DISK,
  PDF_SHA256 as MOTION_SIJ_SHA,
  SCHEMA_VERSION as MOTION_SIJ_VERSION,
  FORM_SLUG as MOTION_SIJ_SLUG,
  FORM_NAME as MOTION_SIJ_NAME,
  FORM_DESCRIPTION_ES as MOTION_SIJ_DESC,
  MOTION_SECTIONS as MOTION_SIJ_SECTIONS,
  HARDCODED_VALUES as MOTION_SIJ_HARDCODED,
  REQUIRED_FOR_PRINT as MOTION_SIJ_REQUIRED,
  FIELD_BY_KEY as MOTION_SIJ_FIELD_BY_KEY,
  motionSijFormSchema as MOTION_SIJ_ZOD_SCHEMA,
} from './motion-sij-findings-form-schema'
import { buildMotionSijPrefilledValues } from './motion-sij-findings-prefill'

import {
  PDF_PUBLIC_PATH as AFFIDAVIT_SIJ_PDF_PUBLIC,
  PDF_DISK_PATH as AFFIDAVIT_SIJ_PDF_DISK,
  PDF_SHA256 as AFFIDAVIT_SIJ_SHA,
  SCHEMA_VERSION as AFFIDAVIT_SIJ_VERSION,
  FORM_SLUG as AFFIDAVIT_SIJ_SLUG,
  FORM_NAME as AFFIDAVIT_SIJ_NAME,
  FORM_DESCRIPTION_ES as AFFIDAVIT_SIJ_DESC,
  FORM_SECTIONS as AFFIDAVIT_SIJ_SECTIONS,
  HARDCODED_VALUES as AFFIDAVIT_SIJ_HARDCODED,
  REQUIRED_FOR_PRINT as AFFIDAVIT_SIJ_REQUIRED,
  FIELD_BY_KEY as AFFIDAVIT_SIJ_FIELD_BY_KEY,
  affidavitSijFormSchema as AFFIDAVIT_SIJ_ZOD_SCHEMA,
} from './affidavit-sij-form-schema'
import { buildAffidavitSijPrefilledValues } from './affidavit-sij-prefill'

import {
  PDF_PUBLIC_PATH as ORDER_SIJ_PDF_PUBLIC,
  PDF_DISK_PATH as ORDER_SIJ_PDF_DISK,
  PDF_SHA256 as ORDER_SIJ_SHA,
  SCHEMA_VERSION as ORDER_SIJ_VERSION,
  FORM_SLUG as ORDER_SIJ_SLUG,
  FORM_NAME as ORDER_SIJ_NAME,
  FORM_DESCRIPTION_ES as ORDER_SIJ_DESC,
  FORM_SECTIONS as ORDER_SIJ_SECTIONS,
  HARDCODED_VALUES as ORDER_SIJ_HARDCODED,
  REQUIRED_FOR_PRINT as ORDER_SIJ_REQUIRED,
  FIELD_BY_KEY as ORDER_SIJ_FIELD_BY_KEY,
  orderSijFormSchema as ORDER_SIJ_ZOD_SCHEMA,
} from './order-sij-findings-form-schema'
import { buildOrderSijPrefilledValues } from './order-sij-findings-prefill'

import {
  PDF_PUBLIC_PATH as SAPCR205_PDF_PUBLIC,
  PDF_DISK_PATH as SAPCR205_PDF_DISK,
  PDF_SHA256 as SAPCR205_SHA,
  SCHEMA_VERSION as SAPCR205_VERSION,
  FORM_SLUG as SAPCR205_SLUG,
  FORM_NAME as SAPCR205_NAME,
  FORM_DESCRIPTION_ES as SAPCR205_DESC,
  FORM_SECTIONS as SAPCR205_SECTIONS,
  HARDCODED_VALUES as SAPCR205_HARDCODED,
  REQUIRED_FOR_PRINT as SAPCR205_REQUIRED,
  FIELD_BY_KEY as SAPCR205_FIELD_BY_KEY,
  fmSapcr205FormSchema as SAPCR205_ZOD_SCHEMA,
} from './fm-sapcr-205-form-schema'
import { buildFmSapcr205PrefilledValues } from './fm-sapcr-205-prefill'

import {
  PDF_PUBLIC_PATH as FL_GUARDIAN_PDF_PUBLIC,
  PDF_DISK_PATH as FL_GUARDIAN_PDF_DISK,
  PDF_SHA256 as FL_GUARDIAN_SHA,
  SCHEMA_VERSION as FL_GUARDIAN_VERSION,
  FORM_SLUG as FL_GUARDIAN_SLUG,
  FORM_NAME as FL_GUARDIAN_NAME,
  FORM_DESCRIPTION_ES as FL_GUARDIAN_DESC,
  FORM_SECTIONS as FL_GUARDIAN_SECTIONS,
  HARDCODED_VALUES as FL_GUARDIAN_HARDCODED,
  REQUIRED_FOR_PRINT as FL_GUARDIAN_REQUIRED,
  FIELD_BY_KEY as FL_GUARDIAN_FIELD_BY_KEY,
  flGuardianshipFormSchema as FL_GUARDIAN_ZOD_SCHEMA,
} from './fl-permanent-guardianship-form-schema'
import { buildFlGuardianshipPrefilledValues } from './fl-permanent-guardianship-prefill'

import {
  PDF_PUBLIC_PATH as I485_PDF_PUBLIC,
  PDF_DISK_PATH as I485_PDF_DISK,
  PDF_SHA256 as I485_SHA,
  SCHEMA_VERSION as I485_VERSION,
  FORM_SLUG as I485_SLUG,
  FORM_NAME as I485_NAME,
  FORM_DESCRIPTION_ES as I485_DESC,
  I485_SECTIONS,
  HARDCODED_VALUES as I485_HARDCODED,
  REQUIRED_FOR_PRINT as I485_REQUIRED,
  FIELD_BY_KEY as I485_FIELD_BY_KEY,
  i485FormSchema as I485_ZOD_SCHEMA,
} from './i485-form-schema'
import { buildI485PrefilledValues } from './i485-prefill'

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
  /**
   * Tipo de template del archivo en disco. Determina qué motor de fill se usa
   * en /print y qué Content-Type devuelve la respuesta:
   *  - 'acroform'      → PDF con AcroForms (pdf-lib + fillAcroForm)
   *  - 'docx-template' → DOCX con tokens {{key}} (jszip + fillDocxTemplate)
   * Default 'acroform' por compatibilidad con SAPCR-100, SAPCR-AFF-100, PR-GEN-116.
   */
  templateType?: 'acroform' | 'docx-template'
  /** Path público del archivo (PDF o DOCX) servido por Next.js desde `public/`. */
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
  /**
   * Opcional: transforma los valores efectivos (hardcoded + prefill + saved)
   * antes de que el endpoint /print los mapee a pdfFieldName.
   *
   * Útil para forms con campos virtuales (`pdfFieldName: null`) cuyo valor
   * se traduce a otro field real. Ejemplo: PR-GEN-116 tiene un selector
   * `case_type` (string) que se traduce al checkbox AcroForm correspondiente.
   *
   * Si retorna un objeto, ese reemplaza al `effective`. Mutaciones in-place
   * permitidas pero no recomendadas (mejor copiar).
   */
  processForPrint?: (
    values: Record<string, string | boolean | null | undefined>
  ) => Record<string, string | boolean | null | undefined>
  /**
   * Si false, no aplana (flatten) los campos del PDF antes de devolver.
   * Útil para PDFs grandes donde flatten consume mucha memoria/CPU en serverless
   * (ej: USCIS I-485 con 728 fields y 4.8 MB). Default true.
   */
  flattenPdf?: boolean
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

const PR_GEN_116_DEFINITION: AutomatedFormDefinition = {
  slug: PR_GEN_116_SLUG,
  formName: PR_GEN_116_NAME,
  formDescriptionEs: PR_GEN_116_DESC,
  states: ['TX'],
  packetType: 'intake',
  pdfPublicPath: PR_GEN_116_PDF_PUBLIC,
  pdfDiskPath: PR_GEN_116_PDF_DISK,
  pdfSha256: PR_GEN_116_SHA,
  schemaVersion: PR_GEN_116_VERSION,
  sections: PR_GEN_116_SECTIONS as AutomatedFormDefinition['sections'],
  hardcodedValues: PR_GEN_116_HARDCODED,
  requiredForPrint: PR_GEN_116_REQUIRED,
  fieldByKey: PR_GEN_116_FIELD_BY_KEY as AutomatedFormDefinition['fieldByKey'],
  zodSchema: PR_GEN_116_ZOD_SCHEMA,
  buildPrefilledValues: async (caseId, service) => {
    const raw = await buildPrGen116PrefilledValues(caseId, service)
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
      n.includes('pr-gen-116') ||
      n.includes('pr gen 116') ||
      (n.includes('civil case information sheet') && !n.includes('instructions'))
    )
  },
  processForPrint: prGen116ProcessForPrint,
}

const MOTION_SIJ_DEFINITION: AutomatedFormDefinition = {
  slug: MOTION_SIJ_SLUG,
  formName: MOTION_SIJ_NAME,
  formDescriptionEs: MOTION_SIJ_DESC,
  states: ['TX'],
  packetType: 'merits',
  templateType: 'docx-template',
  pdfPublicPath: MOTION_SIJ_PDF_PUBLIC,
  pdfDiskPath: MOTION_SIJ_PDF_DISK,
  pdfSha256: MOTION_SIJ_SHA,
  schemaVersion: MOTION_SIJ_VERSION,
  sections: MOTION_SIJ_SECTIONS as AutomatedFormDefinition['sections'],
  hardcodedValues: MOTION_SIJ_HARDCODED,
  requiredForPrint: MOTION_SIJ_REQUIRED,
  fieldByKey: MOTION_SIJ_FIELD_BY_KEY as AutomatedFormDefinition['fieldByKey'],
  zodSchema: MOTION_SIJ_ZOD_SCHEMA,
  buildPrefilledValues: async (caseId, service) => {
    const raw = await buildMotionSijPrefilledValues(caseId, service)
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
      n.includes('motion for findings') &&
      (n.includes('sij') || n.includes('special immigrant juvenile'))
    )
  },
}

const AFFIDAVIT_SIJ_DEFINITION: AutomatedFormDefinition = {
  slug: AFFIDAVIT_SIJ_SLUG,
  formName: AFFIDAVIT_SIJ_NAME,
  formDescriptionEs: AFFIDAVIT_SIJ_DESC,
  states: ['TX'],
  packetType: 'merits',
  templateType: 'docx-template',
  pdfPublicPath: AFFIDAVIT_SIJ_PDF_PUBLIC,
  pdfDiskPath: AFFIDAVIT_SIJ_PDF_DISK,
  pdfSha256: AFFIDAVIT_SIJ_SHA,
  schemaVersion: AFFIDAVIT_SIJ_VERSION,
  sections: AFFIDAVIT_SIJ_SECTIONS as AutomatedFormDefinition['sections'],
  hardcodedValues: AFFIDAVIT_SIJ_HARDCODED,
  requiredForPrint: AFFIDAVIT_SIJ_REQUIRED,
  fieldByKey: AFFIDAVIT_SIJ_FIELD_BY_KEY as AutomatedFormDefinition['fieldByKey'],
  zodSchema: AFFIDAVIT_SIJ_ZOD_SCHEMA,
  buildPrefilledValues: async (caseId, service) => {
    const raw = await buildAffidavitSijPrefilledValues(caseId, service)
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
      n.includes('affidavit') &&
      (n.includes('sij') || n.includes('special immigrant juvenile')) &&
      n.includes('support')
    )
  },
}

// ──────────────────────────────────────────────────────────────────
// Map público
// ──────────────────────────────────────────────────────────────────

/**
 * Map slug → AutomatedFormDefinition. Cualquier código que necesite saber
 * "¿este form tiene formulario interactivo?" debe consultar este registry.
 */
const ORDER_SIJ_DEFINITION: AutomatedFormDefinition = {
  slug: ORDER_SIJ_SLUG,
  formName: ORDER_SIJ_NAME,
  formDescriptionEs: ORDER_SIJ_DESC,
  states: ['TX'],
  packetType: 'merits',
  templateType: 'docx-template',
  pdfPublicPath: ORDER_SIJ_PDF_PUBLIC,
  pdfDiskPath: ORDER_SIJ_PDF_DISK,
  pdfSha256: ORDER_SIJ_SHA,
  schemaVersion: ORDER_SIJ_VERSION,
  sections: ORDER_SIJ_SECTIONS as AutomatedFormDefinition['sections'],
  hardcodedValues: ORDER_SIJ_HARDCODED,
  requiredForPrint: ORDER_SIJ_REQUIRED,
  fieldByKey: ORDER_SIJ_FIELD_BY_KEY as AutomatedFormDefinition['fieldByKey'],
  zodSchema: ORDER_SIJ_ZOD_SCHEMA,
  buildPrefilledValues: async (caseId, service) => {
    const raw = await buildOrderSijPrefilledValues(caseId, service)
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
      n.includes('order') &&
      (n.includes('sij') || n.includes('special immigrant juvenile')) &&
      (n.includes('finding') || n.includes('predicate'))
    )
  },
}

const SAPCR205_DEFINITION: AutomatedFormDefinition = {
  slug: SAPCR205_SLUG,
  formName: SAPCR205_NAME,
  formDescriptionEs: SAPCR205_DESC,
  states: ['TX'],
  packetType: 'merits',
  pdfPublicPath: SAPCR205_PDF_PUBLIC,
  pdfDiskPath: SAPCR205_PDF_DISK,
  pdfSha256: SAPCR205_SHA,
  schemaVersion: SAPCR205_VERSION,
  sections: SAPCR205_SECTIONS as AutomatedFormDefinition['sections'],
  hardcodedValues: SAPCR205_HARDCODED,
  requiredForPrint: SAPCR205_REQUIRED,
  fieldByKey: SAPCR205_FIELD_BY_KEY as AutomatedFormDefinition['fieldByKey'],
  zodSchema: SAPCR205_ZOD_SCHEMA,
  buildPrefilledValues: async (caseId, service) => {
    const raw = await buildFmSapcr205PrefilledValues(caseId, service)
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
      n.includes('fm-sapcr-205') ||
      (n.includes('sapcr') && n.includes('nonparent') && n.includes('order')) ||
      (n.includes('order') && n.includes('parent-child') && n.includes('nonparent'))
    )
  },
}

const FL_GUARDIAN_DEFINITION: AutomatedFormDefinition = {
  slug: FL_GUARDIAN_SLUG,
  formName: FL_GUARDIAN_NAME,
  formDescriptionEs: FL_GUARDIAN_DESC,
  states: ['FL'],
  packetType: 'merits',
  templateType: 'docx-template',
  pdfPublicPath: FL_GUARDIAN_PDF_PUBLIC,
  pdfDiskPath: FL_GUARDIAN_PDF_DISK,
  pdfSha256: FL_GUARDIAN_SHA,
  schemaVersion: FL_GUARDIAN_VERSION,
  sections: FL_GUARDIAN_SECTIONS as AutomatedFormDefinition['sections'],
  hardcodedValues: FL_GUARDIAN_HARDCODED,
  requiredForPrint: FL_GUARDIAN_REQUIRED,
  fieldByKey: FL_GUARDIAN_FIELD_BY_KEY as AutomatedFormDefinition['fieldByKey'],
  zodSchema: FL_GUARDIAN_ZOD_SCHEMA,
  buildPrefilledValues: async (caseId, service) => {
    const raw = await buildFlGuardianshipPrefilledValues(caseId, service)
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
      n.includes('permanent guardianship') ||
      (n.includes('petition') && n.includes('guardianship') && n.includes('minor'))
    )
  },
}

const I485_DEFINITION: AutomatedFormDefinition = {
  slug: I485_SLUG,
  formName: I485_NAME,
  formDescriptionEs: I485_DESC,
  states: [],                             // FEDERAL — multi-estado
  packetType: 'merits',
  pdfPublicPath: I485_PDF_PUBLIC,
  pdfDiskPath: I485_PDF_DISK,
  pdfSha256: I485_SHA,
  schemaVersion: I485_VERSION,
  sections: I485_SECTIONS as AutomatedFormDefinition['sections'],
  hardcodedValues: I485_HARDCODED,
  requiredForPrint: I485_REQUIRED,
  fieldByKey: I485_FIELD_BY_KEY as AutomatedFormDefinition['fieldByKey'],
  zodSchema: I485_ZOD_SCHEMA,
  buildPrefilledValues: async (caseId, service) => {
    const raw = await buildI485PrefilledValues(caseId, service)
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
      /i[-\s]?485/.test(n) ||
      n.includes('application to register permanent residence') ||
      n.includes('adjust status') ||
      n.includes('adjustment of status')
    )
  },
  // PDF gigante (4.8 MB, 728 fields) — flatten consume mucha RAM en Vercel.
  // Diana puede igual editar el PDF post-descarga, lo cual es preferible.
  flattenPdf: false,
}

export const AUTOMATED_FORMS: Record<string, AutomatedFormDefinition> = {
  [SAPCR100_SLUG]: SAPCR100_DEFINITION,
  [SAPCR_AFF_100_SLUG]: SAPCR_AFF_100_DEFINITION,
  [PR_GEN_116_SLUG]: PR_GEN_116_DEFINITION,
  [MOTION_SIJ_SLUG]: MOTION_SIJ_DEFINITION,
  [AFFIDAVIT_SIJ_SLUG]: AFFIDAVIT_SIJ_DEFINITION,
  [ORDER_SIJ_SLUG]: ORDER_SIJ_DEFINITION,
  [SAPCR205_SLUG]: SAPCR205_DEFINITION,
  [FL_GUARDIAN_SLUG]: FL_GUARDIAN_DEFINITION,
  [I485_SLUG]: I485_DEFINITION,
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

// ──────────────────────────────────────────────────────────────────
// Auto-injection runtime para casos cacheados
// ──────────────────────────────────────────────────────────────────

/**
 * Forma genérica de RequiredForm — duplica la del research para evitar import
 * circular (research-jurisdiction depende del registry).
 */
interface InjectedRequiredForm {
  name: string
  url_official: string
  description_es: string
  is_mandatory: boolean
  slug: string
}

/**
 * Devuelve los formularios del registry que aplican a un (stateCode, packetType)
 * dado, en formato `RequiredForm`. Pensado para INYECTARSE en el response de
 * `case-jurisdiction` cuando el cache es viejo y la IA aún no etiquetó los slugs.
 *
 * - `stateCode`: código de estado en mayúsculas (ej. 'TX'). Si la definition
 *   tiene `states: []` se considera multi-estado y se inyecta siempre.
 * - `packetType`: 'intake' o 'merits'. Determina si va a `intake_required_forms`
 *   o `required_forms`.
 *
 * No toca BD: el merge se hace en memoria antes de devolver al cliente.
 */
export function getInjectedFormsForState(
  stateCode: string | null | undefined,
  packetType: 'intake' | 'merits'
): InjectedRequiredForm[] {
  if (!stateCode) return []
  const upper = stateCode.toUpperCase()
  const out: InjectedRequiredForm[] = []
  for (const def of Object.values(AUTOMATED_FORMS)) {
    if (def.packetType !== packetType) continue
    const matchesState = def.states.length === 0 || def.states.includes(upper)
    if (!matchesState) continue
    out.push({
      name: def.formName,
      // El "url_official" del registry apunta al PDF en blanco interno (servido
      // por Next desde public/forms/). Si la fila cacheada de la BD trae el
      // url_official externo (texaslawhelp.org/etc.), ese gana — el merge lo
      // preserva. Esto es solo un fallback para forms inyectados de novo.
      url_official: def.pdfPublicPath,
      description_es: def.formDescriptionEs,
      is_mandatory: true,
      slug: def.slug,
    })
  }
  return out
}

/**
 * Mergea los formularios inyectados con la lista existente, evitando duplicados
 * y enriqueciendo entries existentes con su slug si la IA no los etiquetó.
 *
 * Reglas:
 * 1. Si una entry existente matchea por `detectByName` (o por `slug` ya
 *    presente), se enriquece con el slug del registry — `url_official` y
 *    `description_es` originales se preservan (la IA suele tener mejores
 *    metadatos que el registry).
 * 2. Si un form del registry no está en la lista, se inyecta como entry nueva.
 * 3. Filas que no matchean el registry quedan intactas.
 */
export function mergeWithInjectedForms<
  T extends { name: string; url_official?: string; description_es?: string; is_mandatory?: boolean; slug?: string | null }
>(
  existing: T[] | null | undefined,
  injected: InjectedRequiredForm[]
): (T | InjectedRequiredForm)[] {
  const list: (T | InjectedRequiredForm)[] = []
  const matchedSlugs = new Set<string>()

  for (const e of existing ?? []) {
    const slug = resolveAutomatedFormSlug(e)
    if (slug) {
      matchedSlugs.add(slug)
      list.push({ ...e, slug })
    } else {
      list.push(e)
    }
  }

  for (const inj of injected) {
    if (!matchedSlugs.has(inj.slug)) {
      list.push(inj)
    }
  }

  return list
}

// ──────────────────────────────────────────────────────────────────
// Catálogo dinámico para el prompt de la IA de research
// ──────────────────────────────────────────────────────────────────

/**
 * Render markdown table del catálogo de slugs automatizados, agrupado por
 * estado, para inyectar en el system prompt de `research-jurisdiction.ts`.
 *
 * Cuando se añade un nuevo form al registry (nueva entrada en
 * `AUTOMATED_FORMS`), la tabla se actualiza sola y la IA empezará a
 * etiquetar ese form con su slug en futuras investigaciones — sin tener
 * que tocar el prompt manualmente. Es la pieza que hace la automatización
 * "escalable" tras un solo registry.
 *
 * Output ejemplo:
 *
 * ```md
 * ### Texas (TX)
 * | Form oficial | slug |
 * |---|---|
 * | TX FM-SAPCR-100 Petition | tx-fm-sapcr-100 |
 * | TX FM-SAPCR-AFF-100 Affidavit | tx-fm-sapcr-aff-100 |
 * ```
 */
export function getRegisteredSlugCatalogMarkdown(): string {
  const byState = new Map<string, AutomatedFormDefinition[]>()
  for (const def of Object.values(AUTOMATED_FORMS)) {
    const states = def.states.length > 0 ? def.states : ['ALL']
    for (const st of states) {
      const list = byState.get(st) ?? []
      list.push(def)
      byState.set(st, list)
    }
  }

  if (byState.size === 0) {
    return '_(El registry está vacío — no hay formularios automatizados todavía.)_'
  }

  const STATE_NAMES: Record<string, string> = {
    TX: 'Texas',
    CA: 'California',
    NY: 'New York',
    FL: 'Florida',
    UT: 'Utah',
    IL: 'Illinois',
    NJ: 'New Jersey',
    AZ: 'Arizona',
    GA: 'Georgia',
    NC: 'North Carolina',
    VA: 'Virginia',
    MA: 'Massachusetts',
    CO: 'Colorado',
    WA: 'Washington',
    PA: 'Pennsylvania',
    OH: 'Ohio',
    NV: 'Nevada',
    OR: 'Oregon',
    MD: 'Maryland',
    CT: 'Connecticut',
    ALL: 'Multi-estado / Federal',
  }

  const sortedStates = [...byState.keys()].sort()
  const blocks: string[] = []
  for (const st of sortedStates) {
    const defs = byState.get(st)!.sort((a, b) => a.slug.localeCompare(b.slug))
    const stateLabel = STATE_NAMES[st] ?? st
    const rows = defs
      .map((d) => `| ${d.formName} (${d.formDescriptionEs}) | \`${d.slug}\` |`)
      .join('\n')
    blocks.push(`### ${stateLabel} (${st})\n\n| Form oficial | slug |\n|---|---|\n${rows}`)
  }
  return blocks.join('\n\n')
}

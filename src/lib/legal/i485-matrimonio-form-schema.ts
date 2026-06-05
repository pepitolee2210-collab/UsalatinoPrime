// Schema del USCIS Form I-485 para el servicio "Ajuste de Estatus por Matrimonio".
//
// INDEPENDIENTE del I-485 de Visa Juvenil (SIJS): tiene su propio slug,
// formName, prefill, fase y documentos. Reusa la MISMA estructura de campos
// del PDF (mismo archivo físico public/forms/i-485.pdf, mismo SHA-256) porque
// el formulario oficial es el mismo — lo que cambia es de QUIÉN son los datos
// (la cónyuge solicitante, no un menor SIJS) y las PREGUNTAS mostradas.
//
// Por eso importamos las secciones base de i485-form-schema.ts y aplicamos
// overrides de labels para adaptar las preguntas al caso de matrimonio, sin
// mutar el schema SIJS (se clona). Si USCIS publica una nueva edición del PDF,
// se regenera i485-form-schema.ts y este hereda los campos automáticamente.

import { z } from 'zod'
import {
  I485_SECTIONS,
  PDF_PUBLIC_PATH as I485_PDF_PUBLIC,
  PDF_DISK_PATH as I485_PDF_DISK,
  PDF_SHA256 as I485_PDF_SHA,
  type FieldSpec,
  type I485Section,
} from './i485-form-schema'

// ──────────────────────────────────────────────────────────────────
// Constantes propias (identidad independiente)
// ──────────────────────────────────────────────────────────────────

export const PDF_PUBLIC_PATH = I485_PDF_PUBLIC
export const PDF_DISK_PATH = I485_PDF_DISK
export const PDF_SHA256 = I485_PDF_SHA
export const SCHEMA_VERSION = '2026-06-uscis-i485-matrimonio-v1'
export const FORM_SLUG = 'uscis-i-485-matrimonio'
export const FORM_NAME = 'USCIS Form I-485 (Matrimonio)'
export const FORM_DESCRIPTION_ES =
  'Solicitud de Residencia Permanente (I-485) — Ajuste de Estatus por Matrimonio. La llena la cónyuge solicitante.'

export type { FieldSpec, I485Section }

// ──────────────────────────────────────────────────────────────────
// Overrides de labels: adaptan las preguntas genéricas al caso de matrimonio.
// La persona que ajusta (Parte 1) es la cónyuge extranjera; la Parte 6
// (Marital History) describe su matrimonio con el peticionario ciudadano.
// Tomados de la guía oficial de llenado del I-485 (caso de matrimonio).
// ──────────────────────────────────────────────────────────────────

const LABEL_OVERRIDES: Record<string, { labelEs?: string; helpEs?: string }> = {
  // Parte 1 — solicitante = la cónyuge
  pt1line1_familyname: { labelEs: 'Apellido(s) de la cónyuge solicitante', helpEs: 'Tal como aparece en su pasaporte (o de casada, si lo cambió).' },
  pt1line1_givenname: { labelEs: 'Nombre(s) de la cónyuge solicitante' },
  pt1line3_dob: { labelEs: 'Fecha de nacimiento de la cónyuge', helpEs: 'MM/DD/YYYY' },
  pt1line5_dob: { labelEs: 'Fecha de nacimiento de la cónyuge', helpEs: 'MM/DD/YYYY' },
  pt1line7_citytownofbirth: { labelEs: 'Ciudad de nacimiento de la cónyuge' },
  pt1line7_countryofbirth: { labelEs: 'País de nacimiento de la cónyuge' },
  pt1line8_countryofcitizenshipnationality: { labelEs: 'País de ciudadanía de la cónyuge' },
  pt1line10_passportnum: { labelEs: 'Número de pasaporte de la cónyuge' },
  // Parte 6 — historial marital: el cónyuge actual es el peticionario (esposo ciudadano)
  pt6line1_maritalstatus_3: { labelEs: 'Estado civil — Casada', helpEs: 'En este caso siempre es "Casada" (con el peticionario ciudadano).' },
  pt6line3_timesmarried: { labelEs: '¿Cuántas veces se ha casado en total? (contando este matrimonio)' },
  pt6line4_familyname: { labelEs: 'Apellido del cónyuge actual (el ciudadano peticionario)' },
  pt6line4_givenname: { labelEs: 'Nombre del cónyuge actual (el ciudadano peticionario)' },
  pt6line4_middlename: { labelEs: 'Segundo nombre del cónyuge actual' },
  pt6line16_dateofbirth: { labelEs: 'Fecha de nacimiento del cónyuge actual', helpEs: 'MM/DD/YYYY' },
}

// ──────────────────────────────────────────────────────────────────
// Secciones (clon de las del I-485 con overrides aplicados — sin mutar SIJS)
// ──────────────────────────────────────────────────────────────────

export const I485M_SECTIONS: I485Section[] = I485_SECTIONS.map((s) => ({
  ...s,
  fields: s.fields.map((f) => {
    const ov = LABEL_OVERRIDES[f.semanticKey]
    return ov ? { ...f, ...ov } : f
  }),
}))

// ──────────────────────────────────────────────────────────────────
// Hardcoded values
//
// La categoría de elegibilidad (Parte 2: "Spouse of a U.S. Citizen") NO se
// hardcodea: el mapeo de su checkbox debe verificarse visualmente contra el PDF
// y es una decisión legal — el equipo legal la marca. Ver computeLegalWarnings
// en el registry.
// ──────────────────────────────────────────────────────────────────

export const HARDCODED_VALUES: Record<string, string | boolean> = {}

// ──────────────────────────────────────────────────────────────────
// Required for print (mínimo: nombre de la cónyuge solicitante)
// ──────────────────────────────────────────────────────────────────

export const REQUIRED_FOR_PRINT: string[] = ['pt1line1_familyname', 'pt1line1_givenname']

// ──────────────────────────────────────────────────────────────────
// Exports derivados
// ──────────────────────────────────────────────────────────────────

export const ALL_FIELDS: FieldSpec[] = I485M_SECTIONS.flatMap((s) => s.fields)

export const FIELD_BY_KEY: Record<string, FieldSpec> = Object.fromEntries(
  ALL_FIELDS.map((f) => [f.semanticKey, f])
)

// ──────────────────────────────────────────────────────────────────
// Zod schema (validación parcial — todos opcionales)
// ──────────────────────────────────────────────────────────────────

const fieldsZodShape: Record<string, z.ZodTypeAny> = {}
for (const f of ALL_FIELDS) {
  const s: z.ZodTypeAny = f.type === 'checkbox' ? z.boolean() : z.string()
  fieldsZodShape[f.semanticKey] = s.optional().nullable()
}

export const i485MatrimonioFormSchema = z.object(fieldsZodShape)
export type I485MatrimonioFormValues = z.infer<typeof i485MatrimonioFormSchema>

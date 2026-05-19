// Schema curado para EOIR-26A — Fee Waiver Request (acompaña al EOIR-26).
//
// Opcional: solo se llena cuando el apelante pide exención de la tarifa de
// apelación ante la BIA por motivos económicos. El cliente decide en su portal
// si lo va a llenar (toggle implícito por presencia de datos).
//
// Si EOIR publica una nueva revisión del PDF, re-ejecutar el script de
// inspección y actualizar PDF_SHA256 + cualquier pdfFieldName que haya cambiado.

import { z } from 'zod'
import type { FieldSpec, SapcrSection } from './sapcr100-form-schema'

// ──────────────────────────────────────────────────────────────────
// Constantes verificables al runtime
// ──────────────────────────────────────────────────────────────────

export const PDF_PUBLIC_PATH = '/forms/eoir-26a.pdf'
export const PDF_DISK_PATH = 'public/forms/eoir-26a.pdf'
export const PDF_SHA256 = '45ca49b9467298357d6cdd2683f5407da2ced6a1258e6939c5e820c9e23c125b'
export const SCHEMA_VERSION = '2026-05-18'
export const FORM_SLUG = 'eoir-26a'
export const FORM_NAME = 'EOIR-26A — Fee Waiver Request'
export const FORM_DESCRIPTION_ES =
  'Solicitud de exención de tarifa para acompañar al EOIR-26. Opcional — solo si el apelante no puede pagar la tarifa de apelación.'

// ──────────────────────────────────────────────────────────────────
// Secciones
// ──────────────────────────────────────────────────────────────────

const SECTION_1: SapcrSection = {
  id: 1,
  titleEs: '1. Identificación',
  descriptionEs:
    'Datos del apelante para vincular esta solicitud de fee waiver con el caso ante la BIA.',
  fields: [
    { semanticKey: 'alien_name', pdfFieldName: 'Name Last First Middle', type: 'text', labelEs: 'Nombre completo (Apellido, Nombre, Segundo nombre)', helpEs: 'Formato: "Pérez, Juan Carlos".', page: 1, required: true, deriveFrom: 'appellant.name_last_first_middle' },
    { semanticKey: 'alien_a_number', pdfFieldName: 'Alien A Number', type: 'text', labelEs: 'A-Number', helpEs: 'Número de Alien Registration (sin la letra A inicial).', page: 1, required: true, deriveFrom: 'appellant.a_number' },
    { semanticKey: 'alien_print_name_filing', pdfFieldName: 'Print name of alien filing the form', type: 'text', labelEs: 'Nombre del apelante (impreso)', page: 1, required: true, deriveFrom: 'appellant.full_name' },
    { semanticKey: 'preparer_print_name', pdfFieldName: 'Print Name', type: 'text', labelEs: 'Nombre del preparador (si aplica)', helpEs: 'Si el formulario lo preparó un representante, su nombre aquí.', page: 1, editableByClient: false, deriveFrom: 'preparer.name' },
    { semanticKey: 'eoir_id_number', pdfFieldName: 'EOIR ID Number', type: 'text', labelEs: 'EOIR ID Number', helpEs: 'Número de identificación EOIR del apelante (aparece en la decisión del juez). Si no lo sabe, dejar vacío.', page: 1, deriveFrom: 'appellant.eoir_id' },
    { semanticKey: 'preparer_date', pdfFieldName: 'Date', type: 'date', labelEs: 'Fecha (preparador)', page: 1 },
  ],
}

const SECTION_2: SapcrSection = {
  id: 2,
  titleEs: '2. Ingresos mensuales',
  descriptionEs:
    'Reporta tus ingresos mensuales totales. Sé honesto y conservador — la BIA puede solicitar evidencia adicional. Si una categoría no aplica, ingresa "0".',
  fields: [
    { semanticKey: 'income_employment', pdfFieldName: 'IncomeEmployment', type: 'text', labelEs: 'Ingreso por empleo ($/mes)', helpEs: 'Salario, propinas, comisiones, contratistas. Bruto antes de impuestos.', page: 1, required: true },
    { semanticKey: 'income_property', pdfFieldName: 'IncomeProperty', type: 'text', labelEs: 'Ingreso por propiedad ($/mes)', helpEs: 'Renta de propiedades, venta de bienes.', page: 1 },
    { semanticKey: 'income_interest', pdfFieldName: 'IncomeInterest', type: 'text', labelEs: 'Ingreso por intereses ($/mes)', helpEs: 'Intereses bancarios, dividendos.', page: 1 },
    { semanticKey: 'income_other', pdfFieldName: 'IncomeOther', type: 'text', labelEs: 'Otro ingreso ($/mes)', helpEs: 'Asistencia pública, manutención recibida, otros.', page: 1 },
  ],
}

const SECTION_3: SapcrSection = {
  id: 3,
  titleEs: '3. Gastos mensuales',
  descriptionEs:
    'Reporta tus gastos mensuales típicos. Si una categoría no aplica, ingresa "0".',
  fields: [
    { semanticKey: 'expense_rent', pdfFieldName: 'ExpenseRent', type: 'text', labelEs: 'Renta / Hipoteca ($/mes)', page: 1, required: true },
    { semanticKey: 'expense_utilities', pdfFieldName: 'ExpenseUtil', type: 'text', labelEs: 'Servicios (luz, agua, gas, internet) ($/mes)', page: 1 },
    { semanticKey: 'expense_installments', pdfFieldName: 'ExpenseInstall', type: 'text', labelEs: 'Pagos en cuotas / Deudas ($/mes)', helpEs: 'Préstamos, tarjetas de crédito, autofinanciamiento.', page: 1 },
    { semanticKey: 'expense_living', pdfFieldName: 'ExpenseLiving', type: 'text', labelEs: 'Gastos de vida (comida, transporte, ropa) ($/mes)', page: 1 },
    { semanticKey: 'expense_other', pdfFieldName: 'ExpenseOther', type: 'text', labelEs: 'Otros gastos ($/mes)', helpEs: 'Médicos, escuela, manutención pagada, etc.', page: 1 },
  ],
}

const SECTION_4: SapcrSection = {
  id: 4,
  titleEs: '4. Totales mensuales',
  descriptionEs:
    'Estos totales se calculan automáticamente al imprimir el PDF — pueden corregirse manualmente si la diferencia justifica explicación.',
  fields: [
    { semanticKey: 'total_assets', pdfFieldName: 'TotalTot', type: 'text', labelEs: 'Total de bienes / patrimonio neto ($)', helpEs: 'Valor estimado de todos tus bienes (cuentas, vehículos, propiedad).', page: 1 },
    { semanticKey: 'total_monthly_income', pdfFieldName: 'MonthIncome', type: 'text', labelEs: 'Ingresos mensuales totales ($)', helpEs: 'Suma de los 4 campos de ingreso.', page: 1 },
    { semanticKey: 'total_monthly_expense', pdfFieldName: 'MonthExpense', type: 'text', labelEs: 'Gastos mensuales totales ($)', helpEs: 'Suma de los 5 campos de gasto.', page: 1 },
  ],
}

const SECTION_5: SapcrSection = {
  id: 5,
  titleEs: '5. Información adicional y firmas',
  descriptionEs:
    'Explica cualquier circunstancia que apoye tu solicitud de fee waiver. Las firmas se firman a mano sobre la copia impresa.',
  fields: [
    { semanticKey: 'additional_info', pdfFieldName: 'Information', type: 'textarea', labelEs: 'Información adicional', helpEs: 'Explica por qué necesitas el fee waiver: dependientes, deudas extraordinarias, condición de salud, etc.', page: 1 },
    { semanticKey: 'alien_signature_date', pdfFieldName: 'AlienSigDate', type: 'date', labelEs: 'Fecha de la firma del apelante', page: 1 },
    { semanticKey: 'attorney_signature_placeholder', pdfFieldName: 'Signature of Attorney or Representative', type: 'text', labelEs: 'Firma del abogado o representante (texto)', helpEs: 'El abogado firmará a mano sobre la copia impresa.', page: 1, editableByClient: false },
    { semanticKey: 'alien_signature_placeholder', pdfFieldName: 'Signature of Alien Filing the Form', type: 'text', labelEs: 'Firma del apelante (texto)', helpEs: 'El apelante firmará a mano sobre la copia impresa.', page: 1, deriveFrom: 'appellant.full_name', editableByClient: false },
  ],
}

export const EOIR_26A_SECTIONS: SapcrSection[] = [
  SECTION_1,
  SECTION_2,
  SECTION_3,
  SECTION_4,
  SECTION_5,
]

// ──────────────────────────────────────────────────────────────────
// Map flat por semanticKey (acceso O(1)) + hardcoded + required
// ──────────────────────────────────────────────────────────────────

export const ALL_FIELDS: FieldSpec[] = EOIR_26A_SECTIONS.flatMap((s) => s.fields)

export const FIELD_BY_KEY: Record<string, FieldSpec> = Object.fromEntries(
  ALL_FIELDS.filter((f) => f.pdfFieldName).map((f) => [f.semanticKey, f]),
)

export const HARDCODED_VALUES: Record<string, string | boolean> = ALL_FIELDS.reduce(
  (acc, f) => {
    if (f.hardcoded !== undefined) acc[f.semanticKey] = f.hardcoded
    return acc
  },
  {} as Record<string, string | boolean>,
)

export const REQUIRED_FOR_PRINT: string[] = ALL_FIELDS.filter((f) => f.required).map(
  (f) => f.semanticKey,
)

// ──────────────────────────────────────────────────────────────────
// processForPrint — calcula los totales si no fueron provistos.
// ──────────────────────────────────────────────────────────────────

function toNumber(v: string | boolean | null | undefined): number {
  if (typeof v !== 'string') return 0
  const s = v.replace(/[^0-9.\-]/g, '').trim()
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function processForPrint(
  values: Record<string, string | boolean | null | undefined>,
): Record<string, string | boolean | null | undefined> {
  const out = { ...values }
  const incomeKeys = ['income_employment', 'income_property', 'income_interest', 'income_other']
  const expenseKeys = [
    'expense_rent',
    'expense_utilities',
    'expense_installments',
    'expense_living',
    'expense_other',
  ]
  if (!out.total_monthly_income || out.total_monthly_income === '') {
    const sum = incomeKeys.reduce((a, k) => a + toNumber(out[k]), 0)
    if (sum > 0) out.total_monthly_income = sum.toFixed(2)
  }
  if (!out.total_monthly_expense || out.total_monthly_expense === '') {
    const sum = expenseKeys.reduce((a, k) => a + toNumber(out[k]), 0)
    if (sum > 0) out.total_monthly_expense = sum.toFixed(2)
  }
  return out
}

// ──────────────────────────────────────────────────────────────────
// Zod schema (todos opcionales — la validación de "obligatorio para
// imprimir" se hace por separado con `REQUIRED_FOR_PRINT`).
// ──────────────────────────────────────────────────────────────────

const valueSchema = z.union([z.string(), z.boolean()]).optional().nullable()
const dynamicShape: Record<string, z.ZodTypeAny> = {}
for (const f of ALL_FIELDS) {
  dynamicShape[f.semanticKey] = valueSchema
}

export const eoir26aFormSchema = z.object(dynamicShape)
export type Eoir26aFormValues = z.infer<typeof eoir26aFormSchema>

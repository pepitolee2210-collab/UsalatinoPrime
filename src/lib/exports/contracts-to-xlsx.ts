import ExcelJS from 'exceljs'

/**
 * Genera un workbook .xlsx con TODOS los contratos para que Andrium / Vanessa /
 * Henry filtren manualmente en Excel. Sin estilos: solo headers + filas.
 *
 * Estrategia 1 fila por contrato + columnas dinámicas Menor1_*…MenorN_*,
 * PagoN_*, AddonN_*, con clamps para evitar workbooks corruptos.
 *
 * Fechas se emiten como objetos Date con numFmt 'yyyy-mm-dd' para evitar que
 * Excel en español auto-parsee a dd/mm/yyyy.
 */

const MAX_MINORS = 10
const MAX_ADDONS = 10
const MAX_PAYMENTS = 24

export interface ContractExportRow {
  id: string
  created_at: string | null
  updated_at: string | null
  status: string | null
  signed_at: string | null
  contract_start_date: string | null
  signing_token: string | null
  case_id: string | null

  client_full_name: string | null
  client_passport: string | null
  client_phone: string | null
  client_dob: string | null
  client_address: string | null
  client_address_unit: string | null
  client_city: string | null
  client_state: string | null
  client_zip: string | null
  client_signature: string | null

  service_name: string | null
  service_slug: string | null
  subservice_slug: string | null
  variant_index: number | null
  asylum_family_type: string | null
  objeto_del_contrato: string | null
  etapas: string[] | null

  total_price: number | null
  initial_payment: number | null
  installment_count: number | null
  monthly_amount: number | null

  minors: unknown
  spouse: unknown
  addon_services: unknown
  payment_schedule: unknown
}

interface MinorRecord {
  fullName?: string
  name?: string
  dob?: string
  passport?: string
  birthplace?: string
}

interface SpouseRecord {
  fullName?: string
  name?: string
  dob?: string
  passport?: string
  nationality?: string
  birthplace?: string
}

interface AddonRecord {
  name?: string
  price?: number
  etapas?: string[]
}

interface PaymentRecord {
  number?: number
  date?: string
  amount?: number
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.filter((x): x is string => typeof x === 'string')
}

function toArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function toMinor(v: unknown): MinorRecord {
  if (!isRecord(v)) return {}
  return {
    fullName: asString(v.fullName),
    name: asString(v.name),
    dob: asString(v.dob),
    passport: asString(v.passport),
    birthplace: asString(v.birthplace),
  }
}

function toSpouse(v: unknown): SpouseRecord | null {
  if (!isRecord(v)) return null
  return {
    fullName: asString(v.fullName),
    name: asString(v.name),
    dob: asString(v.dob),
    passport: asString(v.passport),
    nationality: asString(v.nationality),
    birthplace: asString(v.birthplace),
  }
}

function toAddon(v: unknown): AddonRecord {
  if (!isRecord(v)) return {}
  return {
    name: asString(v.name),
    price: asNumber(v.price),
    etapas: asStringArray(v.etapas),
  }
}

function toPayment(v: unknown): PaymentRecord {
  if (!isRecord(v)) return {}
  return {
    number: asNumber(v.number),
    date: asString(v.date),
    amount: asNumber(v.amount),
  }
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function clampMax(values: number[], cap: number, label: string): number {
  const raw = values.length === 0 ? 0 : Math.max(...values)
  if (raw > cap) {
    console.warn(
      `[contracts-to-xlsx] ${label} excede el cap (${raw} > ${cap}). Truncando.`,
    )
    return cap
  }
  return raw
}

type CellValue = string | number | Date | boolean | null
type ExcelRowData = Record<string, CellValue>

interface ColumnDef {
  key: string
  header: string
  type: 'string' | 'number' | 'date'
}

export async function buildContractsWorkbook(
  rows: ContractExportRow[],
): Promise<Buffer> {
  const minorsByRow = rows.map((r) => toArray(r.minors))
  const addonsByRow = rows.map((r) => toArray(r.addon_services))
  const paymentsByRow = rows.map((r) => toArray(r.payment_schedule))

  const maxMinors = clampMax(
    minorsByRow.map((m) => m.length),
    MAX_MINORS,
    'minors',
  )
  const maxAddons = clampMax(
    addonsByRow.map((a) => a.length),
    MAX_ADDONS,
    'addons',
  )
  const maxPayments = clampMax(
    paymentsByRow.map((p) => p.length),
    MAX_PAYMENTS,
    'payments',
  )

  const columns: ColumnDef[] = [
    { key: 'id', header: 'ID', type: 'string' },
    { key: 'created_at', header: 'Fecha Creación', type: 'date' },
    { key: 'updated_at', header: 'Fecha Actualización', type: 'date' },
    { key: 'status', header: 'Estado', type: 'string' },
    { key: 'signed_at', header: 'Firmado El', type: 'date' },
    { key: 'contract_start_date', header: 'Inicio Contrato', type: 'date' },
    { key: 'case_id', header: 'Case ID', type: 'string' },
    { key: 'signing_token', header: 'Token Firma', type: 'string' },

    { key: 'client_full_name', header: 'Cliente Nombre', type: 'string' },
    { key: 'client_passport', header: 'Pasaporte', type: 'string' },
    { key: 'client_phone', header: 'Teléfono', type: 'string' },
    { key: 'client_dob', header: 'Fecha Nacimiento', type: 'date' },
    { key: 'client_address', header: 'Dirección', type: 'string' },
    { key: 'client_address_unit', header: 'Unidad', type: 'string' },
    { key: 'client_city', header: 'Ciudad', type: 'string' },
    { key: 'client_state', header: 'Estado (US)', type: 'string' },
    { key: 'client_zip', header: 'ZIP', type: 'string' },

    { key: 'service_name', header: 'Servicio', type: 'string' },
    { key: 'service_slug', header: 'Slug', type: 'string' },
    { key: 'subservice_slug', header: 'Subservicio', type: 'string' },
    { key: 'variant_index', header: 'Variante', type: 'number' },
    { key: 'asylum_family_type', header: 'Asilo Tipo Familia', type: 'string' },
    { key: 'objeto_del_contrato', header: 'Objeto del Contrato', type: 'string' },
    { key: 'etapas', header: 'Etapas', type: 'string' },

    { key: 'total_price', header: 'Precio Total', type: 'number' },
    { key: 'initial_payment', header: 'Abono Inicial', type: 'number' },
    { key: 'installment_count', header: 'Cuotas', type: 'number' },
    { key: 'monthly_amount', header: 'Monto Mensual', type: 'number' },

    { key: 'spouse_full_name', header: 'Cónyuge Nombre', type: 'string' },
    { key: 'spouse_dob', header: 'Cónyuge Fecha Nacimiento', type: 'date' },
    { key: 'spouse_passport', header: 'Cónyuge Pasaporte', type: 'string' },
    { key: 'spouse_nationality', header: 'Cónyuge Nacionalidad', type: 'string' },
    { key: 'spouse_birthplace', header: 'Cónyuge Lugar Nacimiento', type: 'string' },
  ]

  for (let i = 0; i < maxPayments; i++) {
    const n = i + 1
    columns.push({ key: `pago_${i}_num`, header: `Pago${n}_Num`, type: 'number' })
    columns.push({ key: `pago_${i}_fecha`, header: `Pago${n}_Fecha`, type: 'date' })
    columns.push({ key: `pago_${i}_monto`, header: `Pago${n}_Monto`, type: 'number' })
  }

  for (let i = 0; i < maxMinors; i++) {
    const n = i + 1
    columns.push({ key: `menor_${i}_nombre`, header: `Menor${n}_Nombre`, type: 'string' })
    columns.push({ key: `menor_${i}_dob`, header: `Menor${n}_FechaNacimiento`, type: 'date' })
    columns.push({ key: `menor_${i}_passport`, header: `Menor${n}_Pasaporte`, type: 'string' })
    columns.push({
      key: `menor_${i}_birthplace`,
      header: `Menor${n}_LugarNacimiento`,
      type: 'string',
    })
  }

  for (let i = 0; i < maxAddons; i++) {
    const n = i + 1
    columns.push({ key: `addon_${i}_nombre`, header: `Addon${n}_Nombre`, type: 'string' })
    columns.push({ key: `addon_${i}_precio`, header: `Addon${n}_Precio`, type: 'number' })
    columns.push({ key: `addon_${i}_etapas`, header: `Addon${n}_Etapas`, type: 'string' })
  }

  columns.push({ key: 'minors_json', header: 'Menores_JSON_Raw', type: 'string' })
  columns.push({ key: 'spouse_json', header: 'Conyuge_JSON_Raw', type: 'string' })
  columns.push({ key: 'addons_json', header: 'Addons_JSON_Raw', type: 'string' })
  columns.push({ key: 'payments_json', header: 'Pagos_JSON_Raw', type: 'string' })

  const wb = new ExcelJS.Workbook()
  wb.creator = 'UsaLatinoPrime'
  wb.created = new Date()
  const ws = wb.addWorksheet('Contratos')

  ws.columns = columns.map((c) => ({ key: c.key, header: c.header }))

  rows.forEach((row, rowIndex) => {
    const minors = minorsByRow[rowIndex].slice(0, maxMinors).map(toMinor)
    const addons = addonsByRow[rowIndex].slice(0, maxAddons).map(toAddon)
    const payments = paymentsByRow[rowIndex].slice(0, maxPayments).map(toPayment)
    const spouse = toSpouse(row.spouse)

    const data: ExcelRowData = {
      id: row.id,
      created_at: toDate(row.created_at),
      updated_at: toDate(row.updated_at),
      status: row.status,
      signed_at: toDate(row.signed_at),
      contract_start_date: toDate(row.contract_start_date),
      case_id: row.case_id,
      signing_token: row.signing_token,

      client_full_name: row.client_full_name,
      client_passport: row.client_passport,
      client_phone: row.client_phone,
      client_dob: toDate(row.client_dob),
      client_address: row.client_address,
      client_address_unit: row.client_address_unit,
      client_city: row.client_city,
      client_state: row.client_state,
      client_zip: row.client_zip,

      service_name: row.service_name,
      service_slug: row.service_slug,
      subservice_slug: row.subservice_slug,
      variant_index: row.variant_index,
      asylum_family_type: row.asylum_family_type,
      objeto_del_contrato: row.objeto_del_contrato,
      etapas: Array.isArray(row.etapas) ? row.etapas.join('; ') : null,

      total_price: row.total_price,
      initial_payment: row.initial_payment,
      installment_count: row.installment_count,
      monthly_amount: row.monthly_amount,

      spouse_full_name: spouse ? spouse.fullName ?? spouse.name ?? null : null,
      spouse_dob: spouse ? toDate(spouse.dob ?? null) : null,
      spouse_passport: spouse?.passport ?? null,
      spouse_nationality: spouse?.nationality ?? null,
      spouse_birthplace: spouse?.birthplace ?? null,

      minors_json: row.minors == null ? '' : JSON.stringify(row.minors),
      spouse_json: row.spouse == null ? '' : JSON.stringify(row.spouse),
      addons_json:
        row.addon_services == null ? '' : JSON.stringify(row.addon_services),
      payments_json:
        row.payment_schedule == null ? '' : JSON.stringify(row.payment_schedule),
    }

    for (let i = 0; i < maxPayments; i++) {
      const p = payments[i]
      data[`pago_${i}_num`] = p?.number ?? null
      data[`pago_${i}_fecha`] = toDate(p?.date ?? null)
      data[`pago_${i}_monto`] = p?.amount ?? null
    }

    for (let i = 0; i < maxMinors; i++) {
      const m = minors[i]
      data[`menor_${i}_nombre`] = m?.fullName ?? m?.name ?? null
      data[`menor_${i}_dob`] = toDate(m?.dob ?? null)
      data[`menor_${i}_passport`] = m?.passport ?? null
      data[`menor_${i}_birthplace`] = m?.birthplace ?? null
    }

    for (let i = 0; i < maxAddons; i++) {
      const a = addons[i]
      data[`addon_${i}_nombre`] = a?.name ?? null
      data[`addon_${i}_precio`] = a?.price ?? null
      data[`addon_${i}_etapas`] = Array.isArray(a?.etapas)
        ? a.etapas.join('; ')
        : null
    }

    const added = ws.addRow(data)

    columns.forEach((col, idx) => {
      if (col.type === 'date') {
        added.getCell(idx + 1).numFmt = 'yyyy-mm-dd'
      }
    })
  })

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf as ArrayBuffer)
}

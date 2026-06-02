// Adapter para las partes del I-589 / Miedo Creíble llenadas por el cliente
// (case_form_submissions form_type='i589_part_a1'..'i589_part_a4' y variantes).
//
// Cada parte es una sección independiente — son largas y conviene una sección
// por parte que un solo monolito. Si en el futuro se quiere consolidar, agregar
// un agrupador en el generator.

import type { FormAdapter } from '../types'
import { buildStatusBadge } from '../formatters'
import { countFilled } from './_shared'
import type { ClientInfoSection, RenderRow } from '../types'
import { fmtBool, fmtDate, fmtLongText, fmtMultiselect, fmtText, isEmptyValue } from '../formatters'

const PART_TITLE: Record<string, string> = {
  i589_part_a1: 'I-589 Parte A.I — Información del solicitante',
  i589_part_a2: 'I-589 Parte A.II — Familia (cónyuge e hijos)',
  i589_part_a3: 'I-589 Parte A.III — Origen y residencia',
  i589_part_a4: 'I-589 Parte A.IV — Antecedentes',
  i589_part_b: 'I-589 Parte B — Solicitud de Asilo (narrativa)',
  i589_part_c: 'I-589 Parte C — Información adicional',
  i589_part_d: 'I-589 Parte D — Tu firma',
}

// Mapping conocido de keys → label español. Lo que no esté aquí se renderiza con
// el nombre técnico humanizado (snake_case → "Snake Case") como fallback graceful.
const KNOWN_LABELS: Record<string, string> = {
  // Part A.I
  legal_first_name: 'Nombre legal',
  legal_middle_name: 'Segundo nombre',
  legal_last_name: 'Apellido',
  alias_names: 'Otros nombres usados',
  ssn: 'Número de Seguro Social',
  a_number: 'Número A (Alien)',
  date_of_birth: 'Fecha de nacimiento',
  city_of_birth: 'Ciudad de nacimiento',
  country_of_birth: 'País de nacimiento',
  nationality: 'Nacionalidad',
  race_ethnicity: 'Raza / etnia',
  religion: 'Religión',
  gender: 'Género',
  marital_status: 'Estado civil',
  // Family
  spouse_name: 'Nombre del cónyuge',
  spouse_dob: 'Fecha de nacimiento del cónyuge',
  children_count: 'Número de hijos',
  // Asylum narrative
  fears_return: '¿Teme regresar a su país?',
  has_suffered_harm: '¿Ha sufrido daño?',
  asylum_reasons: 'Razones del asilo',
  fear_details: 'Detalles del temor',
  harm_details: 'Detalles del daño sufrido',
  persecutors: 'Quiénes son los perseguidores',
  government_involved: '¿Está involucrado el gobierno?',
  reported_to_authorities: '¿Lo reportó a las autoridades?',
  // Travel/Residence
  countries_visited: 'Países visitados',
  last_country_before_usa: 'Último país antes de USA',
  date_entered_usa: 'Fecha de ingreso a USA',
  port_of_entry: 'Puerto de entrada',
  visa_used: 'Visa usada para entrar',
}

const DATE_KEYS = new Set<string>([
  'date_of_birth',
  'spouse_dob',
  'date_entered_usa',
])

const BOOL_KEYS = new Set<string>([
  'fears_return',
  'has_suffered_harm',
  'government_involved',
  'reported_to_authorities',
])

const MULTISELECT_KEYS = new Set<string>([
  'asylum_reasons',
])

const LONG_TEXT_KEYS = new Set<string>([
  'fear_details',
  'harm_details',
  'persecutors',
  'alias_names',
])

export const i589PartsAdapter: FormAdapter = {
  id: 'i589_parts',
  matches: (rec) => rec.formType.startsWith('i589_part_'),
  toSections: (rec) => {
    const title = PART_TITLE[rec.formType] ?? `I-589 (${rec.formType})`
    const rows: RenderRow[] = []
    for (const [k, v] of Object.entries(rec.data)) {
      if (isEmptyValue(v)) continue
      rows.push({
        label: KNOWN_LABELS[k] ?? humanize(k),
        value: formatByKey(k, v),
        kind: LONG_TEXT_KEYS.has(k) ? 'longText' : 'scalar',
      })
    }
    const section: ClientInfoSection = {
      id: `${rec.formType}-${rec.minorIndex ?? 0}`,
      title,
      phase: rec.phaseHint ?? guessPhaseFromType(rec.formType),
      statusBadge: buildStatusBadge(rec.status, rec.updatedAt),
      filledCount: countFilled(rec.data),
      rows,
    }
    return [section]
  },
}

function formatByKey(key: string, v: unknown): string {
  if (DATE_KEYS.has(key)) return fmtDate(v)
  if (BOOL_KEYS.has(key)) return fmtBool(v)
  if (MULTISELECT_KEYS.has(key)) return fmtMultiselect(v)
  if (LONG_TEXT_KEYS.has(key)) return fmtLongText(v)
  return fmtText(v)
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function guessPhaseFromType(formType: string): string | null {
  if (formType.startsWith('i589_part_a')) return 'asilo_sustentos'
  if (
    formType === 'i589_part_b' ||
    formType === 'i589_part_c' ||
    formType === 'i589_part_d'
  )
    return 'asilo_reforzar'
  return null
}

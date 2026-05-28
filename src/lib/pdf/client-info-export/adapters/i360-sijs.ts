// Adapter para el formulario I-360 SIJS llenado por el cliente
// (case_form_submissions con form_type='i360_sijs').
//
// La estructura de campos sigue el componente `i360-form-section.tsx`
// (src/components/legal/) — mantenemos las mismas keys y secciones para
// que el PDF refleje literalmente lo que Diana ve en el modal.

import type { FormAdapter, RenderRow, RenderSubsection } from '../types'
import { buildStatusBadge, fmtText, isEmptyValue } from '../formatters'
import {
  buildSubsection,
  countFilled,
  type SimpleFieldDef,
} from './_shared'

const PETITIONER_FIELDS: SimpleFieldDef[] = [
  { key: 'petitioner_first_name', label: 'Nombre' },
  { key: 'petitioner_middle_name', label: 'Segundo nombre' },
  { key: 'petitioner_last_name', label: 'Apellido' },
  { key: 'petitioner_ssn', label: 'SSN' },
  { key: 'petitioner_a_number', label: 'A-Number' },
  { key: 'petitioner_address', label: 'Dirección' },
  { key: 'petitioner_city', label: 'Ciudad' },
  { key: 'petitioner_state', label: 'Estado' },
  { key: 'petitioner_zip', label: 'ZIP' },
  { key: 'safe_mailing_name', label: 'Dirección segura — nombre' },
  { key: 'safe_mailing_address', label: 'Dirección segura — domicilio' },
  { key: 'safe_mailing_city', label: 'Dirección segura — ciudad' },
  { key: 'safe_mailing_state', label: 'Dirección segura — estado' },
  { key: 'safe_mailing_zip', label: 'Dirección segura — ZIP' },
]

const BENEFICIARY_FIELDS: SimpleFieldDef[] = [
  { key: 'beneficiary_first_name', label: 'Nombre' },
  { key: 'beneficiary_middle_name', label: 'Segundo nombre' },
  { key: 'beneficiary_last_name', label: 'Apellido' },
  { key: 'other_names', label: 'Otros nombres' },
  { key: 'beneficiary_dob', label: 'Fecha de nacimiento', kind: 'date' },
  { key: 'beneficiary_city_birth', label: 'Ciudad de nacimiento' },
  { key: 'beneficiary_country_birth', label: 'País de nacimiento' },
  { key: 'beneficiary_sex', label: 'Sexo' },
  { key: 'beneficiary_marital_status', label: 'Estado civil' },
  { key: 'beneficiary_address', label: 'Dirección' },
  { key: 'beneficiary_city', label: 'Ciudad' },
  { key: 'beneficiary_state', label: 'Estado' },
  { key: 'beneficiary_zip', label: 'ZIP' },
  { key: 'beneficiary_ssn', label: 'SSN' },
  { key: 'beneficiary_a_number', label: 'A-Number' },
  { key: 'beneficiary_passport_number', label: 'Pasaporte — número' },
  { key: 'beneficiary_passport_country', label: 'Pasaporte — país' },
  { key: 'beneficiary_passport_expiry', label: 'Pasaporte — vence', kind: 'date' },
  { key: 'beneficiary_i94_number', label: 'I-94' },
  { key: 'beneficiary_last_arrival_date', label: 'Última llegada', kind: 'date' },
  { key: 'beneficiary_nonimmigrant_status', label: 'Status migratorio' },
  { key: 'beneficiary_status_expiry', label: 'Status expira', kind: 'date' },
  { key: 'beneficiary_i94_expiry', label: 'I-94 expira', kind: 'date' },
]

const PROCESSING_FIELDS: SimpleFieldDef[] = [
  { key: 'foreign_parent_first_name', label: 'Padre/madre extranjero — nombre' },
  { key: 'foreign_parent_last_name', label: 'Padre/madre extranjero — apellido' },
  { key: 'foreign_parent_address', label: 'Dirección extranjero' },
  { key: 'foreign_parent_city', label: 'Ciudad extranjero' },
  { key: 'foreign_parent_province', label: 'Provincia extranjero' },
  { key: 'foreign_parent_country', label: 'País extranjero' },
  { key: 'in_removal_proceedings', label: 'En removal proceedings' },
  { key: 'other_petitions', label: 'Otras peticiones' },
  { key: 'worked_without_permission', label: 'Trabajó sin permiso' },
  { key: 'adjustment_attached', label: 'Ajuste de estatus adjunto' },
]

const FAMILY_FIELDS: SimpleFieldDef[] = [
  { key: 'children_filed_separate', label: 'Hijos presentaron peticiones separadas' },
  { key: 'spouse_child_1_first_name', label: 'Persona 1 — nombre' },
  { key: 'spouse_child_1_last_name', label: 'Persona 1 — apellido' },
  { key: 'spouse_child_1_relationship', label: 'Persona 1 — relación' },
  { key: 'spouse_child_1_dob', label: 'Persona 1 — DOB', kind: 'date' },
]

const SIJS_FIELDS: SimpleFieldDef[] = [
  { key: 'declared_dependent_court', label: '2A. Dependiente de corte' },
  { key: 'state_agency_name', label: '2B. Corte / Agencia' },
  { key: 'currently_under_jurisdiction', label: '2C. Bajo jurisdicción' },
  { key: 'in_court_ordered_placement', label: '3A. En placement ordenado' },
  { key: 'reunification_not_viable_reason', label: '4. Reunificación no viable', kind: 'multiselect' },
  { key: 'best_interest_not_return', label: '5. Mejor interés no regresar', kind: 'longText' },
  { key: 'previously_hhs_custody', label: '6A. Custodia HHS' },
  { key: 'hhs_court_order', label: '6B. Orden de corte HHS', kind: 'longText' },
]

const CONTACT_FIELDS: SimpleFieldDef[] = [
  { key: 'petitioner_phone', label: 'Teléfono' },
  { key: 'petitioner_mobile', label: 'Celular' },
  { key: 'petitioner_email', label: 'Email' },
  { key: 'language_understood', label: 'Idioma' },
  { key: 'interpreter_needed', label: 'Necesita intérprete' },
  { key: 'additional_info', label: 'Información adicional', kind: 'longText' },
  { key: 'parent_names_not_viable', label: 'Nombres de los padres (no viable)', kind: 'longText' },
]

const SECTIONS: { title: string; fields: SimpleFieldDef[] }[] = [
  { title: 'Peticionario', fields: PETITIONER_FIELDS },
  { title: 'Beneficiario (menor)', fields: BENEFICIARY_FIELDS },
  { title: 'Procesamiento', fields: PROCESSING_FIELDS },
  { title: 'Familia', fields: FAMILY_FIELDS },
  { title: 'SIJS', fields: SIJS_FIELDS },
  { title: 'Contacto', fields: CONTACT_FIELDS },
]

const KNOWN_KEYS = new Set<string>(SECTIONS.flatMap((s) => s.fields.map((f) => f.key)))

export const i360SijsAdapter: FormAdapter = {
  id: 'i360_sijs',
  matches: (rec) => rec.formType === 'i360_sijs',
  toSections: (rec, ctx) => {
    const data = rec.data
    const beneficiaryName = [
      fmtText(data.beneficiary_first_name),
      fmtText(data.beneficiary_middle_name),
      fmtText(data.beneficiary_last_name),
    ]
      .filter((s) => s && s !== '(No proporcionado)')
      .join(' ')
      .trim()
    const minorName =
      beneficiaryName || ctx.getMinorName(rec.minorIndex) || 'Menor'

    const subsections: RenderSubsection[] = []
    for (const sec of SECTIONS) {
      const sub = buildSubsection(sec.title, data, sec.fields)
      if (sub) subsections.push(sub)
    }

    // Fallback: cualquier key no mapeada con valor se incluye en "Otros campos"
    const extras: RenderRow[] = []
    for (const [k, v] of Object.entries(data)) {
      if (KNOWN_KEYS.has(k)) continue
      if (isEmptyValue(v)) continue
      extras.push({ label: humanize(k), value: fmtText(v) })
    }
    if (extras.length > 0) {
      subsections.push({ title: 'Otros campos', rows: extras })
    }

    return [
      {
        id: `i360-${rec.minorIndex ?? 0}`,
        title: `I-360 SIJS — ${minorName}`,
        phase: 'i360',
        statusBadge: buildStatusBadge(rec.status, rec.updatedAt),
        filledCount: countFilled(data),
        rows: [],
        subsections,
      },
    ]
  },
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

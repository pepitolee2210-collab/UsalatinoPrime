// Adapter para el formulario I-360 SIJS llenado por el cliente
// (case_form_submissions con form_type='i360_sijs').
//
// El I-360 acá NO es el oficial USCIS — es la versión intake con narrativa de
// abuso, testigos opcionales, padres, etc. La estructura típica vive en
// i360-form-section.tsx (componente de Diana) y se documentó en memoria.

import type { FormAdapter } from '../types'
import { buildStatusBadge, fmtText } from '../formatters'
import {
  buildObjectArraySubsection,
  buildRows,
  buildSubsection,
  countFilled,
  type SimpleFieldDef,
} from './_shared'

const TOP_FIELDS: SimpleFieldDef[] = [
  { key: 'minor_full_name', label: 'Nombre completo del menor' },
  { key: 'beneficiary_full_name', label: 'Beneficiario (otra forma)' },
  { key: 'minor_dob', label: 'Fecha de nacimiento del menor', kind: 'date' },
  { key: 'minor_country', label: 'País de nacimiento' },
  { key: 'minor_location', label: 'Dirección anterior del menor' },
  { key: 'full_address', label: 'Dirección actual completa' },
  { key: 'time_in_state', label: 'Tiempo en el estado actual' },
  { key: 'a_number', label: 'Número A (Alien)' },
  { key: 'uscis_account_number', label: 'Cuenta USCIS Online' },
]

const TUTOR_FIELDS: SimpleFieldDef[] = [
  { key: 'tutor_full_name', label: 'Nombre del tutor' },
  { key: 'tutor_dob', label: 'Fecha de nacimiento del tutor', kind: 'date' },
  { key: 'tutor_phone', label: 'Teléfono del tutor' },
  { key: 'tutor_relationship', label: 'Relación con el menor' },
  { key: 'parent_consent', label: 'Consentimiento del padre/madre', kind: 'longText' },
]

const NARRATIVE_FIELDS: SimpleFieldDef[] = [
  { key: 'abuse_description', label: 'Descripción de abuso / abandono / negligencia', kind: 'longText' },
  { key: 'reunification_not_viable_reason', label: 'Razones por las que la reunificación no es viable', kind: 'multiselect' },
  { key: 'best_interest_reason', label: 'Razones por las que regresar no es lo mejor para el menor', kind: 'longText' },
]

const WITNESS_COLUMNS: SimpleFieldDef[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'relationship', label: 'Relación' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'address', label: 'Dirección' },
  { key: 'can_testify', label: '¿Puede testificar?', kind: 'longText' },
]

const PARENT_COLUMNS: SimpleFieldDef[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'relationship', label: 'Parentesco' },
  { key: 'lives_with_minor', label: 'Vive con el menor', kind: 'bool' },
  { key: 'contact_info', label: 'Contacto' },
]

export const i360SijsAdapter: FormAdapter = {
  id: 'i360_sijs',
  matches: (rec) => rec.formType === 'i360_sijs',
  toSections: (rec, ctx) => {
    const data = rec.data
    const minorName =
      fmtText(data.minor_full_name) !== '(No proporcionado)'
        ? fmtText(data.minor_full_name)
        : ctx.getMinorName(rec.minorIndex) ?? 'Menor'

    const subsections = []
    const tutorSub = buildSubsection('Tutor / Guardián', data, TUTOR_FIELDS)
    if (tutorSub) subsections.push(tutorSub)
    const narrativeSub = buildSubsection('Narrativa SIJS', data, NARRATIVE_FIELDS)
    if (narrativeSub) subsections.push(narrativeSub)
    const witnessesSub = buildObjectArraySubsection(
      'Testigos del menor',
      data.witnesses,
      WITNESS_COLUMNS,
    )
    if (witnessesSub) subsections.push(witnessesSub)
    const parentsSub = buildObjectArraySubsection(
      'Padres del menor',
      data.parents,
      PARENT_COLUMNS,
    )
    if (parentsSub) subsections.push(parentsSub)

    return [
      {
        id: `i360-${rec.minorIndex ?? 0}`,
        title: `I-360 SIJS — ${minorName}`,
        phase: 'i360',
        statusBadge: buildStatusBadge(rec.status, rec.updatedAt),
        filledCount: countFilled(data),
        rows: buildRows(data, TOP_FIELDS),
        subsections,
      },
    ]
  },
}

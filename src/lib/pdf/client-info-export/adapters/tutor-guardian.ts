// Adapter para declaración del tutor/guardián
// (case_form_submissions form_type='tutor_guardian').

import type { FormAdapter } from '../types'
import { buildStatusBadge } from '../formatters'
import {
  buildRows,
  countFilled,
  type SimpleFieldDef,
} from './_shared'

const FIELDS: SimpleFieldDef[] = [
  { key: 'full_name', label: 'Nombre completo' },
  { key: 'dob', label: 'Fecha de nacimiento', kind: 'date' },
  { key: 'minor_dob', label: 'Fecha de nacimiento del menor', kind: 'date' },
  { key: 'relationship_to_minor', label: 'Relación con el menor' },
  { key: 'minor_lives_with_since', label: 'El menor vive contigo desde' },
  { key: 'full_address', label: 'Dirección completa' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Correo electrónico' },
  { key: 'occupation', label: 'Ocupación' },
  { key: 'employer', label: 'Empleador' },
  { key: 'monthly_income', label: 'Ingreso mensual' },
  { key: 'household_size', label: 'Personas en el hogar' },
  { key: 'has_legal_status', label: 'Tiene estatus legal en USA', kind: 'bool' },
  { key: 'legal_status_detail', label: 'Detalle del estatus legal', kind: 'longText' },
  { key: 'criminal_history', label: 'Historial criminal', kind: 'longText' },
  { key: 'cps_history', label: 'Historial con CPS', kind: 'longText' },
  { key: 'declaration', label: 'Declaración jurada', kind: 'longText' },
]

export const tutorGuardianAdapter: FormAdapter = {
  id: 'tutor_guardian',
  matches: (rec) => rec.formType === 'tutor_guardian',
  toSections: (rec) => {
    return [
      {
        id: `tutor-${rec.minorIndex ?? 0}`,
        title: 'Declaración del Tutor / Guardián',
        phase: rec.phaseHint,
        statusBadge: buildStatusBadge(rec.status, rec.updatedAt),
        filledCount: countFilled(rec.data),
        rows: buildRows(rec.data, FIELDS),
      },
    ]
  },
}

// Adapter para testigos del cliente (case_form_submissions form_type='client_witnesses').
// La estructura típica es { witnesses: [{ name, phone, address, relationship, can_testify }] }.

import type { FormAdapter } from '../types'
import { buildStatusBadge } from '../formatters'
import {
  buildObjectArraySubsection,
  countFilled,
  type SimpleFieldDef,
} from './_shared'

const WITNESS_COLUMNS: SimpleFieldDef[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'relationship', label: 'Relación' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'address', label: 'Dirección' },
  { key: 'can_testify', label: '¿Qué puede testificar?', kind: 'longText' },
]

export const clientWitnessesAdapter: FormAdapter = {
  id: 'client_witnesses',
  matches: (rec) => rec.formType === 'client_witnesses',
  toSections: (rec) => {
    const data = rec.data
    const sub = buildObjectArraySubsection('Testigos', data.witnesses, WITNESS_COLUMNS)
    return [
      {
        id: `witnesses-${rec.minorIndex ?? 0}`,
        title:
          rec.minorIndex != null && rec.minorIndex > 0
            ? `Testigos — Menor ${rec.minorIndex + 1}`
            : 'Testigos',
        phase: rec.phaseHint,
        statusBadge: buildStatusBadge(rec.status, rec.updatedAt),
        filledCount: countFilled(data),
        rows: [],
        subsections: sub ? [sub] : [],
      },
    ]
  },
}

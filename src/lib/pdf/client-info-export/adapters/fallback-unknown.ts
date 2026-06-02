// Fallback adapter — siempre matchea. Se registra último en adapter-registry.ts.
// Garantiza que un form_type nuevo y no mapeado nunca rompa la generación del
// PDF: emite una sección con las keys técnicas humanizadas y un warning visible
// para que el equipo legal sepa que es legacy/no traducido.

import type { ClientInfoSection, FormAdapter, RenderRow } from '../types'
import { buildStatusBadge, fmtText, isEmptyValue } from '../formatters'
import { countFilled } from './_shared'

export const fallbackUnknownAdapter: FormAdapter = {
  id: 'fallback_unknown',
  matches: () => true,
  toSections: (rec) => {
    const rows: RenderRow[] = []
    for (const [k, v] of Object.entries(rec.data)) {
      if (isEmptyValue(v)) continue
      rows.push({ label: humanize(k), value: fmtText(v) })
    }
    const section: ClientInfoSection = {
      id: `fallback-${rec.formType}-${rec.minorIndex ?? 0}`,
      title: `Formulario: ${humanize(rec.formType)}`,
      phase: rec.phaseHint,
      statusBadge: buildStatusBadge(rec.status, rec.updatedAt),
      filledCount: countFilled(rec.data),
      rows,
      warning: `Form_type "${rec.formType}" no tiene mapeo personalizado — se muestran las claves técnicas.`,
    }
    return [section]
  },
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

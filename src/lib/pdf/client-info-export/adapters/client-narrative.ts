// Adapter para narrativas opcionales del cliente:
//  - client_story (historia del menor en SIJS)
//  - client_absent_parent (información del padre ausente en SIJS)
//
// Son form_types donde el cliente escribe en campos abiertos. Para mantener
// la UI legible, renderizamos cada key como una fila label/value, con detección
// heurística de campos largos (>120 chars o keys que contienen 'description',
// 'reason', 'detail', 'story').

import type { ClientInfoSection, FormAdapter, RenderRow } from '../types'
import { buildStatusBadge, fmtText, isEmptyValue } from '../formatters'
import { countFilled } from './_shared'

const TITLE_BY_TYPE: Record<string, string> = {
  client_story: 'Historia del menor',
  client_absent_parent: 'Padre / madre ausente',
}

const LONG_TEXT_HINTS = ['description', 'reason', 'detail', 'story', 'narrative', 'why', 'how']

export const clientNarrativeAdapter: FormAdapter = {
  id: 'client_narrative',
  matches: (rec) =>
    rec.formType === 'client_story' || rec.formType === 'client_absent_parent',
  toSections: (rec) => {
    const baseTitle = TITLE_BY_TYPE[rec.formType] ?? rec.formType
    const title =
      rec.minorIndex != null && rec.minorIndex > 0
        ? `${baseTitle} — Menor ${rec.minorIndex + 1}`
        : baseTitle

    const rows: RenderRow[] = []
    for (const [k, v] of Object.entries(rec.data)) {
      if (isEmptyValue(v)) continue
      const isLong = isLongTextKey(k) || (typeof v === 'string' && v.length > 120)
      rows.push({
        label: humanize(k),
        value: isLong ? String(v).trim() : fmtText(v),
        kind: isLong ? 'longText' : 'scalar',
      })
    }

    const section: ClientInfoSection = {
      id: `${rec.formType}-${rec.minorIndex ?? 0}`,
      title,
      phase: rec.phaseHint,
      statusBadge: buildStatusBadge(rec.status, rec.updatedAt),
      filledCount: countFilled(rec.data),
      rows,
    }
    return [section]
  },
}

function isLongTextKey(key: string): boolean {
  const lower = key.toLowerCase()
  return LONG_TEXT_HINTS.some((h) => lower.includes(h))
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

// Adapter genérico para case_form_instances (forms del registry AUTOMATED_FORMS).
//
// Renderiza filled_values usando los labels en español del FIELD_BY_KEY del slug.
// El acroform_schema de cada form tiene secciones (sections) con campos —
// el adapter respeta esa agrupación para producir un PDF coherente con la UI
// del modal Diana/Henry usa para editar.
//
// Cuando un key existe en filled_values pero NO en fieldByKey (form schema
// versión vieja, o campo legacy), se renderiza con el key humanizado y un
// warning a nivel sección.

import type { ClientInfoSection, FormAdapter, RenderRow, RenderSubsection } from '../types'
import { buildStatusBadge, fmtBool, fmtDate, fmtText, isEmptyValue, resolveOptionLabel } from '../formatters'
import { countFilled } from './_shared'

interface SchemaField {
  semanticKey: string
  labelEs?: string
  type?: string
  options?: { value: string; labelEs: string }[]
}

interface SchemaSection {
  titleEs?: string
  fields: SchemaField[]
}

export const acroformInstanceAdapter: FormAdapter = {
  id: 'acroform_instance',
  matches: (rec) => rec.source === 'case_form_instances',
  toSections: (rec, ctx) => {
    const data = rec.data
    const slugKey = rec.formSlug ?? rec.formName ?? ''
    const fieldByKey = ctx.getRegistryFieldByKey(slugKey)

    if (!fieldByKey) {
      return [unmappedSection(rec, data)]
    }

    // Buscar las secciones del registry para agrupar — fall back a una sola sección.
    const registrySections = lookupSections(slugKey, fieldByKey)
    let subsections: RenderSubsection[] | undefined
    const filledKeys = new Set(Object.keys(data).filter((k) => !isEmptyValue(data[k])))
    let warning: string | undefined

    if (registrySections && registrySections.length > 0) {
      subsections = []
      for (const sec of registrySections) {
        const rows: RenderRow[] = []
        for (const f of sec.fields) {
          const raw = data[f.semanticKey]
          if (isEmptyValue(raw)) continue
          rows.push(toRow(f, raw))
          filledKeys.delete(f.semanticKey)
        }
        if (rows.length > 0) {
          subsections.push({ title: sec.titleEs ?? 'Sección', rows })
        }
      }
      // Campos guardados que NO están en ninguna sección del schema vigente.
      if (filledKeys.size > 0) {
        const extras: RenderRow[] = []
        for (const k of filledKeys) {
          const def = fieldByKey[k]
          if (def) extras.push(toRow(def, data[k]))
          else extras.push({ label: humanize(k), value: fmtText(data[k]) })
        }
        if (extras.length > 0) {
          subsections.push({ title: 'Otros campos', rows: extras })
          warning = 'Algunos campos del schema vigente no aparecen agrupados — se incluyen al final.'
        }
      }
    } else {
      // Sin secciones: render plano usando solo los keys con valor
      const rows: RenderRow[] = []
      for (const k of filledKeys) {
        const def = fieldByKey[k]
        rows.push(def ? toRow(def, data[k]) : { label: humanize(k), value: fmtText(data[k]) })
      }
      subsections = [{ title: 'Valores del formulario', rows }]
    }

    const baseTitle = rec.formName ?? slugKey
    return [
      {
        id: `instance-${rec.formSlug ?? rec.formName ?? rec.formType}`,
        title: baseTitle,
        phase: rec.phaseHint,
        statusBadge: buildStatusBadge(rec.status, rec.updatedAt),
        filledCount: countFilled(data),
        rows: [],
        subsections,
        warning,
      },
    ]
  },
}

function unmappedSection(
  rec: Parameters<FormAdapter['toSections']>[0],
  data: Record<string, unknown>,
): ClientInfoSection {
  const rows: RenderRow[] = []
  for (const [k, v] of Object.entries(data)) {
    if (isEmptyValue(v)) continue
    rows.push({ label: humanize(k), value: fmtText(v) })
  }
  return {
    id: `instance-${rec.formSlug ?? rec.formName ?? rec.formType}`,
    title: rec.formName ?? rec.formType,
    phase: rec.phaseHint,
    statusBadge: buildStatusBadge(rec.status, rec.updatedAt),
    filledCount: countFilled(data),
    rows,
    warning: 'Sin mapeo de etiquetas — se muestran las claves técnicas.',
  }
}

function toRow(field: SchemaField, raw: unknown): RenderRow {
  const label = field.labelEs ?? humanize(field.semanticKey)
  let value: string
  switch (field.type) {
    case 'date':
      value = fmtDate(raw)
      break
    case 'checkbox':
      value = fmtBool(raw)
      break
    case 'select':
      value = resolveOptionLabel(String(raw), field.options)
      break
    case 'textarea':
      value = fmtText(raw)
      return { label, value, kind: 'longText' }
    default:
      value = fmtText(raw)
  }
  return { label, value, kind: 'scalar' }
}

/**
 * Resuelve las secciones del schema del registry para un slug. Hace una
 * importación dinámica perezosa para evitar pull-in de Zod en código no-server.
 *
 * Devolvemos un tipo ligero `SchemaSection[]` para mantener desacoplados los
 * tipos del registry de los nuestros.
 */
function lookupSections(
  slug: string,
  fieldByKey: Record<string, { semanticKey: string; labelEs: string; type: string; options?: { value: string; labelEs: string }[] }>,
): SchemaSection[] | null {
  // El registry es síncrono en tiempo de bundle — lo importamos directo. Si el
  // import falla (ej. tree-shake agresivo), caemos a una única sección con todo.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const registry = require('@/lib/legal/automated-forms-registry') as {
      AUTOMATED_FORMS: Record<string, { sections?: { titleEs?: string; fields: SchemaField[] }[] }>
    }
    const def = registry.AUTOMATED_FORMS[slug]
    if (def?.sections && def.sections.length > 0) {
      return def.sections.map((s) => ({
        titleEs: s.titleEs,
        fields: (s.fields ?? []).filter((f) => !!fieldByKey[f.semanticKey]),
      }))
    }
  } catch {
    // Continúa con fallback
  }
  return null
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

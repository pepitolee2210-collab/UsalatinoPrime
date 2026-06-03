'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getWorkflow } from '@/lib/workflows'
import { evaluateCondition } from '@/lib/wizard/conditions'
import type { WorkflowField } from '@/types/wizard'

const fieldLabels: Record<string, string> = {
  spouse_dob: 'Fecha de nacimiento',
  spouse_in_us: 'En EE.UU.',
  marriage_date: 'Fecha de matrimonio',
  spouse_gender: 'Sexo',
  marriage_place: 'Lugar de matrimonio',
  spouse_a_number: 'Número A',
  spouse_last_name: 'Apellido',
  spouse_first_name: 'Nombre',
  spouse_middle_name: 'Segundo nombre',
  spouse_nationality: 'Nacionalidad',
  spouse_immigration_status: 'Estatus migratorio',
  spouse_include_in_application: 'Incluir en solicitud',
  child_dob: 'Fecha de nacimiento',
  child_in_us: 'En EE.UU.',
  child_gender: 'Sexo',
  child_last_name: 'Apellido',
  child_first_name: 'Nombre',
  child_nationality: 'Nacionalidad',
  child_marital_status: 'Soltero/a',
  child_country_of_birth: 'País de nacimiento',
  child_include_in_application: 'Incluir en solicitud',
  res_to: 'Hasta',
  res_from: 'Desde',
  res_city: 'Ciudad',
  res_address: 'Dirección',
  res_country: 'País',
  res_state: 'Estado',
  emp_to: 'Hasta',
  emp_from: 'Desde',
  emp_address: 'Dirección',
  emp_employer: 'Empleador',
  emp_occupation: 'Ocupación',
  edu_to: 'Hasta',
  edu_from: 'Desde',
  edu_type: 'Tipo',
  edu_school: 'Escuela',
  edu_location: 'Ubicación',
}

function getLabel(key: string): string {
  return fieldLabels[key] || key
}

interface CaseFormViewerProps {
  serviceSlug: string
  formData: Record<string, unknown>
}

export function CaseFormViewer({ serviceSlug, formData }: CaseFormViewerProps) {
  const workflow = getWorkflow(serviceSlug)
  if (!workflow) return <p>Workflow no encontrado</p>

  const formSteps = workflow.steps.filter((s) => s.fields && s.fields.length > 0)

  function formatLeafValue(v: unknown): string {
    if (v === undefined || v === null || v === '') return '\u2014'
    if (typeof v === 'boolean') return v ? 'S\u00ed' : 'No'
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
      try {
        const d = new Date(v)
        if (!isNaN(d.getTime())) return d.toLocaleDateString('es-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
      } catch { /* fall through */ }
    }
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>
      if ('year' in obj && 'month' in obj && Object.keys(obj).length === 2) {
        return `${String(obj.month).padStart(2, '0')}/${obj.year}`
      }
      return Object.entries(obj).map(([k, val]) => `${getLabel(k)}: ${formatLeafValue(val)}`).join(', ')
    }
    return String(v)
  }

  function renderValue(field: WorkflowField, value: unknown): React.ReactNode {
    if (value === undefined || value === null || value === '') return <span className="text-[var(--admin-fg-subtle)]">&mdash;</span>
    if (typeof value === 'boolean') return value ? 'S\u00ed' : 'No'
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-[var(--admin-fg-subtle)]">&mdash;</span>
      if (typeof value[0] === 'object') {
        return (
          <div className="space-y-2">
            {value.map((entry: any, i: number) => (
              <div key={i} className="bg-[var(--admin-accent-soft)] rounded p-2 text-xs">
                {Object.entries(entry).map(([k, v]) => (
                  <div key={k}><span className="text-[var(--admin-fg-muted)]">{getLabel(k)}:</span> {formatLeafValue(v)}</div>
                ))}
              </div>
            ))}
          </div>
        )
      }
      return value.join(', ')
    }
    if (typeof value === 'object') {
      return (
        <div className="bg-[var(--admin-accent-soft)] rounded p-2 text-xs">
          {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
            <div key={k}><span className="text-[var(--admin-fg-muted)]">{getLabel(k)}:</span> {formatLeafValue(v)}</div>
          ))}
        </div>
      )
    }
    return String(value)
  }

  return (
    <div className="space-y-4">
      {formSteps.map((step) => (
        <Card key={step.step}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[var(--admin-fg)]">
              Paso {step.step}: {step.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {step.fields!.map((field) => {
                if (!evaluateCondition(field.conditional, formData)) return null
                const value = formData[field.key]
                return (
                  <div key={field.key} className="grid grid-cols-1 md:grid-cols-3 gap-1 py-1 border-b border-[var(--admin-border)] last:border-0">
                    <span className="text-xs text-[var(--admin-fg-muted)]">{field.label}</span>
                    <div className="md:col-span-2 text-sm font-medium">
                      {renderValue(field, value)}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

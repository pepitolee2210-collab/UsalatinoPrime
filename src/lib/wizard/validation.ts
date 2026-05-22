import type { WorkflowStep } from '@/types/wizard'
import { evaluateCondition } from './conditions'

export interface ValidationError {
  key: string
  message: string
}

export function validateStep(
  step: WorkflowStep,
  formData: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = []

  if (!step.fields) return errors

  for (const field of step.fields) {
    // Skip fields whose condition is not met
    if (!evaluateCondition(field.conditional, formData)) continue

    const value = formData[field.key]

    // Required check
    if (field.required) {
      if (value === undefined || value === null || value === '') {
        errors.push({ key: field.key, message: `${field.label} es obligatorio` })
        continue
      }
      if (Array.isArray(value) && value.length === 0) {
        errors.push({ key: field.key, message: `${field.label} es obligatorio` })
        continue
      }
    }

    // Skip further validation if empty and not required
    if (value === undefined || value === null || value === '') continue

    // Min length for long_text
    if (field.min_length && typeof value === 'string' && value.length < field.min_length) {
      errors.push({
        key: field.key,
        message: `${field.label} debe tener al menos ${field.min_length} caracteres`,
      })
    }

    // Min selections for multi_select
    if (field.min_selections && Array.isArray(value) && value.length < field.min_selections) {
      errors.push({
        key: field.key,
        message: `Debe seleccionar al menos ${field.min_selections} opción(es)`,
      })
    }

    // Validate subfields for repeatable_group
    if (field.type === 'repeatable_group' && Array.isArray(value) && field.subfields) {
      value.forEach((entry: Record<string, unknown>, index: number) => {
        for (const subfield of field.subfields!) {
          if (subfield.required) {
            const subValue = entry[subfield.key]
            if (subValue === undefined || subValue === null || subValue === '') {
              errors.push({
                key: `${field.key}[${index}].${subfield.key}`,
                message: `${subfield.label} es obligatorio (entrada ${index + 1})`,
              })
            }
          }
        }
      })
    }

    // Validate subfields for spouse_form
    if (field.type === 'spouse_form' && typeof value === 'object' && value !== null && field.subfields) {
      const spouseData = value as Record<string, unknown>
      for (const subfield of field.subfields) {
        if (subfield.required) {
          const subValue = spouseData[subfield.key]
          if (subValue === undefined || subValue === null || subValue === '') {
            errors.push({
              key: `${field.key}.${subfield.key}`,
              message: `${subfield.label} es obligatorio`,
            })
          }
        }
      }
    }
  }

  return errors
}

export function isStepComplete(
  step: WorkflowStep,
  formData: Record<string, unknown>
): boolean {
  return validateStep(step, formData).length === 0
}

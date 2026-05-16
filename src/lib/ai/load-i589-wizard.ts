import { createServiceClient } from '@/lib/supabase/service'

/**
 * Carga las 4 submissions del wizard I-589 Parte A (que el cliente llena
 * en su portal `/cita/[token]`) y las mergea en un único objeto plano
 * `{ wizardKey: value }`.
 *
 * Source of truth: tabla `case_form_submissions` con
 * `form_type IN ('i589_part_a1'..'a4')`. Es la columna donde
 * `FasesScreen` persiste los datos del wizard, NO la columna legacy
 * `cases.form_data`.
 *
 * Se usa para alimentar prompts AI (Miedo Creíble, futuras automatizaciones)
 * y NO debe confundirse con `buildPartAValues()` de
 * `src/lib/pdf/i589-official/generate-i589-part-a.ts`, que traduce los
 * wizardKeys a nombres de fields AcroForm del PDF oficial USCIS.
 */
export async function loadI589WizardData(
  caseId: string,
): Promise<Record<string, unknown>> {
  const service = createServiceClient()
  const { data } = await service
    .from('case_form_submissions')
    .select('form_type, form_data')
    .eq('case_id', caseId)
    .in('form_type', ['i589_part_a1', 'i589_part_a2', 'i589_part_a3', 'i589_part_a4'])

  const merged: Record<string, unknown> = {}
  for (const row of data ?? []) {
    Object.assign(merged, (row.form_data ?? {}) as Record<string, unknown>)
  }
  return merged
}

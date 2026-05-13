import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity, SUBCATEGORIES } from '@/lib/activity/log-activity'
import type { CasePhase } from '@/types/database'

/**
 * Helper centralizado para crear cases.
 *
 * Esta es la ÚNICA forma correcta de insertar en `cases` desde el código:
 * exige `contractId` para que cada case nazca vinculado a un contrato firmado.
 * Eso garantiza la regla "1 contrato = 1 case" del schema y cierra el agujero
 * que generó cases huérfanos en el portal viejo (eliminado con esta misma
 * tanda de cambios).
 *
 * Si en el futuro se necesita crear un case sin contrato (ej. lead que aún
 * no firmó), agregar un overload explícito y bien justificado aquí — pero
 * NO insertar directamente con `.from('cases').insert(...)` desde otro lado
 * del código.
 */

export interface CreateCaseInput {
  /** Contrato firmado al que pertenece el case (1:1, obligatorio). */
  contractId: string
  /** Profile cliente dueño del case. */
  clientId: string
  /** Service del catálogo (UUID). */
  serviceId: string
  /** Costo total acordado en el contrato. 0 si todavía no se sabe. */
  totalCost: number
  /** Solo aplica a Visa Juvenil; otros servicios usan null. */
  startingPhase?: CasePhase | null
  /** intake_status inicial; default 'in_progress'. */
  intakeStatus?: string
  /** form_data inicial; default vacío. */
  formData?: Record<string, unknown>
}

export interface CreatedCase {
  id: string
  case_number: string
}

export async function createCaseForContract(
  input: CreateCaseInput,
  client: SupabaseClient = createServiceClient(),
): Promise<CreatedCase> {
  if (!input.contractId) {
    throw new Error('createCaseForContract: contractId es obligatorio')
  }
  if (!input.clientId) {
    throw new Error('createCaseForContract: clientId es obligatorio')
  }
  if (!input.serviceId) {
    throw new Error('createCaseForContract: serviceId es obligatorio')
  }

  const insertPayload: Record<string, unknown> = {
    client_id: input.clientId,
    service_id: input.serviceId,
    total_cost: input.totalCost,
    intake_status: input.intakeStatus ?? 'in_progress',
    form_data: input.formData ?? {},
    current_step: 0,
    contract_id: input.contractId,
  }
  if (input.startingPhase) {
    insertPayload.process_start = input.startingPhase
    insertPayload.current_phase = input.startingPhase
  }

  const { data, error } = await client
    .from('cases')
    .insert(insertPayload)
    .select('id, case_number')
    .single()

  if (error || !data) {
    throw new Error(`createCaseForContract failed: ${error?.message ?? 'no row returned'}`)
  }

  // Vincular bidireccionalmente: cada case nuevo apunta a su contrato y el
  // contrato apunta al case.
  const { error: linkErr } = await client
    .from('contracts')
    .update({ client_id: input.clientId, case_id: data.id })
    .eq('id', input.contractId)

  if (linkErr) {
    throw new Error(`createCaseForContract link failed: ${linkErr.message}`)
  }

  // Bitácora: caso creado. Actor 'system' porque este helper se llama
  // desde varios entrypoints (register-client, voice-agent, scripts).
  await logActivity({
    caseId: data.id,
    category: 'case',
    subcategory: SUBCATEGORIES.CASE_CREATED,
    description: `Caso ${data.case_number} creado a partir del contrato`,
    metadata: {
      contract_id: input.contractId,
      starting_phase: input.startingPhase ?? null,
      total_cost: input.totalCost,
    },
    visibleToClient: false,
    actor: { kind: 'system', label: 'Registro de contrato' },
    client,
  })

  return { id: data.id, case_number: data.case_number }
}

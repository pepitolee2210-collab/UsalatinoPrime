// Bitácora del caso — helper centralizado para registrar eventos en
// `case_activity`. Reemplaza inserts ad-hoc dispersos por el codebase.
//
// REGLA DE ORO sobre `metadata`: solo IDs, timestamps, hashes y flags.
// NUNCA PII en crudo:
//   ❌ signature_image (base64), form_data, contenido de cartas
//   ✅ contract_id, document_id, signed_at, pdf_sha256, from_phase/to_phase
//
// El helper es **fire-and-forget**: jamás tira al caller. Si la BD
// rechaza el insert o un lookup falla, lo loguea a stderr y devuelve
// `null`. La bitácora con un evento menos es preferible a un endpoint
// roto.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { createLogger } from '@/lib/logger'

const log = createLogger('activity')

// ─────────────────────────── Tipos públicos ───────────────────────────

export type EventCategory =
  | 'case'
  | 'contract'
  | 'appointment'
  | 'document'
  | 'form'
  | 'payment'
  | 'system'
  | 'communication'

export type ActorRole = 'admin' | 'employee' | 'client' | 'system'

// Catálogo de subcategorías conocidas. Convención `${category}.${verb}`.
// Mantener este objeto sincronizado con `SUBCATEGORY_LABELS_ES` y
// `SUBCATEGORY_ICONS` en el componente UI.
export const SUBCATEGORIES = {
  // case
  CASE_CREATED: 'case.created',
  CASE_PHASE_CHANGED: 'case.phase_changed',
  CASE_STATUS_CHANGED: 'case.status_changed',
  CASE_EMPLOYEE_ASSIGNED: 'case.employee_assigned',
  CASE_NOTE_UPDATED: 'case.note_updated',
  // contract
  CONTRACT_GENERATED: 'contract.generated',
  CONTRACT_LINK_CREATED: 'contract.signing_link_created',
  CONTRACT_SIGNED: 'contract.signed',
  // appointment
  APPT_SCHEDULED: 'appointment.scheduled',
  APPT_RESCHEDULED: 'appointment.rescheduled',
  APPT_CANCELLED: 'appointment.cancelled',
  APPT_COMPLETED: 'appointment.completed',
  APPT_NO_SHOW: 'appointment.no_show',
  APPT_OBJECTIVE_NOT_COMPLETED: 'appointment.objective_not_completed',
  // notes (categoría 'communication')
  NOTE_CREATED: 'communication.note_created',
  NOTE_UPDATED: 'communication.note_updated',
  NOTE_DELETED: 'communication.note_deleted',
  // document
  DOC_UPLOADED_CLIENT: 'document.uploaded_by_client',
  DOC_UPLOADED_STAFF: 'document.uploaded_by_staff',
  DOC_APPROVED: 'document.approved',
  DOC_REJECTED: 'document.rejected',
  DOC_DELIVERED_CLIENT: 'document.delivered_to_client',
  DOC_ARCHIVED: 'document.archived',
  // form
  FORM_SUBMITTED_CLIENT: 'form.submitted_by_client',
  FORM_LOCKED: 'form.locked_for_print',
  FORM_PDF_GENERATED: 'form.pdf_generated',
  // payment
  PAYMENT_MARKED_PAID: 'payment.marked_paid',
  PAYMENT_PLAN_CREATED: 'payment.plan_created',
  // system
  SYSTEM_ACCESS_TOGGLED: 'system.access_toggled',
  SYSTEM_INTAKE_CHANGED: 'system.intake_status_changed',
} as const

export type KnownSubcategory = (typeof SUBCATEGORIES)[keyof typeof SUBCATEGORIES]

export type ActorInput =
  | { kind: 'session'; supabase: SupabaseClient }
  | { kind: 'token'; tokenType: 'contract' | 'cita'; clientId?: string }
  | { kind: 'system'; label?: string }

export interface LogActivityInput {
  caseId: string
  category: EventCategory
  subcategory: string // usar `SUBCATEGORIES.*` cuando aplique
  description: string // español, human-readable
  metadata?: Record<string, unknown>
  visibleToClient?: boolean // default false (bitácora interna)
  actor: ActorInput
  /**
   * Cliente Supabase a reutilizar para el INSERT. Típicamente el
   * `createServiceClient()` que ya tienes en el endpoint. Si no se
   * pasa, el helper crea uno propio.
   */
  client?: SupabaseClient
  /**
   * Si está presente, el helper verifica que no exista un evento
   * previo con `metadata->>'idempotency_key' = idempotencyKey` antes
   * de insertar. Útil para webhooks con retry (Stripe).
   */
  idempotencyKey?: string
}

// ─────────────────────────── Resolución del actor ───────────────────────────

interface ResolvedActor {
  actor_id: string | null
  actor_role: ActorRole
  actor_label: string
}

async function resolveSessionActor(supabase: SupabaseClient): Promise<ResolvedActor> {
  const fallback: ResolvedActor = { actor_id: null, actor_role: 'system', actor_label: 'Sistema' }
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fallback

    // Usamos el mismo client para leer el perfil — respeta RLS pero
    // `profiles` permite a cada user leer su propio row.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, first_name, last_name')
      .eq('id', user.id)
      .single()

    const role = (profile?.role as ActorRole | undefined) ?? 'system'
    const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
    return {
      actor_id: user.id,
      actor_role: role,
      actor_label: fullName || (user.email ?? 'Usuario sin nombre'),
    }
  } catch (err) {
    log.warn('No se pudo resolver actor de sesión', err)
    return fallback
  }
}

async function resolveTokenActor(
  service: SupabaseClient,
  tokenType: 'contract' | 'cita',
  clientId?: string,
): Promise<ResolvedActor> {
  const defaultLabel = tokenType === 'contract' ? 'Cliente (vía firma)' : 'Cliente (vía cita)'
  if (!clientId) {
    return { actor_id: null, actor_role: 'client', actor_label: defaultLabel }
  }
  try {
    const { data: profile } = await service
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', clientId)
      .single()
    const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
    return {
      actor_id: null, // sin auth.uid() en flujo token-based
      actor_role: 'client',
      actor_label: fullName ? `${fullName} (cliente)` : defaultLabel,
    }
  } catch {
    return { actor_id: null, actor_role: 'client', actor_label: defaultLabel }
  }
}

function resolveSystemActor(label?: string): ResolvedActor {
  return { actor_id: null, actor_role: 'system', actor_label: label ?? 'Sistema' }
}

// ─────────────────────────── API pública ───────────────────────────

/**
 * Registra un evento en la bitácora del caso. Fire-and-forget: nunca
 * tira al caller. Llamar DESPUÉS de la mutación principal exitosa.
 *
 * @example
 *   await logActivity({
 *     caseId: case.id,
 *     category: 'contract',
 *     subcategory: SUBCATEGORIES.CONTRACT_SIGNED,
 *     description: 'El cliente firmó el contrato',
 *     metadata: { contract_id: contract.id, signed_at: now },
 *     visibleToClient: true,
 *     actor: { kind: 'token', tokenType: 'contract', clientId: contract.client_id },
 *     client: service,
 *   })
 */
export async function logActivity(input: LogActivityInput): Promise<{ id: string } | null> {
  try {
    const service: SupabaseClient = input.client ?? createServiceClient()

    // Resolver actor.
    let resolved: ResolvedActor
    if (input.actor.kind === 'session') {
      resolved = await resolveSessionActor(input.actor.supabase)
    } else if (input.actor.kind === 'token') {
      resolved = await resolveTokenActor(service, input.actor.tokenType, input.actor.clientId)
    } else {
      resolved = resolveSystemActor(input.actor.label)
    }

    // Idempotency: si key provista, abortar si ya existe.
    let metadata: Record<string, unknown> = input.metadata ? { ...input.metadata } : {}
    if (input.idempotencyKey) {
      metadata = { ...metadata, idempotency_key: input.idempotencyKey }
      const { data: existing } = await service
        .from('case_activity')
        .select('id')
        .eq('case_id', input.caseId)
        .filter('metadata->>idempotency_key', 'eq', input.idempotencyKey)
        .limit(1)
        .maybeSingle()
      if (existing?.id) {
        return { id: existing.id as string }
      }
    }

    const row = {
      case_id: input.caseId,
      actor_id: resolved.actor_id,
      action: input.subcategory, // legacy column — mantenemos compat
      description: input.description,
      metadata,
      visible_to_client: input.visibleToClient ?? false,
      event_category: input.category,
      event_subcategory: input.subcategory,
      actor_role: resolved.actor_role,
      actor_label: resolved.actor_label,
    }

    const { data, error } = await service
      .from('case_activity')
      .insert(row)
      .select('id')
      .single()

    if (error) {
      log.error('Insert a case_activity falló', { error: error.message, row })
      return null
    }
    return { id: data!.id as string }
  } catch (err) {
    log.error('logActivity excepción', err)
    return null
  }
}

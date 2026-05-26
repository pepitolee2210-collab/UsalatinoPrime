/**
 * Sistema de eventos custom para que las tools de Lex (que viven en el agente
 * de voz) puedan disparar acciones en la UI de /employee/contratos sin tener
 * que prop-drill callbacks. Los componentes (ContratosView, Lex agent, etc.)
 * suscriben con `onLexEvent(type, handler)` y reciben payloads tipados.
 *
 * Patrón inspirado en el sistema de eventos de la landing (lex en el showcase).
 */

export type LexEvent =
  | { type: 'lex:close' }
  | { type: 'lex:highlightContract'; payload: { contractId: string } }
  | { type: 'lex:openNewContract'; payload: { prefill?: Record<string, unknown> } }
  | { type: 'lex:refreshContracts' }
  | { type: 'lex:scrollToContract'; payload: { contractId: string } }
  | { type: 'lex:notify'; payload: { kind: 'success' | 'info' | 'error'; message: string } }

type LexEventType = LexEvent['type']
type LexEventPayload<T extends LexEventType> = Extract<LexEvent, { type: T }> extends { payload: infer P }
  ? P
  : undefined

const listeners = new Map<LexEventType, Set<(payload: unknown) => void>>()

export function onLexEvent<T extends LexEventType>(
  type: T,
  handler: (payload: LexEventPayload<T>) => void,
): () => void {
  let set = listeners.get(type)
  if (!set) {
    set = new Set()
    listeners.set(type, set)
  }
  const wrapped = (payload: unknown) => handler(payload as LexEventPayload<T>)
  set.add(wrapped)
  return () => {
    set?.delete(wrapped)
  }
}

export function dispatchLexEvent<T extends LexEventType>(
  type: T,
  ...args: LexEventPayload<T> extends undefined ? [] : [LexEventPayload<T>]
): void {
  const set = listeners.get(type)
  if (!set) return
  const payload = args[0]
  set.forEach((handler) => {
    try {
      handler(payload)
    } catch (err) {
      console.error(`[lex-events] handler error for ${type}:`, err)
    }
  })
}

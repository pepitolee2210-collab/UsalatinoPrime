'use client'

// ──────────────────────────────────────────────────────────────────────────
// useAutosave — autoguardado robusto y reutilizable para el portal del cliente
// ──────────────────────────────────────────────────────────────────────────
//
// Encapsula el guardado a prueba de pérdidas que antes vivía solo en FormRunner,
// para que TODOS los formularios y wizards del portal lo compartan:
//
//   1. Debounce: agrupa cambios y guarda tras `debounceMs` de inactividad.
//   2. Buffer de pendientes: el último estado sin confirmar se guarda íntegro;
//      si el guardado falla (red intermitente), queda pendiente y se reintenta
//      en el próximo `schedule`/`flush` — no se pierde.
//   3. flush(): fuerza el guardado YA (al navegar entre pasos, cerrar o enviar).
//   4. Redes de seguridad: `beforeunload` (escritorio + aviso nativo) y
//      `visibilitychange→hidden` (el evento fiable en móvil: cambiar de app,
//      bloquear pantalla) persisten lo pendiente con `fetch keepalive`.
//
// Es agnóstico al endpoint: cada componente provee `save(data)` (su POST/PUT) y
// opcionalmente `beacon(data)` (cómo persistir con keepalive al cerrar). Trabaja
// en modo "snapshot": en cada cambio se pasa el estado completo a `schedule`.

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface BeaconRequest {
  url: string
  method?: 'POST' | 'PUT'
  body: string
}

export interface UseAutosaveOptions<S> {
  /** Persiste el estado dado. La implementa el componente (su POST/PUT). true = OK. */
  save: (data: S) => Promise<boolean>
  /**
   * Opcional: cómo persistir el estado con `keepalive` al cerrar pestaña / cambiar
   * de app. Devuelve una o varias peticiones (ej. client-story guarda 2 endpoints),
   * o null si no hay nada que enviar.
   */
  beacon?: (data: S) => BeaconRequest[] | null
  /** Retardo del debounce en ms. Default 800. */
  debounceMs?: number
  /** Si false, no guarda (ej. formulario bloqueado por el equipo legal). Default true. */
  enabled?: boolean
}

export interface AutosaveController<S> {
  /** Llamar en CADA cambio con el estado completo nuevo. Programa el guardado. */
  schedule: (data: S) => void
  /** Guarda YA lo pendiente (cancela el debounce). true si quedó todo guardado. */
  flush: () => Promise<boolean>
  /** Estado para mostrar un badge "Guardando…/Guardado". */
  saveState: AutosaveState
}

export function useAutosave<S>(opts: UseAutosaveOptions<S>): AutosaveController<S> {
  const { debounceMs = 800 } = opts
  const [saveState, setSaveState] = useState<AutosaveState>('idle')

  // Refs para que los listeners (beforeunload/visibilitychange) y el debounce
  // siempre vean la versión más reciente sin re-suscribirse en cada cambio.
  const optsRef = useRef(opts)
  optsRef.current = opts
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Último estado escrito por el usuario que aún NO se ha confirmado en el server.
  const pendingRef = useRef<{ data: S } | null>(null)

  const flush = useCallback(async (): Promise<boolean> => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    const pending = pendingRef.current
    if (!pending) return true
    if (optsRef.current.enabled === false) return true
    setSaveState('saving')
    try {
      const ok = await optsRef.current.save(pending.data)
      if (!ok) throw new Error('save returned false')
      // Solo limpiar si no llegó un cambio más nuevo mientras guardábamos.
      if (pendingRef.current === pending) pendingRef.current = null
      setSaveState(pendingRef.current ? 'idle' : 'saved')
      return true
    } catch {
      setSaveState((prev) => {
        // Avisar al cliente una sola vez al entrar en error (no en cada reintento).
        if (prev !== 'error') toast.error('No se pudo guardar. Lo reintentaremos al continuar.')
        return 'error'
      })
      return false
    }
  }, [])

  const schedule = useCallback(
    (data: S) => {
      if (optsRef.current.enabled === false) return
      pendingRef.current = { data }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => { void flush() }, debounceMs)
    },
    [flush, debounceMs],
  )

  useEffect(() => {
    function persist() {
      const pending = pendingRef.current
      if (!pending || optsRef.current.enabled === false) return
      const reqs = optsRef.current.beacon?.(pending.data)
      if (!reqs || reqs.length === 0) return
      for (const r of reqs) {
        try {
          fetch(r.url, {
            method: r.method ?? 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: r.body,
            keepalive: true,
          })
        } catch { /* best-effort */ }
      }
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!pendingRef.current || optsRef.current.enabled === false) return
      persist()
      e.preventDefault()
      e.returnValue = ''
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') persist()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      // Al desmontar (ej. el padre cierra el modal del wizard) persistimos lo
      // pendiente con keepalive — cubre wizards que se cierran desde fuera y no
      // tienen su propio onClose para llamar flush().
      persist()
    }
  }, [])

  return { schedule, flush, saveState }
}

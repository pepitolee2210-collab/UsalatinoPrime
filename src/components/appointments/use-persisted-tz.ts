'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Hook que sincroniza la TZ "de visualización" del operador entre la UI
 * y `localStorage`. Usa `useSyncExternalStore` para evitar el patrón
 * `useEffect` + `setState` que dispara warnings de cascading renders, y
 * para que un cambio en otra pestaña se refleje automáticamente vía el
 * evento `storage`.
 */
export function usePersistedTimezone(key: string, defaultTz: string): [string, (next: string) => void] {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === 'undefined') return () => {}
      window.addEventListener('storage', callback)
      return () => window.removeEventListener('storage', callback)
    },
    [],
  )
  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return defaultTz
    try {
      return window.localStorage.getItem(key) || defaultTz
    } catch {
      return defaultTz
    }
  }, [key, defaultTz])
  const getServerSnapshot = useCallback(() => defaultTz, [defaultTz])

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setValue = useCallback(
    (next: string) => {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(key, next)
        // useSyncExternalStore solo refresca cuando otra pestaña dispara
        // `storage`. Para esta pestaña forzamos el evento manualmente.
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: next }))
      } catch {
        /* incógnito o cuota llena — la UI queda con el valor previo */
      }
    },
    [key],
  )

  return [value, setValue]
}

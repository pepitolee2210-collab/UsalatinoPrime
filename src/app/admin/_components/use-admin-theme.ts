'use client'

import { useEffect, useState } from 'react'

/**
 * Hook que gestiona el tema visual del admin (dark | institutional | light).
 *
 * El tema se aplica como `data-admin-theme` en el root del layout admin
 * y todos los componentes con `var(--admin-*)` se actualizan
 * automáticamente vía CSS variables.
 *
 * Persiste en localStorage con la clave `ulp-admin-theme`. Default: dark.
 */

export type AdminTheme = 'dark' | 'institutional' | 'light'

export const ADMIN_THEMES: AdminTheme[] = ['dark', 'institutional', 'light']

const STORAGE_KEY = 'ulp-admin-theme'
const DEFAULT_THEME: AdminTheme = 'dark'

function readStoredTheme(): AdminTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'institutional' || stored === 'light') {
      return stored
    }
  } catch {}
  return DEFAULT_THEME
}

export function useAdminTheme() {
  const [theme, setThemeState] = useState<AdminTheme>(DEFAULT_THEME)

  // Al montar, leer el tema guardado y aplicarlo al root.
  useEffect(() => {
    const stored = readStoredTheme()
    setThemeState(stored)
    applyTheme(stored)
  }, [])

  function setTheme(next: AdminTheme) {
    setThemeState(next)
    // Activamos un flag durante 350ms para que el CSS aplique transition
    // SOLO durante el cambio de tema (no en cada hover/focus). En mobile
    // el flag no surte efecto — el switch es instantáneo (mejor perf).
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme-switching', '')
      window.setTimeout(() => {
        document.documentElement.removeAttribute('data-theme-switching')
      }, 350)
    }
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }

  return { theme, setTheme }
}

function applyTheme(theme: AdminTheme) {
  if (typeof document === 'undefined') return
  // Aplicamos el atributo al div del layout admin Y al <html> para que
  // portals (Radix Sheet/Dialog/etc) también hereden los tokens
  // var(--admin-*) — sin esto, el menú mobile queda sin tokens y se ve
  // transparente.
  const adminRoot = document.querySelector('[data-admin-theme]:not(html)')
  if (adminRoot) {
    adminRoot.setAttribute('data-admin-theme', theme)
  }
  document.documentElement.setAttribute('data-admin-theme', theme)
}

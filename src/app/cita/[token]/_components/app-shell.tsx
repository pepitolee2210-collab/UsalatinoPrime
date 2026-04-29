import type { ReactNode } from 'react'

interface AppShellProps {
  topBar: ReactNode
  bottomNav: ReactNode
  children: ReactNode
}

/**
 * Layout fijo del portal del cliente:
 *   - Top bar fijo (64px + safe-area)
 *   - Main scrollable con padding compensatorio
 *   - Bottom nav fijo (88px + safe-area)
 *
 * Todo el shell vive dentro de `.ulp-portal-root` para activar
 * los tokens de tipografía, color y spacing definidos en
 * `tokens.css`.
 */
export function AppShell({ topBar, bottomNav, children }: AppShellProps) {
  return (
    <div className="ulp-portal-root min-h-screen">
      <header className="ulp-topbar">{topBar}</header>
      <main className="ulp-main">{children}</main>
      <nav className="ulp-bottomnav" role="navigation" aria-label="Navegación principal">
        {bottomNav}
      </nav>
    </div>
  )
}

import type { ReactNode } from 'react'

interface AppShellProps {
  topBar: ReactNode
  bottomNav: ReactNode
  sideNav: ReactNode
  children: ReactNode
}

/**
 * Layout responsive del portal del cliente:
 *
 * Mobile (default): mobile-first
 *   - Top bar fijo arriba (64px + safe-area)
 *   - Main scrollable con padding compensatorio
 *   - Bottom nav fijo abajo (88px + safe-area)
 *
 * Desktop (≥ md, 768px+):
 *   - Side nav fijo a la izquierda (260px) con marca + nav + notif
 *   - Top bar oculto (su contenido vive en el side nav)
 *   - Main con margin-left para no sobreponerse al sidebar
 *
 * Todo el shell vive dentro de `.ulp-portal-root` para activar los
 * tokens de tipografía, color y spacing definidos en `tokens.css`.
 */
export function AppShell({ topBar, bottomNav, sideNav, children }: AppShellProps) {
  return (
    <div className="ulp-portal-root min-h-screen">
      {/* Top bar — solo mobile (md:hidden) */}
      <header className="ulp-topbar md:hidden">{topBar}</header>

      {/* Side nav — solo desktop (hidden md:flex) */}
      <aside className="ulp-sidenav hidden md:flex" aria-label="Navegación principal">
        {sideNav}
      </aside>

      {/* Main scrollable */}
      <main className="ulp-main md:ulp-main-desktop">{children}</main>

      {/* Bottom nav — solo mobile (md:hidden) */}
      <nav
        className="ulp-bottomnav md:hidden"
        role="navigation"
        aria-label="Navegación principal"
      >
        {bottomNav}
      </nav>
    </div>
  )
}

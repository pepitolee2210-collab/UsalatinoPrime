'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface PortalSheetProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

/**
 * Modal a pantalla completa (móvil) / centrado (desktop) renderizado vía
 * portal en `document.body`.
 *
 * Por qué el portal es OBLIGATORIO (no es opcional ni cosmético):
 * El portal del cliente vive dentro de `.ulp-portal-root`, y cada screen
 * (`.ulp-screen`) corre la animación `ulp-fade-in` con `animation-fill-mode:
 * both`, que RETIENE `transform: translateY(0)` al terminar. Un ancestro con
 * `transform != none` se vuelve el "containing block" de cualquier
 * `position: fixed` descendiente: el modal deja de anclarse al viewport y
 * queda atrapado en el stacking context de `.ulp-screen` — por DEBAJO del
 * top-bar y bottom-nav (`z-index: 40`), que sí viven en el contexto raíz.
 * Resultado: las barras tapaban el modal aunque tuviera `z-50`.
 *
 * `createPortal(document.body)` saca el modal de ese ancestro con transform,
 * y `z-[100]` lo deja por encima de las barras (40) en el contexto raíz.
 *
 * Incluye: scroll-lock del body, cierre ÚNICAMENTE por el botón "X" (ni el
 * backdrop ni la tecla Escape cierran, para no perder datos en formularios
 * largos con autoguardado), safe-area en el header (notch) y semántica de
 * diálogo accesible.
 */
export function PortalSheet({ title, onClose, children }: PortalSheetProps) {
  // Bloquear scroll del body mientras el modal está abierto. El cierre es SOLO
  // por el botón "X" del header (ni el backdrop ni la tecla Escape cierran),
  // para no perder datos en formularios largos con autoguardado.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute bg-white shadow-2xl flex flex-col overflow-hidden
                   inset-0
                   sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                   sm:w-full sm:max-w-3xl sm:max-h-[90vh] sm:rounded-3xl"
      >
        <header
          className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b"
          style={{
            borderColor: 'var(--color-ulp-outline-variant)',
            paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-ulp-surface-container)' }}
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
          <h2 className="ulp-body-md font-bold flex-1 truncate" style={{ color: 'var(--color-ulp-on-surface)' }}>
            {title}
          </h2>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

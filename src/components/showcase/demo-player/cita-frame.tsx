'use client'

import 'material-symbols/outlined.css'

type ScreenId = 'inicio' | 'citas' | 'documentos' | 'fases' | 'mas'

interface NavItem {
  id: ScreenId
  label: string
  icon: string
  fillWhenActive: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'inicio',     label: 'Inicio',      icon: 'home',       fillWhenActive: true  },
  { id: 'citas',      label: 'Citas',       icon: 'event',      fillWhenActive: true  },
  { id: 'documentos', label: 'Documentos',  icon: 'folder',     fillWhenActive: true  },
  { id: 'fases',      label: 'Formularios', icon: 'assignment', fillWhenActive: true  },
  { id: 'mas',        label: 'Más',         icon: 'menu',       fillWhenActive: false },
]

interface CitaFrameProps {
  /** Nombre del cliente (para iniciales del avatar) */
  clientName: string
  /** Tab que se ve resaltada en la bottom nav */
  activeScreen: ScreenId
  /** Contenido de la pantalla a renderizar dentro del shell */
  children: React.ReactNode
}

/**
 * Simula el shell visual del portal del cliente (/cita/[token]):
 * - Top bar fijo con avatar circular + marca "UsaLatinoPrime" italic
 * - Contenido en el centro (scrollable)
 * - Bottom nav con 5 tabs estilo Material 3
 *
 * Replica fielmente los tokens visuales de `_components/tokens.css`.
 * Usa proporciones mobile (max 420px) pero adapta a ancho disponible.
 */
export function CitaFrame({ clientName, activeScreen, children }: CitaFrameProps) {
  const initials = clientName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="ulp-portal-root mx-auto rounded-[36px] border border-gray-300 bg-[#f9f9f9] shadow-2xl overflow-hidden" style={{ maxWidth: 420, height: 700 }}>
      <div className="relative h-full flex flex-col">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-6 border-b shrink-0"
          style={{
            height: 64,
            background: 'rgba(249, 249, 249, 0.92)',
            backdropFilter: 'blur(12px)',
            borderBottomColor: 'var(--color-ulp-surface-container)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center"
              style={{ border: '1px solid var(--color-ulp-outline-variant)' }}
            >
              <span
                className="text-sm font-bold w-full h-full flex items-center justify-center"
                style={{
                  color: 'var(--color-ulp-on-primary-container)',
                  background: 'var(--color-ulp-primary-container)',
                }}
              >
                {initials || 'UL'}
              </span>
            </div>
            <p
              className="italic font-semibold"
              style={{
                color: 'var(--color-ulp-on-secondary-fixed)',
                fontFamily: 'var(--font-ulp-display)',
                fontSize: 20,
              }}
            >
              UsaLatinoPrime
            </p>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--color-ulp-on-surface)' }}>
            notifications
          </span>
        </div>

        {/* Main content (scrollable) */}
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--color-ulp-background)' }}>
          <div className="ulp-screen">{children}</div>
        </div>

        {/* Bottom nav */}
        <ul
          className="flex justify-around items-center px-3 pt-3 pb-2 shrink-0"
          style={{
            background: '#FAFAF7',
            borderTop: '1px solid #e7e5e4',
            borderRadius: '16px 16px 0 0',
            boxShadow: '0 -4px 20px 0 rgba(10, 20, 40, 0.05)',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeScreen === item.id
            return (
              <li key={item.id} className="flex-1">
                <div
                  className="w-full flex flex-col items-center gap-1 py-1"
                  style={{
                    color: isActive ? 'var(--color-ulp-primary)' : 'var(--color-ulp-on-surface-variant)',
                    opacity: isActive ? 1 : 0.65,
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center px-3 py-1 rounded-full transition-all"
                    style={{
                      background: isActive ? 'rgba(180, 83, 9, 0.12)' : 'transparent',
                      transform: isActive ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      data-fill={isActive && item.fillWhenActive ? '1' : '0'}
                      style={{ fontSize: 22 }}
                    >
                      {item.icon}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold whitespace-nowrap" style={{ letterSpacing: '0.02em' }}>
                    {item.label}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

'use client'

export type ScreenId = 'inicio' | 'citas' | 'documentos' | 'fases' | 'mas'

interface NavItem {
  id: ScreenId
  label: string
  icon: string
  fillWhenActive: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'inicio',     label: 'Inicio',     icon: 'home',        fillWhenActive: true  },
  { id: 'citas',      label: 'Citas',      icon: 'event',       fillWhenActive: true  },
  { id: 'documentos', label: 'Documentos', icon: 'folder',      fillWhenActive: true  },
  { id: 'fases',      label: 'Fases',      icon: 'assignment',  fillWhenActive: true  },
  { id: 'mas',        label: 'Más',        icon: 'menu',        fillWhenActive: false },
]

interface BottomNavProps {
  activeScreen: ScreenId
  onChange: (screen: ScreenId) => void
  badges?: Partial<Record<ScreenId, number>>
}

/**
 * Bottom nav fijo con 5 pestañas. La pestaña activa muestra fondo
 * acento y escala ligeramente. Soporta badge numérico opcional por
 * pestaña (e.g. 3 documentos pendientes).
 */
export function BottomNav({ activeScreen, onChange, badges = {} }: BottomNavProps) {
  return (
    <ul className="flex justify-around items-center px-4 pt-3 pb-2">
      {NAV_ITEMS.map((item) => {
        const isActive = activeScreen === item.id
        const badge = badges[item.id]
        return (
          <li key={item.id} className="flex-1">
            <button
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className="w-full flex flex-col items-center gap-1 py-1 transition-transform active:scale-95"
              style={{
                color: isActive ? 'var(--color-ulp-primary)' : 'var(--color-ulp-on-surface-variant)',
                opacity: isActive ? 1 : 0.65,
              }}
            >
              <span
                className="relative inline-flex items-center justify-center px-3 py-1 rounded-full transition-all"
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
                {badge !== undefined && badge > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-black flex items-center justify-center text-white leading-none"
                    style={{ background: 'var(--color-ulp-error)' }}
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span
                className="text-[10px] font-bold whitespace-nowrap"
                style={{ letterSpacing: '0.02em' }}
              >
                {item.label}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

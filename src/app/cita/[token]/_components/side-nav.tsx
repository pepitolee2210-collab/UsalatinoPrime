'use client'

import { useState } from 'react'
import type { ScreenId } from './bottom-nav'

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

interface SideNavProps {
  activeScreen: ScreenId
  onChange: (screen: ScreenId) => void
  badges?: Partial<Record<ScreenId, number>>
  clientName: string
  avatarUrl: string | null
  notificationCount?: number
}

/**
 * Sidebar lateral fijo (≥md). Combina marca/avatar arriba (que en mobile
 * vive en el TopBar) + lista vertical de navegación + slot inferior
 * para notificaciones.
 *
 * Replica el contrato de BottomNav (activeScreen + onChange + badges)
 * para que el AppShell pueda alternar sin lógica adicional.
 */
export function SideNav({
  activeScreen,
  onChange,
  badges = {},
  clientName,
  avatarUrl,
  notificationCount = 0,
}: SideNavProps) {
  const [imgError, setImgError] = useState(false)
  const initials = clientName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
  const showInitials = !avatarUrl || imgError

  return (
    <div className="flex flex-col h-full px-4 py-6">
      {/* Branding + avatar */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div
          className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{ border: '1px solid var(--color-ulp-outline-variant)' }}
        >
          {showInitials ? (
            <span
              className="text-sm font-bold flex items-center justify-center w-full h-full"
              style={{
                color: 'var(--color-ulp-on-primary-container)',
                background: 'var(--color-ulp-primary-container)',
              }}
            >
              {initials || 'UL'}
            </span>
          ) : (
            <img
              src={avatarUrl}
              alt={clientName}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="ulp-h3 italic font-semibold truncate"
            style={{ color: 'var(--color-ulp-on-secondary-fixed)', fontSize: 18 }}
          >
            UsaLatinoPrime
          </p>
          <p
            className="text-[11px] truncate"
            style={{ color: 'var(--color-ulp-on-surface-variant)' }}
          >
            {clientName}
          </p>
        </div>
      </div>

      {/* Nav items */}
      <nav aria-label="Navegación principal" className="flex-1">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeScreen === item.id
            const badge = badges[item.id]
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onChange(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: isActive ? 'rgba(180, 83, 9, 0.12)' : 'transparent',
                    color: isActive
                      ? 'var(--color-ulp-primary)'
                      : 'var(--color-ulp-on-surface-variant)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--color-ulp-surface-container-low)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span className="relative inline-flex items-center justify-center flex-shrink-0">
                    <span
                      className="material-symbols-outlined"
                      data-fill={isActive && item.fillWhenActive ? '1' : '0'}
                      style={{ fontSize: 22 }}
                    >
                      {item.icon}
                    </span>
                    {badge !== undefined && badge > 0 && (
                      <span
                        className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-black flex items-center justify-center text-white leading-none"
                        style={{ background: 'var(--color-ulp-error)' }}
                      >
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-bold flex-1 text-left">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Notificaciones al fondo */}
      <button
        type="button"
        aria-label={`Notificaciones${notificationCount > 0 ? ` (${notificationCount})` : ''}`}
        className="mt-4 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
        style={{ color: 'var(--color-ulp-on-surface-variant)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-ulp-surface-container-low)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span className="relative inline-flex items-center justify-center">
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
            notifications
          </span>
          {notificationCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center text-white leading-none"
              style={{ background: 'var(--color-ulp-error)' }}
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </span>
        <span className="text-sm font-bold">Notificaciones</span>
      </button>
    </div>
  )
}

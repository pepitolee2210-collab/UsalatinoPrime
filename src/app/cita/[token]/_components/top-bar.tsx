'use client'

import { useState } from 'react'

interface TopBarProps {
  clientName: string
  avatarUrl: string | null
  notificationCount?: number
  onNotificationsClick?: () => void
}

/**
 * Top bar fijo del portal:
 *   - Avatar del cliente (40x40, rounded-full)
 *   - Marca "UsaLatinoPrime" italic
 *   - Botón de notificaciones con badge si hay sin leer
 */
export function TopBar({ clientName, avatarUrl, notificationCount = 0, onNotificationsClick }: TopBarProps) {
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
    <div className="flex items-center justify-between h-full px-6">
      {/* Izquierda — avatar + marca */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ border: '1px solid var(--color-ulp-outline-variant)' }}
        >
          {showInitials ? (
            <span
              className="text-sm font-bold"
              style={{
                color: 'var(--color-ulp-on-primary-container)',
                background: 'var(--color-ulp-primary-container)',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
        <p
          className="ulp-h3 italic font-semibold"
          style={{ color: 'var(--color-ulp-on-secondary-fixed)', fontSize: '20px' }}
        >
          UsaLatinoPrime
        </p>
      </div>

      {/* Derecha — notificaciones */}
      <button
        type="button"
        onClick={onNotificationsClick}
        aria-label={`Notificaciones${notificationCount > 0 ? ` (${notificationCount} sin leer)` : ''}`}
        className="relative w-10 h-10 rounded-full flex items-center justify-center transition-colors"
        style={{ background: 'transparent' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-ulp-surface-container-low)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--color-ulp-on-surface)' }}>
          notifications
        </span>
        {notificationCount > 0 && (
          <span
            className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center text-white leading-none"
            style={{ background: 'var(--color-ulp-error)' }}
          >
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </button>
    </div>
  )
}

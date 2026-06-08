'use client'

import { useAdminTheme, type AdminTheme } from './use-admin-theme'

/**
 * Selector de 3 modos visuales del admin (dark | institutional | light).
 * Compacto, vive en el footer del sidebar.
 *
 * Diseño: 3 chips uno al lado del otro. El activo tiene fondo lleno;
 * los inactivos solo borde. Hover suave. Tooltip simple via aria-label.
 */

const THEMES: Array<{
  id: AdminTheme
  label: string
  icon: string
  color: string
}> = [
  { id: 'dark', label: 'Oscuro', icon: 'dark_mode', color: 'var(--admin-fg)' },
  { id: 'institutional', label: 'Institucional', icon: 'account_balance', color: '#F5B705' },
  { id: 'light', label: 'Claro', icon: 'light_mode', color: '#1E4EA8' },
]

export function AdminThemeSwitcher() {
  const { theme, setTheme } = useAdminTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Modo visual del panel"
      className="flex items-center gap-1 p-1 rounded-full"
      style={{
        background: 'var(--admin-accent-soft, var(--admin-accent-soft))',
        border: '0.5px solid var(--admin-border, var(--admin-border))',
      }}
    >
      {THEMES.map((t) => {
        const isActive = theme === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`Cambiar a modo ${t.label}`}
            title={t.label}
            onClick={() => setTheme(t.id)}
            className="relative inline-flex items-center justify-center transition-all duration-300"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: isActive ? t.color : 'transparent',
              boxShadow: isActive ? `0 0 12px ${t.color}55` : 'none',
              cursor: 'pointer',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 14,
                color: isActive
                  ? t.id === 'light'
                    ? '#FFFFFF'
                    : 'var(--admin-bg)'
                  : 'var(--admin-fg-muted, #A1A1A1)',
                fontVariationSettings: "'FILL' " + (isActive ? '1' : '0') + ", 'wght' 500",
              }}
            >
              {t.icon}
            </span>
          </button>
        )
      })}
    </div>
  )
}

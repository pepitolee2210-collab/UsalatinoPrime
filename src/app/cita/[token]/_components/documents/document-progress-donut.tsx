interface DocumentProgressDonutProps {
  completed: number
  total: number
  size?: number
}

/**
 * Donut SVG de progreso. Centro muestra "X/Y" + label "% Completado"
 * debajo. Animación de stroke-dashoffset al render.
 */
export function DocumentProgressDonut({ completed, total, size = 96 }: DocumentProgressDonutProps) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const pct = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100))
  const dashOffset = circumference - (pct / 100) * circumference

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-ulp-surface-container)"
            strokeWidth={6}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-ulp-primary-container)"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)' }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-bold tabular-nums"
          style={{ color: 'var(--color-ulp-on-surface)', fontSize: 18 }}
        >
          {completed}/{total}
        </div>
      </div>
      <div>
        <p className="ulp-h3" style={{ fontSize: 22 }}>
          {pct}%
        </p>
        <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          Completado
        </p>
      </div>
    </div>
  )
}

'use client'

/**
 * Sparkline SVG con animación de "dibujo" al entrar al viewport. Sin
 * librerías — escala los puntos a un viewBox fijo y anima el
 * stroke-dashoffset para que la línea se trace al cargar.
 */
interface Props {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  showDots?: boolean
  showArea?: boolean
}

export function Sparkline({
  data,
  width = 140,
  height = 36,
  stroke = '#F2A900',
  fill = 'rgba(242, 169, 0, 0.12)',
  showDots = true,
  showArea = true,
}: Props) {
  if (data.length === 0) {
    return <svg width={width} height={height} className="opacity-30" />
  }

  const min = Math.min(...data, 0)
  const max = Math.max(...data, 1)
  const range = max - min || 1
  const stepX = data.length > 1 ? width / (data.length - 1) : width / 2
  const padY = 4
  const usableH = height - padY * 2

  const points = data.map((v, i) => {
    const x = i * stepX
    const y = padY + usableH - ((v - min) / range) * usableH
    return { x, y, v }
  })

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(2)} ${height} L 0 ${height} Z`

  const last = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {showArea && (
        <path
          d={areaD}
          fill={fill}
          style={{ animation: 'spark-fade 700ms ease-out both' }}
        />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{
          strokeDasharray: 1000,
          strokeDashoffset: 1000,
          animation: 'spark-draw 900ms ease-out forwards',
        }}
      />
      {showDots && (
        <circle
          cx={last.x}
          cy={last.y}
          r={2.5}
          fill={stroke}
          style={{ animation: 'spark-pop 1200ms ease-out forwards' }}
        />
      )}
      <style>{`
        @keyframes spark-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes spark-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spark-pop {
          0%, 70% { transform: scale(0); transform-origin: center; opacity: 0; }
          100%    { transform: scale(1); transform-origin: center; opacity: 1; }
        }
      `}</style>
    </svg>
  )
}

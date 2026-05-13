'use client'

/**
 * Sparkline minimalista — solo línea fina, sin fill, sin dots, sin
 * animación de dibujo. El dato es el héroe, no la decoración.
 */
interface Props {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  strokeWidth?: number
}

export function Sparkline({
  data,
  width = 140,
  height = 32,
  stroke = '#E8B84A',
  strokeWidth = 1.25,
}: Props) {
  if (data.length === 0) {
    return <svg width={width} height={height} aria-hidden="true" />
  }

  const min = Math.min(...data, 0)
  const max = Math.max(...data, 1)
  const range = max - min || 1
  const stepX = data.length > 1 ? width / (data.length - 1) : width / 2
  const padY = 3
  const usableH = height - padY * 2

  const points = data.map((v, i) => {
    const x = i * stepX
    const y = padY + usableH - ((v - min) / range) * usableH
    return { x, y }
  })

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
    </svg>
  )
}

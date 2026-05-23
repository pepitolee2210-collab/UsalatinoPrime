'use client'

import { useEffect, useRef, useState } from 'react'

// Detección de mobile para degradar efectos pesados.
// `matchMedia` se evalúa una vez al montar y se actualiza si cambia el viewport.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

// Lista de wallpapers disponibles en /public/wallpapers/.
// Si un archivo no existe físicamente, el componente lo descarta silenciosamente
// al cargar (handleError). Para añadir un wallpaper: subir el JPG a la carpeta
// y agregarlo a esta lista.
const WALLPAPERS = [
  '/wallpapers/wp-01.jpg',
  '/wallpapers/wp-02.jpg',
  '/wallpapers/wp-03.jpg',
]

const ROTATION_MS = 28_000 // cambio cada 28s
const FADE_MS = 1500       // cross-fade

// Altura del banner donde se ve el wallpaper. Por debajo de esto, el contenido
// queda sobre fondo negro plano (las cards de servicios).
const HERO_HEIGHT = 760

export function WallpaperHero() {
  const [available, setAvailable] = useState<string[]>([])
  const [active, setActive] = useState(0)
  const indexRef = useRef(0)
  const isMobile = useIsMobile()

  // Pre-cargar las imágenes y filtrar las que existen
  useEffect(() => {
    let cancelled = false
    const checks = WALLPAPERS.map(
      (src) =>
        new Promise<string | null>((resolve) => {
          const img = new Image()
          img.onload = () => resolve(src)
          img.onerror = () => resolve(null)
          img.src = src
        }),
    )
    Promise.all(checks).then((results) => {
      if (cancelled) return
      const ok = results.filter((r): r is string => r !== null)
      setAvailable(ok)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Rotación automática
  useEffect(() => {
    if (available.length < 2) return
    const t = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % available.length
      setActive(indexRef.current)
    }, ROTATION_MS)
    return () => clearInterval(t)
  }, [available.length])

  // Si no hay wallpapers disponibles, no renderiza nada — la página queda
  // exactamente como antes (con su Aurora + DotGrid + ScanLines existentes).
  if (available.length === 0) return null

  return (
    <div
      aria-hidden
      className="absolute pointer-events-none overflow-hidden"
      style={{
        top: 0,
        left: 0,
        right: 0,
        height: HERO_HEIGHT,
        zIndex: 0,
      }}
    >
      {/* Capas de imágenes con cross-fade. En mobile: sin blur ni contrast
          (filter es muy caro), opacidad un poco más baja para suavizar */}
      {available.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            opacity: i === active ? (isMobile ? 0.35 : 0.42) : 0,
            transition: `opacity ${FADE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
            filter: isMobile ? 'none' : 'blur(1.5px) saturate(0.85) contrast(1.05)',
            willChange: 'opacity',
          }}
        />
      ))}

      {/* Scanlines técnicas — desactivadas en mobile (mix-blend es muy caro) */}
      {!isMobile && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(0deg, ' +
              'rgba(255,255,255,0) 0px, ' +
              'rgba(255,255,255,0) 2px, ' +
              'rgba(255,255,255,0.02) 3px, ' +
              'rgba(255,255,255,0) 4px)',
            mixBlendMode: 'overlay',
          }}
        />
      )}

      {/* Vignette radial — barata, se mantiene */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, transparent 0%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* Gradient mask vertical — barato, se mantiene */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, ' +
            'rgba(0,0,0,0) 0%, ' +
            'rgba(0,0,0,0) 35%, ' +
            'rgba(0,0,0,0.55) 70%, ' +
            'rgba(0,0,0,0.92) 92%, ' +
            '#000000 100%)',
        }}
      />

      {/* Noise grain — desactivado en mobile (feTurbulence + mix-blend son devastadores) */}
      {!isMobile && (
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.08,
            mixBlendMode: 'overlay',
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
          }}
        />
      )}
    </div>
  )
}

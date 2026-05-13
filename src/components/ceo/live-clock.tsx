'use client'

import { useEffect, useState } from 'react'

/**
 * Reloj en vivo HH:MM (sin segundos, menos ruidoso). Punto verde pulsando
 * al lado para señalar "datos en vivo". Se actualiza cada 30 segundos.
 */
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const time = now
    ? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '— : —'

  const date = now
    ? now.toLocaleDateString('es-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : ''

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
          En vivo
        </span>
      </div>
      <div className="font-mono-ceo text-2xl text-white tabular-nums leading-none">
        {time}
      </div>
      <div className="text-[11px] text-white/40 capitalize">{date}</div>
    </div>
  )
}

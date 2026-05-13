'use client'

import { useEffect, useState } from 'react'

/**
 * Reloj sutil HH:MM con indicador "EN VIVO" tipográfico (sin punto pulsante
 * ruidoso). Refresca cada 30s. Estilo Linear/Vercel — el dato es el héroe,
 * no la decoración.
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
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : ''

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="h-1 w-1 rounded-full bg-emerald-400" />
        <span className="font-mono-ceo text-[10px] uppercase tracking-[0.24em] text-emerald-400/70 font-medium">
          Live
        </span>
      </div>
      <div className="font-mono-ceo text-2xl text-white tabular-nums leading-none font-light tracking-tight">
        {time}
      </div>
      <div className="font-mono-ceo text-[10px] uppercase tracking-wider text-white/60 capitalize">
        {date}
      </div>
    </div>
  )
}

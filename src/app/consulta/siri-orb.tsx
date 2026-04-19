'use client'

import { useEffect, useRef } from 'react'

interface SiriOrbProps {
  /** 0–1 normalized audio level */
  audioLevel?: number
  /** Visual state of the orb */
  state?: 'idle' | 'connecting' | 'active' | 'error' | 'listening' | 'speaking' | 'processing'
  /** Size in px */
  size?: number
  className?: string
}

// States where the orb pulses to the audio level (user or model actually talking).
const REACTIVE_STATES: Array<SiriOrbProps['state']> = ['active', 'listening', 'speaking']

export function SiriOrb({ audioLevel = 0, state = 'idle', size = 200, className = '' }: SiriOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const reactive = REACTIVE_STATES.includes(state)
    const scale = reactive ? 1 + audioLevel * 0.2 : 1
    const glowIntensity = reactive ? 0.3 + audioLevel * 0.5 : 0.3

    el.style.setProperty('--orb-glow', String(glowIntensity))
    el.style.transform = `scale(${scale})`
    el.style.transition = 'transform 0.1s ease-out'
  }, [audioLevel, state])

  const stateClass =
    state === 'connecting' ? 'siri-orb-connecting' :
    state === 'error' ? 'siri-orb-error' :
    state === 'listening' ? 'siri-orb-listening' :
    state === 'speaking' ? 'siri-orb-speaking' :
    state === 'processing' ? 'siri-orb-processing' :
    state === 'active' ? 'siri-orb-active' :
    'siri-orb-idle'

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size * 1.6, height: size * 1.6 }}
    >
      {/* Glow aura */}
      <div className="siri-orb-glow" />

      {/* Main orb */}
      <div
        ref={containerRef}
        className={`siri-orb ${stateClass}`}
        style={{ '--orb-size': `${size}px` } as React.CSSProperties}
      >
        {/* Inner content — brand letter */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span
            className="font-bold text-white/90 select-none"
            style={{ fontSize: size * 0.25 }}
          >
            U
          </span>
        </div>
      </div>
    </div>
  )
}

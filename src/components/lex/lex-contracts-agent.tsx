'use client'

/**
 * LexContractsAgent — widget completo (FAB + panel de transcripción)
 * para Vanessa en /employee/contratos.
 *
 * Patrón visual: floating button bottom-right + drawer panel deslizable.
 * Estados: idle (botón cerrado) → connecting → listening/speaking → closed.
 */

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, X, Loader2, AudioLines } from 'lucide-react'
import { useLexAgent, type LexState } from './use-lex-agent'
import { onLexEvent } from './lex-events'

interface Transcript {
  id: number
  role: 'user' | 'lex'
  text: string
}

export function LexContractsAgent() {
  const [open, setOpen] = useState(false)
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const idCounter = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { state, errorMessage, isMuted, start, stop, toggleMute } = useLexAgent({
    onTranscript: (role, text) => {
      if (!text.trim()) return
      setTranscripts((prev) => {
        // Merge si es el mismo role consecutivo (streaming de chunks)
        const last = prev[prev.length - 1]
        if (last && last.role === role) {
          return [...prev.slice(0, -1), { ...last, text: last.text + text }]
        }
        idCounter.current += 1
        return [...prev, { id: idCounter.current, role, text }]
      })
    },
  })

  // Cerrar el panel cuando la tool closeAgent se invoca
  useEffect(() => {
    return onLexEvent('lex:close', () => {
      void stop()
      setOpen(false)
    })
  }, [stop])

  // Auto-scroll al fondo cuando llegan nuevos turnos
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [transcripts])

  function handleToggle() {
    if (!open) {
      setOpen(true)
      setTranscripts([])
      void start()
    } else {
      void stop()
      setOpen(false)
    }
  }

  const statusLabel = STATE_LABELS[state] ?? state
  const isActive = state === 'listening' || state === 'speaking'

  return (
    <>
      {/* Panel deslizable */}
      {open && (
        <div
          className="fixed z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            bottom: 96,
            right: 24,
            width: 380,
            maxHeight: 'calc(100vh - 140px)',
            background: 'var(--admin-panel-grad)',
            border: '0.5px solid var(--admin-border)',
            boxShadow: 'var(--admin-shadow-lg)',
            animation: 'lex-slide-up 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{
              background: 'var(--admin-bg-deep)',
              borderBottom: '0.5px solid var(--admin-border)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="relative flex items-center justify-center"
                style={{ width: 8, height: 8 }}
              >
                {isActive && (
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'var(--admin-accent)',
                      animation: 'lex-ping 1.8s ease-in-out infinite',
                    }}
                  />
                )}
                <span
                  className="relative rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    background: isActive ? 'var(--admin-accent)' : 'var(--admin-fg-subtle)',
                  }}
                />
              </span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-fg)' }}>
                  Lex · Asistente
                </p>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--admin-fg-subtle)',
                    fontFamily: 'var(--font-mono-tech)',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                  }}
                >
                  {statusLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMute}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                style={{
                  background: isMuted ? 'var(--admin-red-soft)' : 'transparent',
                  color: isMuted ? 'var(--admin-red)' : 'var(--admin-fg-muted)',
                  border: `0.5px solid ${isMuted ? 'var(--admin-red)' : 'var(--admin-border)'}`,
                }}
                title={isMuted ? 'Activar micrófono' : 'Silenciar'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={handleToggle}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                style={{
                  color: 'var(--admin-fg-muted)',
                  border: '0.5px solid var(--admin-border)',
                }}
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body — transcripciones */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
            style={{ background: 'var(--admin-bg-elev)', minHeight: 220 }}
          >
            {errorMessage && (
              <div
                className="rounded-lg p-3 text-sm"
                style={{
                  background: 'var(--admin-red-soft)',
                  color: 'var(--admin-red)',
                  border: '0.5px solid var(--admin-red)',
                }}
              >
                {errorMessage}
              </div>
            )}
            {transcripts.length === 0 && !errorMessage && (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <AudioLines className="w-8 h-8" style={{ color: 'var(--admin-fg-subtle)' }} />
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--admin-fg-muted)',
                    textAlign: 'center',
                    maxWidth: 240,
                  }}
                >
                  {state === 'connecting'
                    ? 'Conectando…'
                    : 'Habla en voz alta — Lex te escucha. Pídele listar contratos, buscar uno, enviar links de firma.'}
                </p>
              </div>
            )}
            {transcripts.map((t) => (
              <div
                key={t.id}
                className="rounded-xl px-3 py-2"
                style={
                  t.role === 'user'
                    ? {
                        background: 'var(--admin-blue-soft)',
                        color: 'var(--admin-blue)',
                        border: '0.5px solid var(--admin-blue)',
                        alignSelf: 'flex-end',
                      }
                    : {
                        background: 'var(--admin-accent-soft)',
                        color: 'var(--admin-fg)',
                        border: '0.5px solid var(--admin-border)',
                      }
                }
              >
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: t.role === 'user' ? 'var(--admin-blue)' : 'var(--admin-accent)',
                    fontFamily: 'var(--font-mono-tech)',
                    marginBottom: 2,
                  }}
                >
                  {t.role === 'user' ? 'Vanessa' : 'Lex'}
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.45 }}>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={handleToggle}
        className="fixed z-50 inline-flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 active:scale-95"
        style={{
          bottom: 24,
          right: 24,
          background: open
            ? 'var(--admin-red)'
            : 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
          color: '#FFFFFF',
          boxShadow: open
            ? '0 12px 28px rgba(185,28,28,0.35)'
            : '0 12px 28px rgba(30,78,154,0.32), 0 0 0 0.5px rgba(255,255,255,0.4) inset',
        }}
        title={open ? 'Cerrar Lex' : 'Abrir Lex'}
      >
        {state === 'connecting' ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : open ? (
          <X className="w-6 h-6" />
        ) : isActive ? (
          <AudioLines className="w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>

      <style>{`
        @keyframes lex-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lex-ping {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </>
  )
}

const STATE_LABELS: Record<LexState, string> = {
  idle: 'Listo',
  connecting: 'Conectando',
  listening: 'Te escucho',
  speaking: 'Hablando',
  error: 'Error',
  closed: 'Cerrado',
}

'use client'

import 'material-symbols/outlined.css'
import { getServicePhases } from '@/lib/services/registry'
import { useDemoPlayer } from './use-demo-player'
import { Scene, SceneKeyframes } from './scenes'
import type { DemoScript } from './types'

interface Props {
  script: DemoScript
}

const SPEEDS = [0.5, 1, 1.5, 2] as const

export function DemoPlayer({ script }: Props) {
  const { state, currentStep, stepProgress, progress, play, pause, reset, setSpeed, skipToPhase } = useDemoPlayer(script)
  const phases = getServicePhases(script.serviceSlug).filter((p) => !p.isCompletion)
  const currentPhaseCode = currentStep?.phase

  return (
    <div
      className="space-y-5 relative"
      style={{
        fontFamily: 'var(--font-tight), -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        color: 'var(--admin-fg)',
      }}
    >
      <SceneKeyframes />

      {/* ─── Header strip ─── */}
      <div
        className="rounded-[20px] px-6 py-5 flex items-center justify-between gap-4 flex-wrap relative overflow-hidden"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Accent glow strip top */}
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, var(--admin-accent), transparent)' }}
        />

        <div className="flex items-center gap-4">
          <div
            className="relative w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--admin-border-strong), var(--admin-bg-elev-2))',
              border: '0.5px solid var(--admin-border-strong)',
            }}
          >
            <span
              className="material-symbols-outlined"
              data-fill="1"
              style={{ fontSize: 22, color: 'var(--admin-fg)' }}
            >
              play_circle
            </span>
          </div>
          <div>
            <p
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.2em',
                color: 'var(--admin-fg-subtle)',
              }}
            >
              DEMO · EN VIVO
            </p>
            <p className="mt-1" style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.018em', lineHeight: 1.2 }}>
              {script.serviceName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="relative flex items-center justify-center" style={{ width: 8, height: 8 }}>
              {state.isPlaying && (
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--admin-accent)', animation: 'tech-ping-dot 1.8s ease-in-out infinite' }}
                />
              )}
              <span
                className="relative rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  background: state.isPlaying ? 'var(--admin-accent)' : 'var(--admin-fg-subtle)',
                  boxShadow: state.isPlaying ? '0 0 12px var(--admin-accent)' : 'none',
                }}
              />
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.2em',
                color: state.isPlaying ? 'var(--admin-accent)' : 'var(--admin-fg-subtle)',
              }}
            >
              {state.isPlaying ? 'RUNNING' : state.isFinished ? 'DONE' : 'IDLE'}
            </span>
          </span>

          <div
            style={{
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 14,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.05em',
            }}
          >
            <span style={{ color: 'var(--admin-fg)' }}>{formatTime(progress * script.totalDurationMs)}</span>
            <span style={{ color: 'var(--admin-fg-faint)', margin: '0 6px' }}>/</span>
            <span style={{ color: 'var(--admin-fg-subtle)' }}>{formatTime(script.totalDurationMs)}</span>
          </div>
        </div>
      </div>

      {/* ─── Phase pills ─── */}
      {phases.length > 1 && (
        <div className="flex justify-center">
          <div
            className="inline-flex items-center gap-1 p-1 rounded-full"
            style={{
              background: 'var(--admin-accent-soft)',
              border: '0.5px solid var(--admin-border)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {phases.map((phase, idx) => {
              const isActive = phase.code === currentPhaseCode
              const isPast = phases.findIndex((p) => p.code === currentPhaseCode) > idx
              return (
                <button
                  key={phase.code}
                  onClick={() => skipToPhase(phase.code)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all duration-500"
                  style={{
                    background: isActive ? 'var(--admin-accent-soft)' : 'transparent',
                    border: isActive ? '0.5px solid #FFFFFF' : '0.5px solid transparent',
                    color: isActive ? 'var(--admin-bg)' : isPast ? 'var(--admin-fg)' : 'var(--admin-fg-subtle)',
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.12em',
                    boxShadow: isActive ? '0 0 24px var(--admin-accent-glow)' : 'none',
                  }}
                >
                  {isPast && (
                    <span
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full"
                      style={{ background: 'var(--admin-accent)', color: 'var(--admin-bg)', fontSize: 9, fontWeight: 700 }}
                    >
                      ✓
                    </span>
                  )}
                  {phase.number.toUpperCase()}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Progress with shimmer ─── */}
      <div className="relative h-[2px] rounded-full overflow-hidden" style={{ background: 'var(--admin-accent-soft)' }}>
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-100 ease-linear rounded-full"
          style={{
            width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, var(--admin-accent-glow), #FFFFFF, var(--admin-accent-glow))',
            backgroundSize: '200% 100%',
            animation: state.isPlaying ? 'tech-progress-shimmer 3s linear infinite' : 'none',
            boxShadow: '0 0 12px var(--admin-accent-glow)',
          }}
        />
      </div>

      {/* ─── Scene stage ─── */}
      <div
        className="relative rounded-[24px] overflow-hidden"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border)',
          backdropFilter: 'blur(20px)',
          minHeight: 580,
        }}
      >
        {/* Corner marks */}
        <CornerMark pos="tl" />
        <CornerMark pos="tr" />
        <CornerMark pos="bl" />
        <CornerMark pos="br" />

        {/* Inner glow top */}
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at top, var(--admin-accent-soft), transparent 60%)',
          }}
        />

        {/* Dot grid */}
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--admin-accent-soft) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          }}
        />

        <div className="relative flex items-center justify-center min-h-[580px] py-10 px-6" key={state.currentStepIdx}>
          <div className="ulp-scene-enter w-full">
            {currentStep ? (
              <Scene scene={currentStep.scene} stepProgress={stepProgress} />
            ) : (
              <div className="flex items-center justify-center min-h-[460px]">
                <p style={{ fontSize: 16, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.2em' }}>
                  READY · PRESS PLAY
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Narration + controls ─── */}
      <div
        className="rounded-[24px] p-6 space-y-5 relative overflow-hidden"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {currentStep && (
          <div className="flex items-start gap-4" key={`narr-${state.currentStepIdx}`}>
            <span
              className="shrink-0 mt-0.5"
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.2em',
                color: 'var(--admin-fg)',
                paddingTop: 4,
              }}
            >
              ◆
            </span>
            <p
              className="flex-1"
              style={{
                fontSize: 17,
                fontWeight: 400,
                lineHeight: 1.55,
                color: 'var(--admin-fg)',
                letterSpacing: '-0.012em',
                animation: 'tech-narration-in 0.5s cubic-bezier(0.32, 0.72, 0, 1) 0.15s both',
              }}
            >
              {currentStep.narration}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap pt-5" style={{ borderTop: '0.5px solid var(--admin-border)' }}>
          <div className="flex items-center gap-2">
            {!state.isPlaying ? (
              <button
                onClick={play}
                className="inline-flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-full transition-all duration-300 hover:opacity-90 active:scale-95"
                style={{
                  background: 'var(--admin-accent)',
                  color: 'var(--admin-bg)',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '-0.005em',
                  boxShadow: '0 4px 24px var(--admin-accent-glow), 0 0 0 0.5px var(--admin-accent-glow) inset',
                }}
              >
                <span className="material-symbols-outlined" data-fill="1" style={{ fontSize: 20 }}>
                  play_arrow
                </span>
                {state.isFinished ? 'Reproducir de nuevo' : state.currentStepIdx > 0 ? 'Continuar' : 'Reproducir'}
              </button>
            ) : (
              <button
                onClick={pause}
                className="inline-flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-full transition-all duration-300 hover:opacity-90 active:scale-95"
                style={{
                  background: 'var(--admin-accent-soft)',
                  color: 'var(--admin-fg)',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '-0.005em',
                  border: '0.5px solid var(--admin-border-strong)',
                }}
              >
                <span className="material-symbols-outlined" data-fill="1" style={{ fontSize: 20 }}>
                  pause
                </span>
                Pausar
              </button>
            )}

            <button
              onClick={reset}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 hover:bg-white/5 active:scale-95"
              style={{ color: 'var(--admin-fg-muted)', border: '0.5px solid var(--admin-border)' }}
              title="Reiniciar"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>restart_alt</span>
            </button>
          </div>

          <div
            className="inline-flex items-center gap-1 p-1 rounded-full"
            style={{
              background: 'var(--admin-accent-soft)',
              border: '0.5px solid var(--admin-border)',
            }}
          >
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className="px-3 py-1 rounded-full transition-all duration-300"
                style={{
                  background: state.speed === s ? 'var(--admin-accent)' : 'transparent',
                  color: state.speed === s ? 'var(--admin-bg)' : 'var(--admin-fg-subtle)',
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 11,
                  fontWeight: state.speed === s ? 700 : 500,
                  letterSpacing: '0.05em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tech-narration-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tech-progress-shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        @keyframes tech-ping-dot {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.6); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function CornerMark({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    width: 20,
    height: 20,
    border: '1px solid var(--admin-accent-glow)',
    pointerEvents: 'none',
  }
  const corners: Record<typeof pos, React.CSSProperties> = {
    tl: { top: 14, left: 14, borderRight: 'none', borderBottom: 'none' },
    tr: { top: 14, right: 14, borderLeft: 'none', borderBottom: 'none' },
    bl: { bottom: 14, left: 14, borderRight: 'none', borderTop: 'none' },
    br: { bottom: 14, right: 14, borderLeft: 'none', borderTop: 'none' },
  }
  return <span aria-hidden style={{ ...baseStyle, ...corners[pos] }} />
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

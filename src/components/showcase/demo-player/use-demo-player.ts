'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DemoScript } from './types'

interface PlayerState {
  currentStepIdx: number
  isPlaying: boolean
  speed: number
  elapsedInStepMs: number
  isFinished: boolean
}

const TICK_MS = 100

export function useDemoPlayer(script: DemoScript) {
  const [state, setState] = useState<PlayerState>({
    currentStepIdx: 0,
    isPlaying: false,
    speed: 1,
    elapsedInStepMs: 0,
    isFinished: false,
  })

  useEffect(() => {
    if (!state.isPlaying) return

    const interval = setInterval(() => {
      setState((prev) => {
        if (!prev.isPlaying) return prev
        const currentStep = script.steps[prev.currentStepIdx]
        if (!currentStep) return prev

        const nextElapsed = prev.elapsedInStepMs + TICK_MS * prev.speed
        if (nextElapsed < currentStep.duration) {
          return { ...prev, elapsedInStepMs: nextElapsed }
        }

        const nextIdx = prev.currentStepIdx + 1
        if (nextIdx >= script.steps.length) {
          return { ...prev, isPlaying: false, isFinished: true, elapsedInStepMs: currentStep.duration }
        }
        return { ...prev, currentStepIdx: nextIdx, elapsedInStepMs: 0 }
      })
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [state.isPlaying, script.steps])

  const play = useCallback(() => {
    setState((prev) =>
      prev.isFinished
        ? { ...prev, currentStepIdx: 0, elapsedInStepMs: 0, isFinished: false, isPlaying: true }
        : { ...prev, isPlaying: true },
    )
  }, [])

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }))
  }, [])

  const reset = useCallback(() => {
    setState({ currentStepIdx: 0, isPlaying: false, speed: 1, elapsedInStepMs: 0, isFinished: false })
  }, [])

  const setSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, speed }))
  }, [])

  const skipToPhase = useCallback(
    (phaseCode: string) => {
      const idx = script.steps.findIndex((s) => s.phase === phaseCode)
      if (idx >= 0) {
        setState((prev) => ({ ...prev, currentStepIdx: idx, elapsedInStepMs: 0, isFinished: false }))
      }
    },
    [script.steps],
  )

  const totalElapsedMs =
    script.steps.slice(0, state.currentStepIdx).reduce((acc, s) => acc + s.duration, 0) + state.elapsedInStepMs
  const progress = script.totalDurationMs > 0 ? totalElapsedMs / script.totalDurationMs : 0

  const currentStep = script.steps[state.currentStepIdx]
  const stepProgress = currentStep ? state.elapsedInStepMs / currentStep.duration : 0

  return {
    state,
    currentStep,
    stepProgress: Math.min(1, stepProgress),
    progress: Math.min(1, progress),
    play,
    pause,
    reset,
    setSpeed,
    skipToPhase,
  }
}

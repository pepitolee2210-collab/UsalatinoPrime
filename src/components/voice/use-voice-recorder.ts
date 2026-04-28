'use client'

import { useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'processing' | 'error'

interface UseVoiceRecorderOptions {
  /** Duración máxima de grabación en ms. Por defecto 5 min. */
  maxDurationMs?: number
  /** Callback al finalizar la grabación con el blob de audio. */
  onComplete?: (blob: Blob) => void
  /** Callback al recibir un error (permiso denegado, mic no disponible). */
  onError?: (message: string) => void
}

/**
 * Hook para grabar audio del usuario en el browser.
 *
 * Uso:
 *   const rec = useVoiceRecorder({ onComplete: blob => upload(blob) })
 *   rec.start()  // pide permiso si hace falta y graba
 *   rec.stop()   // dispara onComplete
 *
 * Soporta visualización de niveles de audio via `audioLevel` (0-1).
 */
export function useVoiceRecorder({
  maxDurationMs = 5 * 60 * 1000,
  onComplete,
  onError,
}: UseVoiceRecorderOptions = {}) {
  const [state, setState] = useState<RecorderState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTsRef = useRef<number | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current)
    if (analyserRef.current) {
      try { analyserRef.current.disconnect() } catch {}
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {})
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    rafRef.current = null
    elapsedTimerRef.current = null
    maxTimeoutRef.current = null
    audioCtxRef.current = null
    analyserRef.current = null
    setAudioLevel(0)
  }

  useEffect(() => {
    return () => cleanup()
  }, [])

  async function start() {
    if (state === 'recording' || state === 'requesting') return
    setError(null)
    setElapsedMs(0)
    chunksRef.current = []
    setState('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream

      // Setup MediaRecorder con codec más liviano disponible
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
      ]
      const mimeType = candidates.find(c => MediaRecorder.isTypeSupported(c)) || ''
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = mr

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
      }

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        cleanup()
        setState('processing')
        chunksRef.current = []
        if (onComplete) {
          try { onComplete(blob) }
          catch (err) {
            console.error('onComplete error', err)
          }
        }
      }

      mr.onerror = (ev) => {
        const msg = (ev as unknown as { error?: { message?: string } })?.error?.message || 'Error al grabar'
        setError(msg)
        setState('error')
        cleanup()
        onError?.(msg)
      }

      // Setup analizador para visualización de nivel
      try {
        const AudioCtx: typeof AudioContext =
          typeof window !== 'undefined'
            ? ((window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext)
            : (undefined as unknown as typeof AudioContext)
        if (AudioCtx) {
          const ctx = new AudioCtx()
          audioCtxRef.current = ctx
          const source = ctx.createMediaStreamSource(stream)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          analyserRef.current = analyser

          const buffer = new Uint8Array(analyser.frequencyBinCount)
          const tick = () => {
            if (!analyserRef.current) return
            analyserRef.current.getByteTimeDomainData(buffer)
            // RMS approximation
            let sum = 0
            for (let i = 0; i < buffer.length; i++) {
              const v = (buffer[i] - 128) / 128
              sum += v * v
            }
            const rms = Math.sqrt(sum / buffer.length)
            setAudioLevel(Math.min(1, rms * 4))
            rafRef.current = requestAnimationFrame(tick)
          }
          tick()
        }
      } catch {
        // Si AudioContext falla no es crítico; seguimos sin visualización
      }

      mr.start(500) // chunks de 500ms para que ondataavailable se dispare seguido
      startTsRef.current = Date.now()
      setState('recording')

      // Timer visible
      elapsedTimerRef.current = setInterval(() => {
        if (startTsRef.current) setElapsedMs(Date.now() - startTsRef.current)
      }, 100)

      // Auto-stop al máximo
      maxTimeoutRef.current = setTimeout(() => {
        if (mr.state === 'recording') mr.stop()
      }, maxDurationMs)
    } catch (err) {
      const e = err as Error
      const friendly = e.name === 'NotAllowedError'
        ? 'Permiso de micrófono denegado. Habilita el micrófono en tu navegador para grabar.'
        : e.name === 'NotFoundError'
          ? 'No se detectó un micrófono en este dispositivo.'
          : e.message || 'No se pudo acceder al micrófono'
      setError(friendly)
      setState('error')
      cleanup()
      onError?.(friendly)
    }
  }

  function stop() {
    const mr = mediaRecorderRef.current
    if (mr && mr.state === 'recording') mr.stop()
  }

  function reset() {
    cleanup()
    setState('idle')
    setError(null)
    setElapsedMs(0)
    setAudioLevel(0)
  }

  function setProcessing(on: boolean) {
    setState(on ? 'processing' : 'idle')
  }

  return {
    state,
    error,
    elapsedMs,
    audioLevel,
    start,
    stop,
    reset,
    setProcessing,
  }
}

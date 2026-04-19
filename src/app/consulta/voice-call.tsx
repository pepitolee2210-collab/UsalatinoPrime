'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowLeft, PhoneOff, Loader2, Mic, MicOff } from 'lucide-react'
import { SiriOrb } from './siri-orb'

type CallState = 'idle' | 'connecting' | 'active' | 'ended' | 'error'

interface LiveSession {
  sendRealtimeInput: (params: { audio: { data: string; mimeType: string } }) => void
  sendToolResponse: (params: { functionResponses: Array<{ id: string; name: string; response: Record<string, unknown> }> }) => void
  close: () => void
}

interface ToolCallData {
  functionCalls?: Array<{ id: string; name: string; args: Record<string, string> }>
}

interface VoiceCallProps {
  onBack: () => void
}

const DEV = process.env.NODE_ENV === 'development'
const log = DEV ? console.log.bind(console) : () => {}
const warn = DEV ? console.warn.bind(console) : () => {}
const err = console.error.bind(console)

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked conversion avoids "argument too long" errors and is much faster
  // than a per-character string concat loop.
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)),
    )
  }
  return btoa(binary)
}

export function VoiceCall({ onBack }: VoiceCallProps) {
  const [callState, setCallState] = useState<CallState>('idle')
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)

  const sessionRef = useRef<LiveSession | null>(null)
  const aliveRef = useRef(false)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const captureCtxRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const mutedRef = useRef(false)
  const audioLevelRef = useRef(0)

  // Per-call state
  const callIdRef = useRef<string | null>(null)
  const callStartRef = useRef<number>(0)
  const leadIdRef = useRef<string | null>(null)
  const appointmentIdRef = useRef<string | null>(null)
  const toolsInvokedRef = useRef<Array<{ name: string; at: number; ok: boolean }>>([])
  const closedRef = useRef(false)
  // Reconnection on network hiccups (4G→WiFi, transient WSS drops)
  const reconnectAttemptsRef = useRef(0)
  const MAX_RECONNECT = 2

  const reportCallClose = useCallback((endReason: string, errorMessage?: string) => {
    if (closedRef.current || !callIdRef.current) return
    closedRef.current = true
    const duration = callStartRef.current
      ? Math.floor((Date.now() - callStartRef.current) / 1000)
      : 0
    const payload = JSON.stringify({
      call_id: callIdRef.current,
      duration_seconds: duration,
      end_reason: endReason,
      error_message: errorMessage,
      lead_id: leadIdRef.current,
      appointment_id: appointmentIdRef.current,
      tools_invoked: toolsInvokedRef.current,
    })

    // sendBeacon survives page unload (tab close, navigation); falls back to
    // keepalive fetch if Beacon isn't available (rare).
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' })
        const sent = navigator.sendBeacon('/api/voice-agent/close', blob)
        if (sent) return
      }
    } catch {
      // fall through to fetch
    }
    fetch('/api/voice-agent/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => { /* telemetry best-effort */ })
  }, [])

  const cleanup = useCallback(() => {
    aliveRef.current = false

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (workletNodeRef.current) {
      try { workletNodeRef.current.port.close() } catch { /* already closed */ }
      try { workletNodeRef.current.disconnect() } catch { /* already disconnected */ }
      workletNodeRef.current = null
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect() } catch { /* already disconnected */ }
      sourceNodeRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    if (captureCtxRef.current?.state !== 'closed') {
      captureCtxRef.current?.close()
      captureCtxRef.current = null
    }
    if (playbackCtxRef.current?.state !== 'closed') {
      playbackCtxRef.current?.close()
      playbackCtxRef.current = null
    }
    if (sessionRef.current) {
      try { sessionRef.current.close() } catch { /* already closed */ }
      sessionRef.current = null
    }
  }, [])

  useEffect(() => {
    const onPageHide = () => {
      if (callIdRef.current && !closedRef.current) {
        reportCallClose('page-hide')
      }
    }
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      if (callIdRef.current && !closedRef.current) {
        reportCallClose('unmount')
      }
      cleanup()
    }
  }, [cleanup, reportCallClose])

  useEffect(() => {
    if (callState !== 'active') return
    const interval = setInterval(() => {
      audioLevelRef.current *= 0.85
      setAudioLevel(audioLevelRef.current)
    }, 50)
    return () => clearInterval(interval)
  }, [callState])

  function safeSendAudio(data: string) {
    if (!aliveRef.current || !sessionRef.current) return
    try {
      sessionRef.current.sendRealtimeInput({
        audio: { data, mimeType: 'audio/pcm;rate=16000' },
      })
    } catch {
      aliveRef.current = false
    }
  }

  function safeSendToolResponse(id: string, name: string, response: Record<string, unknown>) {
    if (!aliveRef.current || !sessionRef.current) return
    try {
      sessionRef.current.sendToolResponse({ functionResponses: [{ id, name, response }] })
    } catch {
      aliveRef.current = false
    }
  }

  function calculateRMS(samples: Float32Array): number {
    let sum = 0
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
    return Math.sqrt(sum / samples.length)
  }

  /**
   * Opens a Gemini Live WebSocket session using the already-acquired
   * mediaStream + AudioContexts. Separated from startCall so that
   * reconnection can reuse existing audio resources (no new mic prompt).
   */
  async function openLiveSession(params: {
    token: string
    model: string
    config: Record<string, unknown>
    isReconnect: boolean
  }): Promise<void> {
    const { token, model, config, isReconnect } = params
    const { GoogleGenAI, Modality } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } })
    const playbackCtx = playbackCtxRef.current!

    let nextPlayTime = 0
    function queueAudio(pcmBase64: string) {
      if (!aliveRef.current) return
      const raw = atob(pcmBase64)
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
      const int16 = new Int16Array(bytes.buffer)
      const float32 = new Float32Array(int16.length)
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768

      const rms = calculateRMS(float32)
      const normalized = Math.min(1, rms * 4)
      if (normalized > audioLevelRef.current) audioLevelRef.current = normalized

      const buffer = playbackCtx.createBuffer(1, float32.length, 24000)
      buffer.copyToChannel(new Float32Array(float32) as Float32Array<ArrayBuffer>, 0)
      const source = playbackCtx.createBufferSource()
      source.buffer = buffer
      source.connect(playbackCtx.destination)

      const now = playbackCtx.currentTime
      if (nextPlayTime < now) nextPlayTime = now + 0.05
      source.start(nextPlayTime)
      nextPlayTime += float32.length / 24000
    }

    const session = await ai.live.connect({
      model,
      config: { ...config, responseModalities: [Modality.AUDIO] },
      callbacks: {
        onopen: () => {
          aliveRef.current = true
          if (!isReconnect) {
            callStartRef.current = Date.now()
          }
          reconnectAttemptsRef.current = 0 // successful connection resets the budget
          setCallState('active')
          setStatusText('')
          if (!timerRef.current && !isReconnect) {
            let seconds = 0
            timerRef.current = setInterval(() => {
              seconds++
              setCallDuration(seconds)
              if (seconds >= 900) endCall('timeout')
            }, 1000)
          }
        },
        onmessage: (message: unknown) => {
          if (!aliveRef.current) return
          const msg = message as Record<string, unknown>

          const serverContent = msg.serverContent as Record<string, unknown> | undefined
          const modelTurn = serverContent?.modelTurn as { parts?: Array<{ inlineData?: { data?: string } }> } | undefined
          if (modelTurn?.parts) {
            for (const part of modelTurn.parts) {
              if (part.inlineData?.data) queueAudio(part.inlineData.data)
            }
          }

          if (msg.toolCall) handleToolCall(msg.toolCall as ToolCallData)
        },
        onerror: (e: Event | { message?: string }) => {
          err('Live API error', e)
          aliveRef.current = false
          const msg = 'message' in e ? (e as { message: string }).message : 'Error en la conexión de voz'
          // onerror is usually followed by onclose — let that handler decide
          // whether to reconnect or fail. Only fail outright if we were never
          // connected (e.g. initial handshake failure).
          if (callStartRef.current === 0) {
            setErrorMessage(msg)
            setCallState('error')
            reportCallClose('error', msg)
            cleanup()
          }
        },
        onclose: (e: CloseEvent | Event) => {
          aliveRef.current = false
          sessionRef.current = null
          const closeEvent = e as CloseEvent
          const code = closeEvent.code || 0
          const isAbnormal = code !== 0 && code !== 1000 && code !== 1005

          if (closedRef.current) {
            // User already requested hangup; don't retry.
            setCallState('ended')
            cleanup()
            return
          }

          if (isAbnormal && reconnectAttemptsRef.current < MAX_RECONNECT && callStartRef.current > 0) {
            reconnectAttemptsRef.current += 1
            setStatusText(`Reconectando... (${reconnectAttemptsRef.current}/${MAX_RECONNECT})`)
            attemptReconnect().catch(reconnectErr => {
              err('Reconnect failed', reconnectErr)
              const failMsg = reconnectErr instanceof Error
                ? reconnectErr.message
                : 'Perdimos la conexión'
              setErrorMessage(failMsg)
              setCallState('error')
              reportCallClose('reconnect-failed', failMsg)
              cleanup()
            })
            return
          }

          if (isAbnormal) {
            const reason = `Conexión cerrada: ${closeEvent.reason || 'Error del servidor'} (${code})`
            setErrorMessage(reason)
            setCallState('error')
            reportCallClose('server-close', reason)
          } else {
            setCallState('ended')
            reportCallClose('user-hangup')
          }
          cleanup()
        },
      },
    }) as unknown as LiveSession

    sessionRef.current = session
  }

  /**
   * Fetches a new ephemeral token and opens a fresh Live API session,
   * reusing the existing mic stream and AudioContexts. Does NOT call
   * getUserMedia again (would re-prompt on some browsers).
   */
  async function attemptReconnect(): Promise<void> {
    const tokenRes = await fetch('/api/chatbot/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previous_call_id: callIdRef.current }),
    })
    if (!tokenRes.ok) {
      const errorBody = await tokenRes.json().catch(() => ({}))
      throw new Error(errorBody.error || 'No se pudo renovar el token')
    }
    const { token, model, config, call_id } = await tokenRes.json()
    if (call_id) callIdRef.current = call_id

    await openLiveSession({ token, model, config, isReconnect: true })
  }

  async function startCall() {
    setCallState('connecting')
    setStatusText('Conectando...')
    setErrorMessage('')
    closedRef.current = false
    leadIdRef.current = null
    appointmentIdRef.current = null
    toolsInvokedRef.current = []
    reconnectAttemptsRef.current = 0
    callStartRef.current = 0

    try {
      const tokenRes = await fetch('/api/chatbot/token', { method: 'POST' })
      if (!tokenRes.ok) {
        const errorBody = await tokenRes.json().catch(() => ({}))
        throw new Error(errorBody.error || 'Error al generar token')
      }
      const { token, model, config, call_id, business_hours } = await tokenRes.json()
      callIdRef.current = call_id ?? null

      if (business_hours && business_hours.open === false) {
        setStatusText('Fuera del horario de atención — puedes dejar tu número')
      } else {
        setStatusText('Iniciando micrófono...')
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
          },
        })
      } catch (micErr) {
        const name = micErr instanceof Error ? micErr.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          throw new Error('Permiso de micrófono denegado. Habilítalo en la configuración del navegador y recarga la página.')
        }
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          throw new Error('No se detectó micrófono. Conecta uno e intenta de nuevo.')
        }
        if (name === 'NotReadableError') {
          throw new Error('El micrófono está en uso por otra aplicación. Ciérrala e intenta de nuevo.')
        }
        throw new Error('No se pudo acceder al micrófono.')
      }
      mediaStreamRef.current = stream

      setStatusText('Conectando con el asistente...')

      const playbackCtx = new AudioContext({ sampleRate: 24000 })
      playbackCtxRef.current = playbackCtx
      const captureCtx = new AudioContext({ sampleRate: 16000 })
      captureCtxRef.current = captureCtx

      // Load AudioWorklet module (replaces deprecated ScriptProcessorNode).
      try {
        await captureCtx.audioWorklet.addModule('/voice-capture-processor.js')
      } catch (workletErr) {
        err('AudioWorklet load failed', workletErr)
        throw new Error('Tu navegador no soporta captura de audio moderna. Prueba con Chrome o Safari actualizado.')
      }

      await openLiveSession({ token, model, config, isReconnect: false })

      // Mic capture through AudioWorklet
      const sourceNode = captureCtx.createMediaStreamSource(stream)
      sourceNodeRef.current = sourceNode

      const worklet = new AudioWorkletNode(captureCtx, 'voice-capture-processor')
      workletNodeRef.current = worklet

      worklet.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) => {
        if (mutedRef.current || !aliveRef.current) return
        const { pcm, rms } = event.data
        const normalized = Math.min(1, rms * 6)
        if (normalized > audioLevelRef.current) audioLevelRef.current = normalized

        const bytes = new Uint8Array(pcm)
        safeSendAudio(bytesToBase64(bytes))
      }

      sourceNode.connect(worklet)
      // Worklet must be connected to destination for processing to run, but we
      // don't want to hear our own mic — route through a muted gain node.
      const silentGain = captureCtx.createGain()
      silentGain.gain.value = 0
      worklet.connect(silentGain)
      silentGain.connect(captureCtx.destination)

    } catch (e: unknown) {
      err('Voice call error', e)
      const message = e instanceof Error ? e.message : 'Error al conectar'
      setErrorMessage(message)
      setCallState('error')
      reportCallClose('error', message)
      cleanup()
    }
  }

  async function handleToolCall(toolCall: ToolCallData) {
    const functionCalls = toolCall.functionCalls
    if (!functionCalls || functionCalls.length === 0) {
      warn('toolCall received but no functionCalls')
      return
    }

    for (const fc of functionCalls) {
      log('function call', fc.name, fc.args)
      const tStart = Date.now()

      if (fc.name === 'create_lead') {
        const args = fc.args || {}
        try {
          const body = {
            name: String(args.name || ''),
            phone: String(args.phone || ''),
            service_interest: String(args.service_interest || 'visa-juvenil'),
            situation_summary: String(args.situation_summary || ''),
          }
          const res = await fetch('/api/chatbot/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const result = await res.json()
          if (result?.id) leadIdRef.current = result.id
          toolsInvokedRef.current.push({ name: 'create_lead', at: tStart, ok: !!result?.success })
          safeSendToolResponse(fc.id, 'create_lead', result)
        } catch {
          toolsInvokedRef.current.push({ name: 'create_lead', at: tStart, ok: false })
          safeSendToolResponse(fc.id, 'create_lead', { error: 'No se pudo registrar' })
        }
        continue
      }

      if (fc.name === 'get_available_slots') {
        const args = fc.args || {}
        try {
          const date = String(args.date || '')
          const res = await fetch(`/api/voice-agent/slots?date=${encodeURIComponent(date)}`)
          const result = await res.json()
          toolsInvokedRef.current.push({ name: 'get_available_slots', at: tStart, ok: res.ok })
          safeSendToolResponse(fc.id, 'get_available_slots', result)
        } catch {
          toolsInvokedRef.current.push({ name: 'get_available_slots', at: tStart, ok: false })
          safeSendToolResponse(fc.id, 'get_available_slots', { error: 'No se pudieron obtener los horarios' })
        }
        continue
      }

      if (fc.name === 'book_appointment') {
        const args = fc.args || {}
        try {
          const body = {
            name: String(args.name || ''),
            phone: String(args.phone || ''),
            scheduled_at: String(args.scheduled_at || ''),
            notes: String(args.notes || ''),
            call_id: callIdRef.current,
          }
          const res = await fetch('/api/voice-agent/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const result = await res.json()
          if (result?.appointment?.id) appointmentIdRef.current = result.appointment.id
          toolsInvokedRef.current.push({ name: 'book_appointment', at: tStart, ok: !!result?.success })
          safeSendToolResponse(fc.id, 'book_appointment', result)
        } catch {
          toolsInvokedRef.current.push({ name: 'book_appointment', at: tStart, ok: false })
          safeSendToolResponse(fc.id, 'book_appointment', { error: 'No se pudo agendar' })
        }
        continue
      }

      warn('unknown function', fc.name)
    }
  }

  function endCall(reason: string = 'user-hangup') {
    setCallState('ended')
    reportCallClose(reason)
    cleanup()
  }

  function toggleMute() {
    setIsMuted(prev => {
      const newMuted = !prev
      mutedRef.current = newMuted
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted })
      }
      return newMuted
    })
  }

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const orbState =
    callState === 'connecting' ? 'connecting' :
    callState === 'error' ? 'error' :
    callState === 'active' ? 'active' :
    'idle'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <button
        onClick={() => { cleanup(); onBack() }}
        className="absolute top-4 left-4 text-white/30 hover:text-white/70 flex items-center gap-1.5 text-sm transition-colors z-20"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <div className="flex flex-col items-center">
        <div className="mb-8">
          <SiriOrb
            state={orbState}
            audioLevel={audioLevel}
            size={callState === 'active' ? 180 : callState === 'idle' ? 160 : 150}
          />
        </div>

        <div className="text-center mb-10 min-h-[60px]">
          <h2 className="text-white text-lg font-medium tracking-tight mb-1">
            {callState === 'idle' && 'Asistente de voz'}
            {callState === 'connecting' && 'Conectando...'}
            {callState === 'active' && 'En llamada'}
            {callState === 'ended' && 'Llamada finalizada'}
            {callState === 'error' && 'Error de conexión'}
          </h2>

          {callState === 'idle' && (
            <p className="text-white/30 text-sm">Toca el botón para iniciar</p>
          )}
          {callState === 'connecting' && (
            <div className="flex items-center justify-center gap-2 text-[#F2A900]/70 text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {statusText}
            </div>
          )}
          {callState === 'active' && (
            <p className="text-white/40 text-sm font-mono tabular-nums">
              {formatDuration(callDuration)}
            </p>
          )}
          {callState === 'ended' && (
            <p className="text-white/30 text-sm">
              Duración: {formatDuration(callDuration)}
            </p>
          )}
          {callState === 'error' && (
            <p className="text-red-400/70 text-xs max-w-xs mx-auto leading-relaxed">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-5">
          {callState === 'idle' && (
            <button
              onClick={startCall}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0ea5e9] to-[#8b5cf6] flex items-center justify-center hover:shadow-lg hover:shadow-[#0ea5e9]/30 transition-all duration-300 active:scale-95"
            >
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          )}

          {callState === 'active' && (
            <>
              <button
                onClick={toggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isMuted
                    ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
                    : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white/70'
                }`}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                onClick={() => endCall('user-hangup')}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center hover:shadow-lg hover:shadow-red-500/30 transition-all duration-300 active:scale-95"
              >
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
            </>
          )}

          {callState === 'connecting' && (
            <button
              onClick={() => { setCallState('idle'); cleanup() }}
              className="w-16 h-16 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-all duration-300"
            >
              <PhoneOff className="w-7 h-7 text-white/50" />
            </button>
          )}

          {(callState === 'ended' || callState === 'error') && (
            <button
              onClick={() => { setCallState('idle'); setCallDuration(0); setErrorMessage(''); setAudioLevel(0); closedRef.current = false }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0ea5e9] to-[#8b5cf6] flex items-center justify-center hover:shadow-lg hover:shadow-[#0ea5e9]/30 transition-all duration-300 active:scale-95"
            >
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="absolute bottom-6 text-center">
        <p className="text-white/15 text-[10px]">Duración máxima: 15 minutos</p>
        {callState === 'active' && (
          <p className="text-white/10 text-[9px] mt-0.5">La IA puede cometer errores. No es asesoría legal.</p>
        )}
      </div>
    </div>
  )
}

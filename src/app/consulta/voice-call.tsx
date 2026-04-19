'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowLeft, PhoneOff, Loader2, Mic, MicOff } from 'lucide-react'
import { SiriOrb } from './siri-orb'

type CallState = 'idle' | 'connecting' | 'active' | 'ended' | 'error'

interface LiveSession {
  sendRealtimeInput: (params: { audio: { data: string; mimeType: string } }) => void
  sendToolResponse: (params: { functionResponses: Array<{ id: string; name: string; response: Record<string, unknown> }> }) => void
  sendClientContent: (params: { turns?: Array<{ role: string; parts: Array<{ text: string }> }>; turnComplete?: boolean }) => void
  close: () => void
}

interface ConversationTurn {
  role: 'user' | 'assistant'
  text: string
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
  // Live captioning — chunks as they arrive from Gemini (no wait for finished).
  const [liveUserText, setLiveUserText] = useState('')
  const [liveAssistantText, setLiveAssistantText] = useState('')
  // Orb visual state derived from conversation flow.
  const [orbState, setOrbState] = useState<'idle' | 'connecting' | 'active' | 'error' | 'listening' | 'speaking' | 'processing'>('idle')
  // Confirmation displayed after a successful book_appointment.
  const [appointmentConfirmed, setAppointmentConfirmed] = useState<{ date: string; time: string } | null>(null)

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
  // Latest noise-gate snapshot from the worklet. Reported at close for
  // observability ("is the gate blocking too much or too little?").
  const gateStatsRef = useRef<{
    framesTotal: number
    framesGateOpen: number
    framesGateClosed: number
    noiseFloor: number
  } | null>(null)

  // Conversation memory — transcriptions captured from Gemini Live.
  // On reconnect we either resume via sessionHandle or replay this history
  // as context so the model doesn't ask "¿cómo te llamas?" again.
  const conversationHistoryRef = useRef<ConversationTurn[]>([])
  const sessionHandleRef = useRef<string | null>(null)
  // In-flight transcription fragments (Gemini emits chunks until finished=true).
  const pendingUserTextRef = useRef('')
  const pendingAssistantTextRef = useRef('')
  // Tracks whether the model is currently speaking (for orb visual state).
  // We consider the model "speaking" while audio chunks arrive + 300ms tail.
  const modelSpeakingUntilRef = useRef<number>(0)
  const pendingToolCallsRef = useRef<number>(0)

  const reportCallClose = useCallback((endReason: string, errorMessage?: string) => {
    if (closedRef.current || !callIdRef.current) return
    closedRef.current = true
    const duration = callStartRef.current
      ? Math.floor((Date.now() - callStartRef.current) / 1000)
      : 0

    const gs = gateStatsRef.current
    const gateStatsPayload = gs && gs.framesTotal > 0
      ? {
          open_pct: +(gs.framesGateOpen / gs.framesTotal).toFixed(3),
          noise_floor: +gs.noiseFloor.toFixed(4),
          frames_total: gs.framesTotal,
        }
      : null

    const payload = JSON.stringify({
      call_id: callIdRef.current,
      duration_seconds: duration,
      end_reason: endReason,
      error_message: errorMessage,
      lead_id: leadIdRef.current,
      appointment_id: appointmentIdRef.current,
      tools_invoked: toolsInvokedRef.current,
      gate_stats: gateStatsPayload,
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

  // Derive orb visual state from live conversation signals. Runs while the
  // call is active; priority: speaking > processing (tool call) > listening
  // (user talking) > active (quiet). We poll refs at 150ms which is smooth
  // enough for visual feedback without being wasteful.
  useEffect(() => {
    if (callState !== 'active') {
      // The orb doesn't have an 'ended' visual — fall back to idle so the
      // static ring is shown while the confirmation/error card takes focus.
      setOrbState(callState === 'ended' ? 'idle' : callState)
      return
    }
    const interval = setInterval(() => {
      const now = Date.now()
      if (modelSpeakingUntilRef.current > now) {
        setOrbState('speaking')
      } else if (pendingToolCallsRef.current > 0) {
        setOrbState('processing')
      } else if (audioLevelRef.current > 0.04 && !mutedRef.current) {
        setOrbState('listening')
      } else {
        setOrbState('active')
      }
    }, 150)
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
          // On reconnect: if we had conversation history, replay a summary
          // as a text turn. This is the fallback when session resumption by
          // handle doesn't preserve state (or when there was no handle).
          if (isReconnect && conversationHistoryRef.current.length > 0) {
            try {
              const lastTurns = conversationHistoryRef.current.slice(-10)
              const summary = lastTurns
                .map(t => `${t.role === 'user' ? 'Cliente' : 'Asistente'}: ${t.text}`)
                .join('\n')
              const contextMessage =
                `[Reconexión] Se cayó la conexión brevemente. Acabamos de hablar esto:\n${summary}\n\nRetoma EXACTAMENTE donde quedamos. NO vuelvas a saludar, NO vuelvas a pedir el nombre ni el estado. Solo di algo corto como "Te escucho de nuevo" o continúa con la siguiente pregunta del flujo.`
              // Fire-and-forget — if the session isn't ready yet sendClientContent
              // will throw and we just move on (the prompt instructions still
              // cover the case).
              session.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: contextMessage }] }],
                turnComplete: true,
              })
              log('Reinjected context with', lastTurns.length, 'turns')
            } catch (reinjectErr) {
              warn('sendClientContent failed during reconnect', reinjectErr)
            }
          }
        },
        onmessage: (message: unknown) => {
          if (!aliveRef.current) return
          const msg = message as Record<string, unknown>

          const serverContent = msg.serverContent as Record<string, unknown> | undefined
          const modelTurn = serverContent?.modelTurn as { parts?: Array<{ inlineData?: { data?: string } }> } | undefined
          if (modelTurn?.parts) {
            for (const part of modelTurn.parts) {
              if (part.inlineData?.data) {
                queueAudio(part.inlineData.data)
                // Model is actively speaking; extend the speaking window.
                modelSpeakingUntilRef.current = Date.now() + 400
              }
            }
          }

          // Capture transcriptions (both the user's speech and the model's
          // replies). Gemini emits chunks until `finished: true`, so we
          // buffer fragments and commit to history on finish. We ALSO push
          // the partial text to state so captions render live as Gemini
          // streams — better UX than waiting until the turn ends.
          if (serverContent) {
            const input = serverContent.inputTranscription as { text?: string; finished?: boolean } | undefined
            if (input) {
              if (input.text) {
                pendingUserTextRef.current += input.text
                setLiveUserText(pendingUserTextRef.current)
                setLiveAssistantText('') // user took the floor; clear AI caption
              }
              if (input.finished) {
                const text = pendingUserTextRef.current.trim()
                if (text) conversationHistoryRef.current.push({ role: 'user', text })
                pendingUserTextRef.current = ''
                // Keep the final text visible for a moment, then clear.
                setTimeout(() => setLiveUserText(''), 1500)
              }
            }
            const output = serverContent.outputTranscription as { text?: string; finished?: boolean } | undefined
            if (output) {
              if (output.text) {
                pendingAssistantTextRef.current += output.text
                setLiveAssistantText(pendingAssistantTextRef.current)
                setLiveUserText('')
              }
              if (output.finished) {
                const text = pendingAssistantTextRef.current.trim()
                if (text) conversationHistoryRef.current.push({ role: 'assistant', text })
                pendingAssistantTextRef.current = ''
                setTimeout(() => setLiveAssistantText(''), 1500)
              }
            }
          }

          // Capture the session handle so we can resume the conversation
          // server-side if the WebSocket drops.
          const resumption = msg.sessionResumptionUpdate as { newHandle?: string; resumable?: boolean } | undefined
          if (resumption?.newHandle && resumption.resumable !== false) {
            sessionHandleRef.current = resumption.newHandle
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
      body: JSON.stringify({
        previous_call_id: callIdRef.current,
        previous_session_handle: sessionHandleRef.current,
      }),
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
    gateStatsRef.current = null
    conversationHistoryRef.current = []
    sessionHandleRef.current = null
    pendingUserTextRef.current = ''
    pendingAssistantTextRef.current = ''
    modelSpeakingUntilRef.current = 0
    pendingToolCallsRef.current = 0
    setLiveUserText('')
    setLiveAssistantText('')
    setAppointmentConfirmed(null)

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

      const worklet = new AudioWorkletNode(captureCtx, 'voice-capture-processor', {
        processorOptions: {
          calibrationMs: 1500,
          // Multiplier 1.3 keeps the gate permissive enough for soft-speakers
          // on phones with high-gain mics. The previous 2.5 combined with a
          // ceiling-pinned floor was blocking nearly all legit speech.
          gateMultiplier: 1.3,
          holdMs: 400,
          // Allow up to 0.08 RMS as ambient floor — covers phones with
          // aggressive autoGainControl that report elevated baseline energy
          // even in "quiet" rooms.
          maxGateAbsolute: 0.08,
        },
      })
      workletNodeRef.current = worklet

      type WorkletMsg =
        | { type: 'calibrated'; noiseFloor: number }
        | { type: 'calibration-retry'; attempt: number; floor: number }
        | { type: 'stats'; framesTotal: number; framesGateOpen: number; framesGateClosed: number; noiseFloor: number; t: number }
        | { rms: number; pcm?: ArrayBuffer }

      worklet.port.onmessage = (event: MessageEvent<WorkletMsg>) => {
        const msg = event.data
        if ('type' in msg) {
          if (msg.type === 'calibrated') {
            log('Noise gate calibrated at', msg.noiseFloor)
          } else if (msg.type === 'calibration-retry') {
            log('Noise gate calibration retry', msg.attempt, 'provisional floor', msg.floor)
          } else if (msg.type === 'stats') {
            gateStatsRef.current = {
              framesTotal: msg.framesTotal,
              framesGateOpen: msg.framesGateOpen,
              framesGateClosed: msg.framesGateClosed,
              noiseFloor: msg.noiseFloor,
            }
          }
          return
        }
        if (!('rms' in msg)) return

        const normalized = Math.min(1, msg.rms * 6)
        if (normalized > audioLevelRef.current) audioLevelRef.current = normalized

        // Only send PCM when the gate decided it's speech.
        if (msg.pcm && !mutedRef.current && aliveRef.current) {
          const bytes = new Uint8Array(msg.pcm)
          safeSendAudio(bytesToBase64(bytes))
        }
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
      // Count in-flight tool calls so the orb can show "processing".
      pendingToolCallsRef.current += 1

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
        pendingToolCallsRef.current = Math.max(0, pendingToolCallsRef.current - 1)
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
        pendingToolCallsRef.current = Math.max(0, pendingToolCallsRef.current - 1)
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
          // If the booking succeeded, capture the confirmation details so we
          // can show a big "Tu cita está agendada" screen after the call ends.
          if (result?.success && result?.confirmation) {
            setAppointmentConfirmed({
              date: String(result.confirmation.date || ''),
              time: String(result.confirmation.time || ''),
            })
          }
          toolsInvokedRef.current.push({ name: 'book_appointment', at: tStart, ok: !!result?.success })
          safeSendToolResponse(fc.id, 'book_appointment', result)
        } catch {
          toolsInvokedRef.current.push({ name: 'book_appointment', at: tStart, ok: false })
          safeSendToolResponse(fc.id, 'book_appointment', { error: 'No se pudo agendar' })
        }
        pendingToolCallsRef.current = Math.max(0, pendingToolCallsRef.current - 1)
        continue
      }

      warn('unknown function', fc.name)
      pendingToolCallsRef.current = Math.max(0, pendingToolCallsRef.current - 1)
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <button
        onClick={() => { cleanup(); onBack() }}
        className="absolute top-4 left-4 text-white/30 hover:text-white/70 flex items-center gap-1.5 text-sm transition-colors z-20"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      {/* Successful-booking confirmation screen — replaces the generic
          "llamada finalizada" view when the IA actually agendaron la cita. */}
      {callState === 'ended' && appointmentConfirmed ? (
        <div className="w-full max-w-[480px] px-4">
          {/* Status chip above the card */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center vc-label text-emerald-300/90">
              <span className="vc-dot vc-dot-green" />
              Cita confirmada
            </span>
          </div>

          {/* Boarding-pass-style ticket */}
          <div className="vc-ticket rounded-[28px] overflow-hidden">
            <div className="relative px-8 pt-10 pb-8 vc-reveal">
              {/* Animated check with ripple rings */}
              <div className="flex justify-center mb-8">
                <div className="vc-check-ring flex items-center justify-center">
                  <div className="relative z-10 w-[72px] h-[72px] rounded-full bg-emerald-500/12 ring-1 ring-emerald-400/50 flex items-center justify-center">
                    <svg className="w-9 h-9 text-emerald-300 vc-check-draw" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5 L10 17.5 L19 7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Big declarative headline — editorial serif */}
              <p className="vc-serif text-center text-white text-[28px] leading-[1.15] tracking-tight mb-8">
                Nos vemos pronto.
                <span className="block text-white/40 text-[18px] italic mt-1">
                  Tu cita quedó agendada.
                </span>
              </p>

              {/* Date stack — label + serif DISPLAY */}
              <div className="text-center">
                <p className="vc-label text-white/35 mb-3">Fecha de la cita</p>
                <p className="vc-serif text-[#F2D780] text-[22px] leading-tight uppercase tracking-[0.04em] font-medium">
                  {appointmentConfirmed.date}
                </p>
                <p className="vc-serif text-white text-[44px] leading-none mt-3 tracking-tight font-semibold tabular-nums">
                  {appointmentConfirmed.time}
                </p>
              </div>
            </div>

            {/* Perforated separator — classic ticket notches */}
            <div className="px-6">
              <div className="vc-ticket-perf" />
            </div>

            {/* Footer grid: who + reminder */}
            <div className="px-8 pt-6 pb-8 vc-reveal">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="vc-label text-white/35 mb-2">Con</p>
                  <p className="text-white text-sm font-medium leading-snug">Henry Orellana</p>
                  <p className="text-white/40 text-xs mt-0.5">UsaLatino Prime</p>
                </div>
                <div>
                  <p className="vc-label text-white/35 mb-2">Recordatorio</p>
                  <p className="text-white text-sm font-medium leading-snug">1 h antes</p>
                  <p className="text-white/40 text-xs mt-0.5">Te llamaremos</p>
                </div>
              </div>
            </div>
          </div>

          {/* Fine print + return button */}
          <p className="text-center text-white/35 text-[11px] mt-6 leading-relaxed px-4">
            Recibirás un aviso por teléfono una hora antes. Si necesitas reagendar, llama al 801-941-3479.
          </p>

          <div className="flex justify-center mt-5">
            <button
              onClick={() => { setCallState('idle'); setCallDuration(0); setErrorMessage(''); setAudioLevel(0); closedRef.current = false; setAppointmentConfirmed(null) }}
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/10 hover:ring-white/20 text-white/70 hover:text-white text-[13px] font-medium transition-all duration-300"
            >
              <span>Volver al inicio</span>
              <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
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
              onClick={() => { setCallState('idle'); setCallDuration(0); setErrorMessage(''); setAudioLevel(0); closedRef.current = false; setAppointmentConfirmed(null) }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0ea5e9] to-[#8b5cf6] flex items-center justify-center hover:shadow-lg hover:shadow-[#0ea5e9]/30 transition-all duration-300 active:scale-95"
            >
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          )}
        </div>

        {/* Live captions — transcriptions streamed from Gemini.
            Editorial format: wide-tracking monospace label + Fraunces serif
            for the AI's voice, lighter italic sans for the user's. A blinking
            caret signals live typing. */}
        {callState === 'active' && (liveAssistantText || liveUserText) && (
          <div className="mt-8 w-full max-w-[540px] px-6">
            {/* Faded hairline — atmospheric separator that frames the caption */}
            <div className="vc-hairline mb-5" />

            <div key={liveAssistantText ? 'ai' : 'user'} className="vc-enter min-h-[5rem]">
              {liveAssistantText ? (
                <>
                  <p className="vc-label text-[#F2A900]/60 mb-3">
                    <span className="vc-dot vc-dot-amber" />
                    La asistente
                  </p>
                  <p className="vc-serif vc-caret text-[#F8E5B0] text-[19px] leading-[1.55] font-normal">
                    {liveAssistantText}
                  </p>
                </>
              ) : liveUserText ? (
                <>
                  <p className="vc-label text-white/45 mb-3">
                    <span className="vc-dot vc-dot-white" />
                    Tú
                  </p>
                  <p className="text-white/75 text-[15px] leading-[1.65] italic font-light vc-caret">
                    {liveUserText}
                  </p>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
      )}

      <div className="absolute bottom-6 text-center">
        <p className="text-white/15 text-[10px]">Duración máxima: 15 minutos</p>
        {callState === 'active' && (
          <p className="text-white/10 text-[9px] mt-0.5">La IA puede cometer errores. No es asesoría legal.</p>
        )}
      </div>
    </div>
  )
}

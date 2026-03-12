'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowLeft, PhoneOff, Loader2, Mic, MicOff } from 'lucide-react'
import { SiriOrb } from './siri-orb'

type CallState = 'idle' | 'connecting' | 'active' | 'ended' | 'error'

// SDK session type — methods we use from the Live session
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

export function VoiceCall({ onBack }: VoiceCallProps) {
  const [callState, setCallState] = useState<CallState>('idle')
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)

  const sessionRef = useRef<LiveSession | null>(null)
  const aliveRef = useRef(false) // tracks if WebSocket is truly open
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const captureCtxRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const mutedRef = useRef(false)
  const audioLevelRef = useRef(0)

  const cleanup = useCallback(() => {
    // Mark dead FIRST — stops all sends immediately
    aliveRef.current = false

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
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
    return cleanup
  }, [cleanup])

  // Smooth audio level decay
  useEffect(() => {
    if (callState !== 'active') return
    const interval = setInterval(() => {
      audioLevelRef.current *= 0.85 // decay
      setAudioLevel(audioLevelRef.current)
    }, 50)
    return () => clearInterval(interval)
  }, [callState])

  // Safe send — silently drops if WebSocket is closing/closed
  function safeSendAudio(data: string) {
    if (!aliveRef.current || !sessionRef.current) return
    try {
      sessionRef.current.sendRealtimeInput({
        audio: { data, mimeType: 'audio/pcm;rate=16000' },
      })
    } catch {
      // WebSocket closed mid-send — stop further sends
      aliveRef.current = false
    }
  }

  function safeSendToolResponse(id: string, name: string, response: Record<string, unknown>) {
    if (!aliveRef.current || !sessionRef.current) return
    try {
      sessionRef.current.sendToolResponse({
        functionResponses: [{ id, name, response }],
      })
    } catch {
      aliveRef.current = false
    }
  }

  // RMS calculation for audio level visualization
  function calculateRMS(samples: Float32Array): number {
    let sum = 0
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i]
    }
    return Math.sqrt(sum / samples.length)
  }

  async function startCall() {
    setCallState('connecting')
    setStatusText('Conectando...')
    setErrorMessage('')

    try {
      // 1. Get ephemeral token from our server
      const tokenRes = await fetch('/api/chatbot/token', { method: 'POST' })
      if (!tokenRes.ok) {
        const err = await tokenRes.json()
        throw new Error(err.error || 'Error al generar token')
      }
      const { token, model, config } = await tokenRes.json()

      setStatusText('Iniciando micrófono...')

      // 2. Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      })
      mediaStreamRef.current = stream

      setStatusText('Conectando con el asistente...')

      // 3. Import SDK and connect to Gemini Live API
      const { GoogleGenAI, Modality } = await import('@google/genai')
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1alpha' },
      })

      // Separate AudioContexts: one for playback (24kHz), one for mic capture (16kHz)
      const playbackCtx = new AudioContext({ sampleRate: 24000 })
      playbackCtxRef.current = playbackCtx

      const captureCtx = new AudioContext({ sampleRate: 16000 })
      captureCtxRef.current = captureCtx

      // Scheduled audio playback — eliminates gaps between chunks
      let nextPlayTime = 0

      function queueAudio(pcmBase64: string) {
        if (!aliveRef.current) return
        const raw = atob(pcmBase64)
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
        const int16 = new Int16Array(bytes.buffer)
        const float32 = new Float32Array(int16.length)
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768

        // Update audio level from playback
        const rms = calculateRMS(float32)
        const normalized = Math.min(1, rms * 4) // amplify for visual effect
        if (normalized > audioLevelRef.current) {
          audioLevelRef.current = normalized
        }

        const buffer = playbackCtx.createBuffer(1, float32.length, 24000)
        buffer.copyToChannel(new Float32Array(float32) as Float32Array<ArrayBuffer>, 0)
        const source = playbackCtx.createBufferSource()
        source.buffer = buffer
        source.connect(playbackCtx.destination)

        const now = playbackCtx.currentTime
        if (nextPlayTime < now) {
          nextPlayTime = now + 0.05
        }
        source.start(nextPlayTime)
        nextPlayTime += float32.length / 24000
      }

      // 4. Connect to Gemini Live API
      const session = await ai.live.connect({
        model,
        config: {
          ...config,
          responseModalities: [Modality.AUDIO],
        },
        callbacks: {
          onopen: () => {
            aliveRef.current = true
            setCallState('active')
            setStatusText('')
            let seconds = 0
            timerRef.current = setInterval(() => {
              seconds++
              setCallDuration(seconds)
              if (seconds >= 900) endCall()
            }, 1000)
          },
          onmessage: (message: unknown) => {
            if (!aliveRef.current) return
            const msg = message as Record<string, unknown>

            // Debug: log message keys to see what the server sends
            const keys = Object.keys(msg).filter(k => msg[k] != null)
            if (keys.length > 0 && !keys.every(k => k === 'serverContent')) {
              console.log('[Live API] message keys:', keys, msg)
            }

            // Handle audio response
            const serverContent = msg.serverContent as Record<string, unknown> | undefined
            const modelTurn = serverContent?.modelTurn as { parts?: Array<{ inlineData?: { data?: string } }> } | undefined
            if (modelTurn?.parts) {
              for (const part of modelTurn.parts) {
                if (part.inlineData?.data) {
                  queueAudio(part.inlineData.data)
                }
              }
            }

            // Handle function calls (create_lead)
            if (msg.toolCall) {
              console.log('[Live API] toolCall received:', JSON.stringify(msg.toolCall))
              handleToolCall(msg.toolCall as ToolCallData)
            }
          },
          onerror: (e: Event | { message?: string }) => {
            console.error('Live API error:', e)
            aliveRef.current = false
            const msg = 'message' in e ? (e as { message: string }).message : 'Error en la conexión de voz'
            setErrorMessage(msg)
            setCallState('error')
            cleanup()
          },
          onclose: (e: CloseEvent | Event) => {
            aliveRef.current = false
            const closeEvent = e as CloseEvent
            if (closeEvent.code && closeEvent.code !== 1000) {
              setErrorMessage(`Conexión cerrada: ${closeEvent.reason || 'Error del servidor'} (${closeEvent.code})`)
              setCallState('error')
            } else {
              setCallState('ended')
            }
            cleanup()
          },
        },
      }) as unknown as LiveSession

      sessionRef.current = session

      // 5. Capture microphone audio and send to Gemini
      const actualCaptureRate = captureCtx.sampleRate
      const needsResample = actualCaptureRate !== 16000

      const sourceNode = captureCtx.createMediaStreamSource(stream)
      const processorNode = captureCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processorNode

      processorNode.onaudioprocess = (event) => {
        if (mutedRef.current || !aliveRef.current) return
        const inputData = event.inputBuffer.getChannelData(0)

        // Update audio level from mic input
        const rms = calculateRMS(inputData)
        const normalized = Math.min(1, rms * 6)
        if (normalized > audioLevelRef.current) {
          audioLevelRef.current = normalized
        }

        let int16: Int16Array
        if (needsResample) {
          const ratio = actualCaptureRate / 16000
          const outputLength = Math.floor(inputData.length / ratio)
          int16 = new Int16Array(outputLength)
          for (let i = 0; i < outputLength; i++) {
            const sample = inputData[Math.floor(i * ratio)]
            int16[i] = Math.max(-32768, Math.min(32767, Math.floor(sample * 32768)))
          }
        } else {
          int16 = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32768)))
          }
        }

        const bytes = new Uint8Array(int16.buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        safeSendAudio(btoa(binary))
      }

      sourceNode.connect(processorNode)
      const silentGain = captureCtx.createGain()
      silentGain.gain.value = 0
      processorNode.connect(silentGain)
      silentGain.connect(captureCtx.destination)

    } catch (err: unknown) {
      console.error('Voice call error:', err)
      const message = err instanceof Error ? err.message : 'Error al conectar'
      setErrorMessage(message)
      setCallState('error')
      cleanup()
    }
  }

  async function handleToolCall(toolCall: ToolCallData) {
    const functionCalls = toolCall.functionCalls
    if (!functionCalls || functionCalls.length === 0) {
      console.warn('[Live API] toolCall received but no functionCalls:', toolCall)
      return
    }

    for (const fc of functionCalls) {
      console.log('[Live API] function call:', fc.name, 'id:', fc.id, 'args:', fc.args)

      if (fc.name === 'create_lead') {
        const args = fc.args || {}
        try {
          const body = {
            name: String(args.name || ''),
            phone: String(args.phone || ''),
            service_interest: String(args.service_interest || 'visa-juvenil'),
            situation_summary: String(args.situation_summary || ''),
          }
          console.log('[Live API] creating lead:', body)

          const res = await fetch('/api/chatbot/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const result = await res.json()
          console.log('[Live API] lead result:', result)
          safeSendToolResponse(fc.id, 'create_lead', result)
        } catch (err) {
          console.error('[Live API] lead creation failed:', err)
          safeSendToolResponse(fc.id, 'create_lead', { error: 'No se pudo registrar' })
        }
      } else {
        console.warn('[Live API] unknown function:', fc.name)
      }
    }
  }

  function endCall() {
    setCallState('ended')
    cleanup()
  }

  function toggleMute() {
    setIsMuted(prev => {
      const newMuted = !prev
      mutedRef.current = newMuted
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach(t => {
          t.enabled = !newMuted
        })
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
      {/* Back button */}
      <button
        onClick={() => { cleanup(); onBack() }}
        className="absolute top-4 left-4 text-white/30 hover:text-white/70 flex items-center gap-1.5 text-sm transition-colors z-20"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      {/* Main content */}
      <div className="flex flex-col items-center">
        {/* Siri Orb — centerpiece */}
        <div className="mb-8">
          <SiriOrb
            state={orbState}
            audioLevel={audioLevel}
            size={callState === 'active' ? 180 : callState === 'idle' ? 160 : 150}
          />
        </div>

        {/* Status text */}
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

        {/* Controls */}
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
                onClick={endCall}
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
              onClick={() => { setCallState('idle'); setCallDuration(0); setErrorMessage(''); setAudioLevel(0) }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0ea5e9] to-[#8b5cf6] flex items-center justify-center hover:shadow-lg hover:shadow-[#0ea5e9]/30 transition-all duration-300 active:scale-95"
            >
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Info footer */}
      <div className="absolute bottom-6 text-center">
        <p className="text-white/15 text-[10px]">Duración máxima: 15 minutos</p>
        {callState === 'active' && (
          <p className="text-white/10 text-[9px] mt-0.5">La IA puede cometer errores. No es asesoría legal.</p>
        )}
      </div>
    </div>
  )
}

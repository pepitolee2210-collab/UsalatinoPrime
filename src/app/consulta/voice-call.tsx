'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowLeft, Phone, PhoneOff, Loader2, Mic, MicOff } from 'lucide-react'

type CallState = 'idle' | 'connecting' | 'active' | 'ended' | 'error'

// SDK session type — methods we use from the Live session
interface LiveSession {
  sendRealtimeInput: (params: { audio: { data: string; mimeType: string } }) => void
  sendToolResponse: (params: { functionResponses: Array<{ name: string; response: unknown }> }) => void
  close: () => void
}

interface ToolCallData {
  functionCalls?: Array<{ name: string; args: Record<string, string> }>
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

  const sessionRef = useRef<LiveSession | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const mutedRef = useRef(false)

  const cleanup = useCallback(() => {
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
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close()
      audioContextRef.current = null
    }
    if (sessionRef.current) {
      try { sessionRef.current.close() } catch { /* already closed */ }
      sessionRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

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

      // Audio context for playback at 24kHz (Gemini output rate)
      const audioCtx = new AudioContext({ sampleRate: 24000 })
      audioContextRef.current = audioCtx

      // Audio playback queue
      const audioQueue: Float32Array[] = []
      let isPlaying = false

      function playNextChunk() {
        if (audioQueue.length === 0) {
          isPlaying = false
          return
        }
        isPlaying = true
        const chunk = audioQueue.shift()!
        const buffer = audioCtx.createBuffer(1, chunk.length, 24000)
        buffer.copyToChannel(new Float32Array(chunk) as Float32Array<ArrayBuffer>, 0)
        const source = audioCtx.createBufferSource()
        source.buffer = buffer
        source.connect(audioCtx.destination)
        source.onended = playNextChunk
        source.start()
      }

      function queueAudio(pcmBase64: string) {
        const raw = atob(pcmBase64)
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
        const int16 = new Int16Array(bytes.buffer)
        const float32 = new Float32Array(int16.length)
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768
        audioQueue.push(float32)
        if (!isPlaying) playNextChunk()
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
            const msg = message as Record<string, unknown>
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
            // Handle function calls
            if (msg.toolCall) {
              handleToolCall(msg.toolCall as ToolCallData)
            }
          },
          onerror: (e: Event | { message?: string }) => {
            console.error('Live API error:', e)
            const msg = 'message' in e ? (e as { message: string }).message : 'Error en la conexión de voz'
            setErrorMessage(msg)
            setCallState('error')
            cleanup()
          },
          onclose: (e: CloseEvent | Event) => {
            const closeEvent = e as CloseEvent
            console.log('Live API closed:', closeEvent.code, closeEvent.reason)
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
      const sourceNode = audioCtx.createMediaStreamSource(stream)
      const processorNode = audioCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processorNode

      processorNode.onaudioprocess = (event) => {
        if (mutedRef.current || !sessionRef.current) return
        const inputData = event.inputBuffer.getChannelData(0)
        // Resample from audioCtx.sampleRate to 16kHz
        const ratio = audioCtx.sampleRate / 16000
        const outputLength = Math.floor(inputData.length / ratio)
        const int16 = new Int16Array(outputLength)
        for (let i = 0; i < outputLength; i++) {
          const sample = inputData[Math.floor(i * ratio)]
          int16[i] = Math.max(-32768, Math.min(32767, Math.floor(sample * 32768)))
        }
        // Convert to base64
        const bytes = new Uint8Array(int16.buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        const base64 = btoa(binary)

        sessionRef.current.sendRealtimeInput({
          audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
        })
      }

      sourceNode.connect(processorNode)
      processorNode.connect(audioCtx.destination)

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
    if (!functionCalls) return

    for (const fc of functionCalls) {
      if (fc.name === 'create_lead') {
        try {
          const res = await fetch('/api/chatbot/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: fc.args.name,
              phone: fc.args.phone,
              service_interest: fc.args.service_interest,
              situation_summary: fc.args.situation_summary,
            }),
          })
          const result = await res.json()

          sessionRef.current?.sendToolResponse({
            functionResponses: [{
              name: 'create_lead',
              response: result,
            }],
          })
        } catch (err) {
          console.error('Lead creation failed:', err)
        }
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Back button */}
      <button
        onClick={() => { cleanup(); onBack() }}
        className="absolute top-4 left-4 text-white/60 hover:text-white flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      {/* Call UI */}
      <div className="text-center">
        {/* Avatar with animation */}
        <div className="relative mx-auto mb-8">
          {callState === 'active' && (
            <>
              <div className="absolute inset-0 w-32 h-32 rounded-full bg-green-500/20 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-0 w-32 h-32 rounded-full bg-green-500/10 animate-ping" style={{ animationDuration: '3s' }} />
            </>
          )}
          {callState === 'connecting' && (
            <div className="absolute inset-0 w-32 h-32 rounded-full bg-[#F2A900]/20 animate-ping" style={{ animationDuration: '1.5s' }} />
          )}
          <div className={`relative w-32 h-32 rounded-full flex items-center justify-center ${
            callState === 'active' ? 'bg-green-500/20 border-2 border-green-500/50' :
            callState === 'connecting' ? 'bg-[#F2A900]/20 border-2 border-[#F2A900]/50' :
            callState === 'error' ? 'bg-red-500/20 border-2 border-red-500/50' :
            'bg-white/10 border-2 border-white/20'
          }`}>
            <span className="text-4xl font-bold text-[#F2A900]">U</span>
          </div>
        </div>

        <h2 className="text-white text-xl font-semibold mb-1">Asistente UsaLatinoPrime</h2>

        {callState === 'idle' && (
          <p className="text-white/50 text-sm mb-8">Toca para iniciar la llamada</p>
        )}
        {callState === 'connecting' && (
          <div className="flex items-center justify-center gap-2 text-[#F2A900] text-sm mb-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            {statusText}
          </div>
        )}
        {callState === 'active' && (
          <p className="text-green-400 text-sm mb-8 font-mono">{formatDuration(callDuration)}</p>
        )}
        {callState === 'ended' && (
          <p className="text-white/50 text-sm mb-8">Llamada finalizada — {formatDuration(callDuration)}</p>
        )}
        {callState === 'error' && (
          <p className="text-red-400 text-sm mb-8 max-w-xs mx-auto">{errorMessage}</p>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-6">
          {callState === 'idle' && (
            <button
              onClick={startCall}
              className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30"
            >
              <Phone className="w-8 h-8 text-white" />
            </button>
          )}

          {callState === 'active' && (
            <>
              <button
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              <button
                onClick={endCall}
                className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
            </>
          )}

          {callState === 'connecting' && (
            <button
              onClick={() => { setCallState('idle'); cleanup() }}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <PhoneOff className="w-8 h-8 text-white" />
            </button>
          )}

          {(callState === 'ended' || callState === 'error') && (
            <button
              onClick={() => { setCallState('idle'); setCallDuration(0); setErrorMessage('') }}
              className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30"
            >
              <Phone className="w-8 h-8 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Info footer */}
      <div className="absolute bottom-8 text-center">
        <p className="text-white/30 text-xs">Duración máxima: 15 minutos</p>
        {callState === 'active' && (
          <p className="text-white/20 text-[10px] mt-1">La IA puede cometer errores. No es asesoría legal.</p>
        )}
      </div>
    </div>
  )
}

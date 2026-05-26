'use client'

/**
 * useLexAgent — hook que conecta a Gemini Live para el asistente de voz
 * interno de Vanessa en /employee/contratos.
 *
 * Versión simplificada del agente de la landing — sin funnel comercial,
 * sin demo sync, sin captura de prospect. Solo: audio in/out, tools,
 * session resumption, mute. Tono operativo definido en lex-prompt.ts.
 */

import { useEffect, useRef, useState } from 'react'
import {
  GoogleGenAI,
  MediaResolution,
  Modality,
  type Session,
  type LiveServerMessage,
} from '@google/genai'
import { LEX_SYSTEM_PROMPT } from './lex-prompt'
import { LEX_TOOLS, executeLexTool } from './lex-tools'
import { AUDIO_WORKLET_SRC } from './audio-worklet-source'

export type LexState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error' | 'closed'

interface UseLexAgentOptions {
  onTranscript?: (role: 'user' | 'lex', text: string) => void
}

const INPUT_SAMPLE_RATE = 16_000
const OUTPUT_SAMPLE_RATE = 24_000

export function useLexAgent({ onTranscript }: UseLexAgentOptions = {}) {
  const [state, setState] = useState<LexState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)

  const sessionRef = useRef<Session | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const playbackQueueRef = useRef<Float32Array[]>([])
  const playbackBusyRef = useRef(false)
  const nextStartTimeRef = useRef(0)
  const mutedRef = useRef(false)
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Session resumption: si la sesión expira (~15min audio), reconectamos
  // transparente sin que Vanessa note el corte.
  const sessionHandleRef = useRef<string | null>(null)
  const intentionalCloseRef = useRef(false)
  const reconnectingRef = useRef(false)
  const aiRef = useRef<GoogleGenAI | null>(null)
  const modelRef = useRef<string | null>(null)

  // ──────────────────────────────────────────────────────────────────
  // Helpers de audio
  // ──────────────────────────────────────────────────────────────────

  const base64ToInt16PCM = (b64: string): Float32Array => {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const samples = bytes.length / 2
    const float32 = new Float32Array(samples)
    for (let i = 0; i < samples; i++) {
      let s = bytes[i * 2] | (bytes[i * 2 + 1] << 8)
      if (s >= 0x8000) s -= 0x10000
      float32[i] = s / 0x8000
    }
    return float32
  }

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }

  const playAudioChunk = (float32: Float32Array) => {
    playbackQueueRef.current.push(float32)
    if (playbackBusyRef.current) return
    playbackBusyRef.current = true
    const drain = async () => {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        playbackBusyRef.current = false
        return
      }
      while (playbackQueueRef.current.length > 0) {
        const ctx = audioCtxRef.current
        const chunk = playbackQueueRef.current.shift()!
        const audioBuffer = ctx.createBuffer(1, chunk.length, OUTPUT_SAMPLE_RATE)
        audioBuffer.copyToChannel(chunk as Float32Array<ArrayBuffer>, 0)
        const src = ctx.createBufferSource()
        src.buffer = audioBuffer
        src.connect(ctx.destination)
        if (nextStartTimeRef.current < ctx.currentTime) {
          nextStartTimeRef.current = ctx.currentTime
        }
        src.start(nextStartTimeRef.current)
        nextStartTimeRef.current += audioBuffer.duration
      }
      playbackBusyRef.current = false
    }
    void drain()
  }

  // ──────────────────────────────────────────────────────────────────
  // Manejo de mensajes del modelo
  // ──────────────────────────────────────────────────────────────────

  const handleServerMessage = (msg: LiveServerMessage) => {
    // 1) Tool calls (las tools devuelven Promise<ToolResult>)
    if (msg.toolCall?.functionCalls && msg.toolCall.functionCalls.length > 0) {
      const calls = msg.toolCall.functionCalls
      Promise.all(
        calls.map(async (call) => {
          const result = await executeLexTool(call.name || '', call.args || {})
          return { id: call.id, name: call.name, response: { result } }
        }),
      ).then((responses) => {
        sessionRef.current?.sendToolResponse({ functionResponses: responses })
      })
    }

    // 2) Audio output
    const content = msg.serverContent
    if (content?.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        const inlineData = part.inlineData
        if (inlineData?.data && inlineData.mimeType?.startsWith('audio/')) {
          const float32 = base64ToInt16PCM(inlineData.data)
          playAudioChunk(float32)
          setState('speaking')
          if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current)
          speakingTimeoutRef.current = setTimeout(() => {
            setState((s) => (s === 'speaking' ? 'listening' : s))
          }, 600)
        }
        if (part.text) {
          onTranscript?.('lex', part.text)
        }
      }
    }

    // 3) Transcripciones
    if (content?.inputTranscription?.text) {
      onTranscript?.('user', content.inputTranscription.text)
    }
    if (content?.outputTranscription?.text) {
      onTranscript?.('lex', content.outputTranscription.text)
    }

    // 4) Turn complete → listening (con reset del scheduler)
    if (content?.turnComplete) {
      setState((s) => (s === 'speaking' ? 'listening' : s))
      if (audioCtxRef.current) {
        nextStartTimeRef.current = Math.max(
          nextStartTimeRef.current,
          audioCtxRef.current.currentTime,
        )
      }
    }

    // 5) Interrupted → drenar queue
    if (content?.interrupted) {
      playbackQueueRef.current = []
      nextStartTimeRef.current = audioCtxRef.current?.currentTime ?? 0
    }

    // 6) Session resumption handle
    const resumeUpdate = (msg as unknown as { sessionResumptionUpdate?: { resumable?: boolean; newHandle?: string } }).sessionResumptionUpdate
    if (resumeUpdate?.resumable && resumeUpdate?.newHandle) {
      sessionHandleRef.current = resumeUpdate.newHandle
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Conexión a la sesión Live
  // ──────────────────────────────────────────────────────────────────

  const connectSession = async (resumeHandle: string | null = null): Promise<Session> => {
    const ai = aiRef.current!
    const model = modelRef.current!
    const session = await ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
        contextWindowCompression: {
          triggerTokens: '104857',
          slidingWindow: { targetTokens: '52428' },
        },
        systemInstruction: { parts: [{ text: LEX_SYSTEM_PROMPT }] },
        tools: [{ functionDeclarations: LEX_TOOLS }],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
      },
      callbacks: {
        onopen: () => {
          setState('listening')
          reconnectingRef.current = false
        },
        onmessage: handleServerMessage,
        onerror: (err) => {
          console.error('[lex] WebSocket error:', err)
          setErrorMessage('Error de conexión con el modelo')
          setState('error')
        },
        onclose: (e) => {
          const closeCode = (e as { code?: number })?.code
          const closeReason = (e as { reason?: string })?.reason
          console.log('[lex] WebSocket closed:', { code: closeCode, reason: closeReason })

          if (intentionalCloseRef.current) {
            setState('closed')
            return
          }
          if (sessionHandleRef.current && closeCode === 1008 && !reconnectingRef.current) {
            reconnectingRef.current = true
            console.log('[lex] Reconnecting with session handle')
            playbackQueueRef.current = []
            nextStartTimeRef.current = audioCtxRef.current?.currentTime ?? 0
            connectSession(sessionHandleRef.current).catch((err) => {
              console.error('[lex] Resume reconnect failed:', err)
              setErrorMessage('No se pudo reconectar la sesión')
              setState('error')
              reconnectingRef.current = false
            })
            return
          }
          setState((prev) => {
            if (prev === 'error') return prev
            if (closeCode && closeCode !== 1000 && closeCode !== 1005) {
              setErrorMessage(
                `Conexión cerrada (código ${closeCode}${closeReason ? `: ${closeReason}` : ''})`,
              )
              return 'error'
            }
            return 'closed'
          })
        },
      },
    })
    sessionRef.current = session
    return session
  }

  // ──────────────────────────────────────────────────────────────────
  // Public API: start / stop / toggleMute
  // ──────────────────────────────────────────────────────────────────

  const start = async () => {
    setErrorMessage(null)
    setState('connecting')
    try {
      // 1) Pedir token / api key al endpoint server-side
      const tokenRes = await fetch('/api/voice-token', { method: 'POST' })
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}))
        throw new Error(err.error || `Token endpoint ${tokenRes.status}`)
      }
      const { apiKey, model } = await tokenRes.json()
      if (!apiKey || !model) throw new Error('Token endpoint returned invalid payload')

      aiRef.current = new GoogleGenAI({ apiKey })
      modelRef.current = `models/${model}`

      // 2) Conectar sesión
      await connectSession()

      // 3) Pedir mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: INPUT_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      mediaStreamRef.current = stream

      // 4) AudioContext + worklet
      const ctx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE })
      audioCtxRef.current = ctx
      const blob = new Blob([AUDIO_WORKLET_SRC], { type: 'application/javascript' })
      const workletUrl = URL.createObjectURL(blob)
      await ctx.audioWorklet.addModule(workletUrl)
      URL.revokeObjectURL(workletUrl)

      const sourceNode = ctx.createMediaStreamSource(stream)
      const worklet = new AudioWorkletNode(ctx, 'lex-audio-capture')
      sourceNodeRef.current = sourceNode
      workletNodeRef.current = worklet
      worklet.port.onmessage = (e) => {
        if (mutedRef.current) return
        const buf = e.data as ArrayBuffer
        const base64 = arrayBufferToBase64(buf)
        sessionRef.current?.sendRealtimeInput({
          audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
        })
      }
      sourceNode.connect(worklet)
      // Worklet no necesita conectarse al destination — solo procesa
    } catch (err) {
      console.error('[lex] start failed:', err)
      const msg = err instanceof Error ? err.message : 'Error al iniciar el agente'
      setErrorMessage(msg)
      setState('error')
    }
  }

  const stop = async () => {
    intentionalCloseRef.current = true
    try {
      sessionRef.current?.close()
    } catch {}
    sessionRef.current = null
    try {
      workletNodeRef.current?.disconnect()
    } catch {}
    try {
      sourceNodeRef.current?.disconnect()
    } catch {}
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        await audioCtxRef.current.close()
      } catch {}
    }
    audioCtxRef.current = null
    playbackQueueRef.current = []
    setState('closed')
  }

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev
      mutedRef.current = next
      return next
    })
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true
      try {
        sessionRef.current?.close()
      } catch {}
      sessionRef.current = null
      try {
        workletNodeRef.current?.disconnect()
      } catch {}
      try {
        sourceNodeRef.current?.disconnect()
      } catch {}
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close()
        } catch {}
      }
      if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current)
    }
  }, [])

  return { state, errorMessage, isMuted, start, stop, toggleMute }
}

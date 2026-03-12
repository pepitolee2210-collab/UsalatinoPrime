'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowLeft, Send, Loader2, Mic, Square, Volume2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isAudio?: boolean
}

interface ChatbotProps {
  onBack: () => void
}

const SESSION_KEY = 'chatbot_session_id'

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export function Chatbot({ onBack }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy el asistente virtual de UsaLatinoPrime. ¿En qué puedo ayudarte hoy? Puedo responder preguntas sobre visa juvenil, asilo, permisos de trabajo, y más.',
    },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  async function sendMessage(text?: string, audio?: string) {
    const userContent = text || '🎤 Nota de voz'
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      isAudio: !!audio,
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)

    const assistantId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chatbot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: getSessionId(),
          ...(audio ? { audio } : { text }),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: err.error || 'Error al procesar tu mensaje.' } : m)
        )
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              accumulated += parsed.text
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m)
              )
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: 'Error de conexión. Intenta de nuevo.' } : m)
      )
    } finally {
      setIsStreaming(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    sendMessage(input.trim())
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        setRecordingTime(0)

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1]
          sendMessage(undefined, base64)
        }
        reader.readAsDataURL(blob)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)

      let seconds = 0
      timerRef.current = setInterval(() => {
        seconds++
        setRecordingTime(seconds)
        if (seconds >= 60) stopRecording()
      }, 1000)
    } catch {
      // Microphone access denied
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  function speakMessage(text: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'es-US'
      utterance.rate = 0.95
      window.speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      {/* Header — frosted glass */}
      <div className="bg-[#000a14]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0ea5e9]/30 to-[#8b5cf6]/20 flex items-center justify-center ring-1 ring-white/[0.08]">
          <span className="text-xs font-semibold text-[#F2A900]">U</span>
        </div>
        <div className="flex-1">
          <p className="text-white font-medium text-sm">Asistente IA</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <p className="text-emerald-400/70 text-[10px]">En línea</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`flex chat-bubble-enter ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-[#F2A900] to-[#d4940a] text-white rounded-br-md shadow-lg shadow-[#F2A900]/10'
                  : 'bg-white/[0.06] backdrop-blur-sm text-white/85 rounded-bl-md border border-white/[0.05]'
              }`}
            >
              {msg.isAudio && msg.role === 'user' && (
                <span className="text-[10px] opacity-60 block mb-1">🎤 Nota de voz</span>
              )}
              {msg.content || (
                <span className="inline-flex items-center gap-1.5 py-1">
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-white/40" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-white/40" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-white/40" />
                </span>
              )}
              {msg.role === 'assistant' && msg.content && msg.id !== 'welcome' && (
                <button
                  onClick={() => speakMessage(msg.content)}
                  className="mt-2 flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors"
                >
                  <Volume2 className="w-3 h-3" /> Escuchar
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — frosted glass */}
      <div className="bg-[#000a14]/80 backdrop-blur-xl border-t border-white/[0.06] px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Mic button */}
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isStreaming}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording
                ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/30 animate-pulse'
                : 'bg-white/[0.06] hover:bg-white/[0.1] text-white/40 hover:text-white/60'
            }`}
          >
            {isRecording ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {isRecording ? (
            <div className="flex-1 text-center">
              <span className="text-red-400/80 text-sm font-medium tabular-nums">
                Grabando... {recordingTime}s
              </span>
            </div>
          ) : (
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Escribe tu mensaje..."
              disabled={isStreaming}
              className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-full px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-[#F2A900]/30 focus:border-[#F2A900]/20 transition-all"
            />
          )}

          {!isRecording && (
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F2A900] to-[#d4940a] flex items-center justify-center disabled:opacity-30 hover:shadow-lg hover:shadow-[#F2A900]/20 transition-all duration-300"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

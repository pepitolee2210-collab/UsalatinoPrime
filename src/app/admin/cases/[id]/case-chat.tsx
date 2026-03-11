'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Send, Loader2, Copy, Check, MessageSquare, FileText, User, Bot, RotateCcw } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: Record<string, unknown>
  created_at: string
}

interface CaseChatProps {
  caseId: string
  clientName: string
  serviceName: string
  documentCount: number
  parentSituation?: string
}

const QUICK_TEMPLATES = {
  always: [
    { label: 'Declaración jurada del tutor', prompt: 'Genera la declaración jurada (affidavit) del tutor/madre con todos los datos del caso.' },
    { label: 'Declaración de testigo', prompt: 'Genera una declaración jurada de testigo. Dime qué datos necesitas si falta algo.' },
    { label: 'Analizar caso', prompt: '¿Qué documentos faltan para que este caso esté completo? Dame tu análisis.' },
    { label: 'Declaración del menor', prompt: 'Genera la declaración jurada del menor desde su perspectiva.' },
  ],
  cooperates: [
    { label: 'Carta de custodia voluntaria', prompt: 'Genera la carta de cesión de custodia voluntaria (Consent Regarding Custody) del padre/madre ausente.' },
    { label: 'Consent email del padre', prompt: 'Genera el email de confirmación de recepción de documentos SIJ que debe enviar el padre/madre.' },
    { label: 'Acknowledgment of receipt', prompt: 'Genera el Acknowledgment of Receipt of SIJ Petition Documents.' },
  ],
  absent: [
    { label: 'Affidavit reforzado (abandono total)', prompt: 'Genera una declaración jurada reforzada del tutor que enfatice el abandono total del padre/madre. Debe ser muy fuerte para el juez.' },
    { label: 'Declaración de familiar cercano', prompt: 'Genera la declaración jurada de un familiar cercano (abuela, tía, etc.) que respalde el abandono.' },
  ],
}

export function CaseChat({ caseId, clientName, serviceName, documentCount, parentSituation }: CaseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load chat history
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`/api/ai/chat/history?case_id=${caseId}`)
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages.filter((m: ChatMessage) => m.role !== 'system'))
        }
      } catch {
        toast.error('Error al cargar historial del chat')
      } finally {
        setHistoryLoaded(true)
      }
    }
    loadHistory()
  }, [caseId])

  useEffect(() => {
    if (historyLoaded) scrollToBottom()
  }, [messages, streamingText, historyLoaded, scrollToBottom])

  async function clearChat() {
    if (!confirm('¿Reiniciar el chat? Se borrarán todos los mensajes de esta conversación.')) return
    try {
      const res = await fetch('/api/ai/chat/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId }),
      })
      if (res.ok) {
        setMessages([])
        toast.success('Chat reiniciado')
      } else {
        toast.error('Error al reiniciar chat')
      }
    } catch {
      toast.error('Error al reiniciar chat')
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)
    setStreamingText('')

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, message: text.trim() }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al enviar mensaje')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No se pudo leer la respuesta')

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.done) break
            if (data.error) throw new Error(data.error)
            if (data.text) {
              accumulated += data.text
              setStreamingText(accumulated)
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

      // Add assistant message
      if (accumulated.trim()) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: accumulated.trim(),
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al comunicarse con la IA')
    } finally {
      setIsStreaming(false)
      setStreamingText('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('Copiado al portapapeles')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Get templates based on parent situation
  const templates = [
    ...QUICK_TEMPLATES.always,
    ...(parentSituation === 'cooperates' ? QUICK_TEMPLATES.cooperates : []),
    ...(parentSituation === 'absent' || parentSituation === 'no_contact' ? QUICK_TEMPLATES.absent : []),
    ...(!parentSituation ? [...QUICK_TEMPLATES.cooperates, ...QUICK_TEMPLATES.absent] : []),
  ]

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#F2A900]" />
          <h3 className="font-semibold text-gray-900">Chat IA</h3>
          <Badge variant="secondary" className="text-xs">{clientName}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            <FileText className="w-3.5 h-3.5 inline mr-1" />
            {documentCount} docs • {serviceName}
          </span>
          {hasMessages && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              disabled={isStreaming}
              className="text-xs text-gray-400 hover:text-red-500 h-7 px-2"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reiniciar chat
            </Button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {!historyLoaded && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {historyLoaded && !hasMessages && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F2A900]/20 to-[#D4940A]/20 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-[#F2A900]" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">Chat IA para este caso</h4>
            <p className="text-sm text-gray-500 max-w-md mb-6">
              La IA ya tiene acceso a todos los datos del caso, documentos subidos y relato del cliente.
              Escribe un mensaje o usa un template para empezar.
            </p>

            {/* Quick templates */}
            <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
              {templates.slice(0, 6).map((t, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(t.prompt)}
                  disabled={isStreaming}
                  className="text-left p-3 rounded-xl border border-gray-200 hover:border-[#F2A900] hover:bg-[#F2A900]/5 transition-colors text-sm"
                >
                  <span className="text-gray-800 font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            copiedId={copiedId}
            onCopy={copyToClipboard}
          />
        ))}

        {/* Streaming message */}
        {isStreaming && streamingText && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F2A900] to-[#D4940A] flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm border max-w-[85%]">
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">{streamingText}</div>
              <div className="flex items-center gap-1 mt-2">
                <Loader2 className="w-3 h-3 animate-spin text-[#F2A900]" />
                <span className="text-xs text-gray-400">Generando...</span>
              </div>
            </div>
          </div>
        )}

        {isStreaming && !streamingText && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F2A900] to-[#D4940A] flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm border">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#F2A900] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#F2A900] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#F2A900] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-gray-400">Pensando...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t pt-3">
        {hasMessages && (
          <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
            {templates.slice(0, 4).map((t, i) => (
              <button
                key={i}
                onClick={() => sendMessage(t.prompt)}
                disabled={isStreaming}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-[#F2A900] hover:bg-[#F2A900]/5 transition-colors text-gray-600 disabled:opacity-50"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter nueva línea)"
            disabled={isStreaming || isLoading}
            rows={2}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/50 focus:border-[#F2A900] disabled:opacity-50 disabled:bg-gray-50"
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming || isLoading}
            className="self-end bg-[#F2A900] hover:bg-[#D4940A] text-white rounded-xl px-4 h-11"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  copiedId,
  onCopy,
}: {
  message: ChatMessage
  copiedId: string | null
  onCopy: (text: string, id: string) => void
}) {
  const isUser = message.role === 'user'

  // Detect document blocks in assistant messages
  const hasDocument = !isUser && (
    message.content.includes('AFFIDAVIT') ||
    message.content.includes('DECLARATION') ||
    message.content.includes('CONSENT') ||
    message.content.includes('PETITION') ||
    message.content.includes('Subject:') ||
    message.content.includes('To whom it may concern')
  )

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser
          ? 'bg-gray-700'
          : 'bg-gradient-to-br from-[#F2A900] to-[#D4940A]'
      }`}>
        {isUser
          ? <User className="w-4 h-4 text-white" />
          : <Bot className="w-4 h-4 text-white" />
        }
      </div>
      <div className={`flex-1 max-w-[85%] ${isUser ? 'flex justify-end' : ''}`}>
        <div className={`rounded-2xl p-4 shadow-sm ${
          isUser
            ? 'bg-gray-700 text-white rounded-tr-sm'
            : 'bg-white border rounded-tl-sm'
        }`}>
          <div className={`prose prose-sm max-w-none whitespace-pre-wrap ${isUser ? 'prose-invert' : ''}`}>
            {message.content}
          </div>
        </div>

        {/* Copy button for assistant messages with documents */}
        {hasDocument && (
          <div className="flex gap-1 mt-1.5">
            <button
              onClick={() => onCopy(message.content, message.id)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
            >
              {copiedId === message.id
                ? <><Check className="w-3 h-3 text-green-500" /> Copiado</>
                : <><Copy className="w-3 h-3" /> Copiar documento</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

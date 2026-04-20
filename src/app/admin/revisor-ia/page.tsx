'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Loader2, Send, Paperclip, X, FileText, Plus, Trash2, MessageSquare,
  Scale, Sparkles, ChevronRight, File as FileIcon, Bot, User,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments: Array<{ filename: string; mime_type: string; size_bytes: number }>
  created_at: string
}

interface PendingAttachment {
  filename: string
  mime_type: string
  size_bytes: number
  data: string // base64
}

const MAX_FILE_MB = 20
const ACCEPT_MIME = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] || '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function renderMarkdown(text: string): string {
  // Minimal markdown renderer — just enough for Gemini's output
  // Headers, bold, code, lists, line breaks. No external deps.
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-gray-900 mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-gray-900 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-gray-900 mt-5 mb-3">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    // Inline code
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 text-[#002855] rounded px-1 py-0.5 text-[13px] font-mono">$1</code>')
    // Bullets
    .replace(/^[-*] (.+)$/gm, '<li class="ml-5 list-disc text-gray-800 mb-0.5">$1</li>')
    // Numbered lists
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-5 list-decimal text-gray-800 mb-0.5">$2</li>')
    // Paragraphs (double line break → new block)
    .split(/\n\n+/)
    .map(block => {
      if (block.startsWith('<h') || block.startsWith('<li')) return block
      return `<p class="text-gray-800 leading-relaxed mb-2">${block.replace(/\n/g, '<br />')}</p>`
    })
    .join('\n')
}

export default function RevisorIAPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/legal-chat')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch {
      toast.error('Error al cargar conversaciones')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/legal-chat/sessions/${id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setActiveSessionId(id)
      }
    } catch {
      toast.error('Error al cargar conversación')
    }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  useEffect(() => {
    // Auto-resize textarea
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`
  }, [input])

  async function handleFilePick(files: FileList | null) {
    if (!files || files.length === 0) return
    const newPending: PendingAttachment[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`"${file.name}" excede ${MAX_FILE_MB}MB`)
        continue
      }
      try {
        const data = await fileToBase64(file)
        newPending.push({
          filename: file.name,
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          data,
        })
      } catch {
        toast.error(`No se pudo leer "${file.name}"`)
      }
    }
    setPendingAttachments(prev => [...prev, ...newPending].slice(0, 5))
  }

  async function handleSend() {
    const message = input.trim()
    if (!message && pendingAttachments.length === 0) return
    if (streaming) return

    const userMsgForUI: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: message || '[archivo adjunto]',
      attachments: pendingAttachments.map(a => ({
        filename: a.filename,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
      })),
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsgForUI])
    setInput('')
    const attachmentsToSend = pendingAttachments
    setPendingAttachments([])
    setStreaming(true)
    setStreamingText('')

    abortRef.current = new AbortController()
    try {
      const res = await fetch('/api/admin/legal-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeSessionId,
          message,
          attachments: attachmentsToSend,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Error al enviar')
        setStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let streamSessionId: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() || ''

        for (const frame of frames) {
          const line = frame.trim()
          if (!line.startsWith('data:')) continue
          const json = line.slice(5).trim()
          if (!json) continue
          try {
            const parsed = JSON.parse(json)
            if (parsed.session_id && !streamSessionId) {
              streamSessionId = parsed.session_id
              if (!activeSessionId) setActiveSessionId(parsed.session_id)
            }
            if (parsed.text) {
              fullText += parsed.text
              setStreamingText(fullText)
            }
            if (parsed.error) {
              toast.error(parsed.error)
            }
          } catch {
            // ignore
          }
        }
      }

      // Commit final assistant message to list
      if (fullText.trim()) {
        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: fullText,
          attachments: [],
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, assistantMsg])
      }
      setStreamingText('')

      // Refresh sessions list (new session might have been created, or updated_at changed)
      await loadSessions()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.info('Respuesta cancelada')
      } else {
        toast.error('Error de conexión')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function handleNewSession() {
    setActiveSessionId(null)
    setMessages([])
    setInput('')
    setPendingAttachments([])
    setStreamingText('')
    if (streaming) abortRef.current?.abort()
  }

  async function handleDeleteSession(id: string) {
    if (!confirm('¿Eliminar esta conversación?')) return
    try {
      const res = await fetch(`/api/admin/legal-chat/sessions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Conversación eliminada')
      if (id === activeSessionId) handleNewSession()
      await loadSessions()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  function handleStopStream() {
    abortRef.current?.abort()
    setStreaming(false)
  }

  return (
    <div className="flex -mt-6 -mx-6 h-[calc(100vh-var(--sidebar-top,0px))] min-h-[calc(100vh-3rem)] bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} border-r border-gray-200 bg-white flex flex-col transition-all overflow-hidden`}>
        <div className="p-3 border-b border-gray-100">
          <Button onClick={handleNewSession} className="w-full bg-[#F2A900] hover:bg-[#D4940A] text-[#001020] font-bold">
            <Plus className="w-4 h-4 mr-1.5" />
            Nueva conversación
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8 px-4">
              Aún no hay conversaciones. Empieza una nueva.
            </p>
          ) : (
            <div className="space-y-0.5">
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className={`group cursor-pointer rounded-lg px-2.5 py-2 transition-colors flex items-start gap-2 ${
                    activeSessionId === s.id ? 'bg-[#002855]/10' : 'hover:bg-gray-50'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${activeSessionId === s.id ? 'text-[#002855]' : 'text-gray-800'}`}>
                      {s.title}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {formatDistanceToNow(new Date(s.updated_at), { locale: es, addSuffix: true })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id) }}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main chat */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-gray-700"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#002855] to-[#001d3d] flex items-center justify-center">
                <Scale className="w-4 h-4 text-[#F2A900]" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900">Revisor IA</h1>
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Gemini 3.1 Pro · Elena Vargas
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !streaming ? (
            <div className="flex flex-col items-center justify-center h-full px-6 max-w-2xl mx-auto text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#002855] to-[#001d3d] flex items-center justify-center mb-5">
                <Scale className="w-8 h-8 text-[#F2A900]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">¿En qué podemos ayudarte hoy?</h2>
              <p className="text-sm text-gray-500 mb-8 max-w-md">
                Soy tu asistente legal senior de inmigración. Revisa formularios, declaraciones, evidencia, o hazme cualquier pregunta técnica sobre un caso.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                {[
                  { icon: FileText, title: 'Revisar un formulario I-485', hint: 'Sube el PDF y te doy feedback completo' },
                  { icon: FileText, title: 'Evaluar declaración jurada', hint: 'Checkeo narrativa, inconsistencias y requisitos' },
                  { icon: FileText, title: 'Checklist de evidencia SIJS', hint: 'Qué documentos te faltan para corte' },
                  { icon: FileText, title: 'Revisar renuncia de padre', hint: 'Valido voluntariedad y formato legal' },
                ].map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(ex.title)}
                    className="text-left p-3 rounded-xl border border-gray-200 bg-white hover:border-[#F2A900] hover:bg-amber-50/30 transition-all"
                  >
                    <div className="flex items-start gap-2.5">
                      <ex.icon className="w-4 h-4 text-[#F2A900] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{ex.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{ex.hint}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-6 px-5 space-y-6">
              {messages.map(m => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {streaming && streamingText && (
                <MessageBubble
                  message={{
                    id: 'streaming',
                    role: 'assistant',
                    content: streamingText,
                    attachments: [],
                    created_at: new Date().toISOString(),
                  }}
                  isStreaming
                />
              )}
              {streaming && !streamingText && (
                <div className="flex items-center gap-2 text-xs text-gray-400 pl-11">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Elena está analizando...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="max-w-3xl mx-auto">
            {/* Pending attachments */}
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pendingAttachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-xs">
                    <FileIcon className="w-3.5 h-3.5 text-gray-500" />
                    <span className="font-medium text-gray-800 truncate max-w-[180px]">{a.filename}</span>
                    <span className="text-gray-400">{formatFileSize(a.size_bytes)}</span>
                    <button
                      onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white shadow-sm p-2 focus-within:border-[#F2A900] transition-colors">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming || pendingAttachments.length >= 5}
                className="flex-shrink-0 w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center disabled:opacity-40 transition-colors"
                title="Adjuntar archivo (PDF, imagen, doc)"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT_MIME}
                onChange={e => { handleFilePick(e.target.files); e.target.value = '' }}
                className="hidden"
              />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Pega un documento o pregunta algo sobre un caso..."
                rows={1}
                disabled={streaming}
                className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-gray-900 placeholder-gray-400 px-2 py-2 max-h-60"
              />

              {streaming ? (
                <button
                  onClick={handleStopStream}
                  className="flex-shrink-0 w-9 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                  title="Detener"
                >
                  <div className="w-3 h-3 bg-white rounded-sm" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() && pendingAttachments.length === 0}
                  className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#F2A900] hover:bg-[#D4940A] text-[#001020] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>

            <p className="text-[10px] text-gray-400 text-center mt-2">
              Máx 5 archivos · 20 MB c/u · PDF, Word, imágenes
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

function MessageBubble({ message, isStreaming = false }: { message: Message; isStreaming?: boolean }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-[#002855] to-[#001d3d] flex items-center justify-center">
          <Scale className="w-4 h-4 text-[#F2A900]" />
        </div>
      )}
      <div className={`max-w-[78%] ${isUser ? 'order-1' : ''}`}>
        <div className={`rounded-2xl ${isUser ? 'bg-[#002855] text-white px-4 py-3' : 'bg-white border border-gray-200 px-5 py-4'}`}>
          {message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {message.attachments.map((a, i) => (
                <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] ${isUser ? 'bg-white/10' : 'bg-gray-100'}`}>
                  <FileIcon className="w-3 h-3" />
                  <span className="truncate max-w-[140px]">{a.filename}</span>
                </div>
              ))}
            </div>
          )}
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div
              className="text-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) + (isStreaming ? '<span class="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse" />' : '') }}
            />
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-1 px-1">
          {format(new Date(message.created_at), 'HH:mm', { locale: es })}
        </p>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
          <User className="w-4 h-4 text-gray-600" />
        </div>
      )}
    </div>
  )
}

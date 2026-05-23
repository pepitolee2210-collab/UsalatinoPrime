'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Send, Paperclip, X, FileText, Plus, Trash2, MessageSquare,
  Scale, ChevronRight, File as FileIcon, User,
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
  data: string
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
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .replace(/^### (.+)$/gm, '<h3 class="text-[13px] font-bold text-white mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-[14px] font-bold text-white mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-[15px] font-bold text-white mt-5 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="rounded px-1 py-0.5 text-[12px]" style="background:rgba(255,255,255,0.08);color:#FACC15;font-family:var(--font-mono-tech);border:0.5px solid rgba(255,255,255,0.1)">$1</code>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-5 list-disc mb-0.5" style="color:#D4D4D8">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-5 list-decimal mb-0.5" style="color:#D4D4D8">$2</li>')
    .split(/\n\n+/)
    .map(block => {
      if (block.startsWith('<h') || block.startsWith('<li')) return block
      return `<p class="leading-relaxed mb-2" style="color:#D4D4D8">${block.replace(/\n/g, '<br />')}</p>`
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
    <div
      className="flex -mt-6 -mx-6 h-[calc(100vh-var(--sidebar-top,0px))] min-h-[calc(100vh-3rem)]"
      style={{ background: '#000000' }}
    >
      {/* Sessions sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-72' : 'w-0'} flex flex-col transition-all overflow-hidden`}
        style={{
          background: 'linear-gradient(180deg, rgba(15,15,15,0.95), rgba(8,8,8,0.95))',
          borderRight: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="p-3" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={handleNewSession}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{
              background: '#FFFFFF',
              color: '#000000',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '-0.005em',
              boxShadow: '0 4px 18px rgba(255,255,255,0.18), 0 0 0 0.5px rgba(255,255,255,0.4) inset',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva conversación
          </button>
        </div>
        <div className="flex-1 overflow-y-auto admin-scroll p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#A1A1A1' }} />
            </div>
          ) : sessions.length === 0 ? (
            <p
              className="py-8 px-4 text-center"
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                color: '#525252',
                letterSpacing: '0.15em',
              }}
            >
              SIN CONVERSACIONES
            </p>
          ) : (
            <div className="space-y-0.5">
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className="group cursor-pointer rounded-lg px-2.5 py-2 transition-colors flex items-start gap-2"
                  style={{
                    background: activeSessionId === s.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (activeSessionId !== s.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  }}
                  onMouseLeave={(e) => {
                    if (activeSessionId !== s.id) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <MessageSquare
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: activeSessionId === s.id ? '#FACC15' : '#525252' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="truncate"
                      style={{
                        fontSize: 12,
                        fontWeight: activeSessionId === s.id ? 600 : 500,
                        color: activeSessionId === s.id ? '#FFFFFF' : '#A1A1A1',
                        letterSpacing: '-0.005em',
                      }}
                    >
                      {s.title}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 9,
                        color: '#525252',
                        marginTop: 2,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {formatDistanceToNow(new Date(s.updated_at), { locale: es, addSuffix: true }).toUpperCase()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#FCA5A5' }}
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
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{
            background: 'rgba(10,10,10,0.85)',
            backdropFilter: 'blur(20px)',
            borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: '#A1A1A1', border: '0.5px solid rgba(255,255,255,0.1)' }}
            >
              <ChevronRight
                className="w-3.5 h-3.5 transition-transform"
                style={{ transform: sidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center relative"
                style={{
                  background: 'linear-gradient(135deg, rgba(250,204,21,0.18), rgba(250,204,21,0.04))',
                  border: '0.5px solid rgba(250,204,21,0.3)',
                }}
              >
                <Scale className="w-4 h-4" style={{ color: '#FACC15' }} />
              </div>
              <div>
                <p
                  className="flex items-center gap-1.5"
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    letterSpacing: '0.02em',
                  }}
                >
                  LEX
                  <span
                    style={{
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 9,
                      fontWeight: 700,
                      color: '#FACC15',
                      background: 'rgba(250,204,21,0.10)',
                      border: '0.5px solid rgba(250,204,21,0.3)',
                      padding: '2px 5px',
                      borderRadius: 4,
                      letterSpacing: '0.1em',
                    }}
                  >
                    v1
                  </span>
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 9,
                    color: '#525252',
                    letterSpacing: '0.15em',
                    marginTop: 1,
                  }}
                >
                  <span style={{ color: '#FACC15' }}>▸</span> SISTEMA LEGAL · USA LATINO PRIME
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto admin-scroll">
          {messages.length === 0 && !streaming ? (
            <div className="flex flex-col items-center justify-center h-full px-6 max-w-2xl mx-auto text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{
                  background: 'linear-gradient(135deg, rgba(250,204,21,0.18), rgba(250,204,21,0.04))',
                  border: '0.5px solid rgba(250,204,21,0.3)',
                  boxShadow: '0 0 24px rgba(250,204,21,0.15)',
                }}
              >
                <Scale className="w-8 h-8" style={{ color: '#FACC15' }} />
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 36,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  marginBottom: 4,
                }}
              >
                <span style={{ color: '#FACC15' }}>LEX</span>
                <span style={{ color: '#525252' }}>.</span>
              </h2>
              <p
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  color: '#525252',
                  letterSpacing: '0.2em',
                  marginBottom: 24,
                }}
              >
                SISTEMA LEGAL · USA LATINO PRIME
              </p>
              <p
                className="max-w-md mb-8"
                style={{ fontSize: 13, color: '#A1A1A1', lineHeight: 1.55 }}
              >
                Revisa formularios, declaraciones o evidencia. Detecta fallas antes de que lleguen al juez.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                {[
                  { title: 'Revisar un formulario I-485', hint: 'Sube el PDF y te doy feedback completo' },
                  { title: 'Evaluar declaración jurada', hint: 'Checkeo narrativa, inconsistencias y requisitos' },
                  { title: 'Checklist de evidencia SIJS', hint: 'Qué documentos te faltan para corte' },
                  { title: 'Revisar renuncia de padre', hint: 'Valido voluntariedad y formato legal' },
                ].map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(ex.title)}
                    className="text-left p-3.5 rounded-2xl transition-all duration-300 hover:-translate-y-0.5"
                    style={{
                      background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
                      border: '0.5px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#FACC15' }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.005em' }}>
                          {ex.title}
                        </p>
                        <p style={{ fontSize: 11, color: '#A1A1A1', marginTop: 3, lineHeight: 1.5 }}>
                          {ex.hint}
                        </p>
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
                <div
                  className="flex items-center gap-2 pl-11"
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 11,
                    color: '#A1A1A1',
                    letterSpacing: '0.05em',
                  }}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span style={{ color: '#FACC15' }}>▸</span> LEX ANALIZANDO…
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div
          className="p-4"
          style={{
            background: 'rgba(10,10,10,0.85)',
            backdropFilter: 'blur(20px)',
            borderTop: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="max-w-3xl mx-auto">
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pendingAttachments.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '0.5px solid rgba(255,255,255,0.1)',
                      fontSize: 11,
                    }}
                  >
                    <FileIcon className="w-3 h-3" style={{ color: '#A1A1A1' }} />
                    <span style={{ fontWeight: 600, color: '#FFFFFF', maxWidth: 180 }} className="truncate">{a.filename}</span>
                    <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, color: '#525252' }}>
                      {formatFileSize(a.size_bytes)}
                    </span>
                    <button
                      onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ color: '#A1A1A1' }}
                      className="hover:text-red-300 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              className="flex items-end gap-2 rounded-2xl p-2 transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.1)',
              }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming || pendingAttachments.length >= 5}
                className="flex-shrink-0 w-9 h-9 rounded-lg transition-colors hover:bg-white/10 flex items-center justify-center disabled:opacity-40"
                style={{ color: '#A1A1A1' }}
                title="Adjuntar archivo"
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
                placeholder="Consulta a LEX o sube un documento…"
                rows={1}
                disabled={streaming}
                className="flex-1 bg-transparent border-none outline-none resize-none px-2 py-2 max-h-60"
                style={{
                  fontSize: 13,
                  color: '#FFFFFF',
                  letterSpacing: '-0.005em',
                }}
              />

              {streaming ? (
                <button
                  onClick={handleStopStream}
                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-opacity hover:opacity-90"
                  style={{ background: '#EF4444', color: '#FFFFFF' }}
                  title="Detener"
                >
                  <div className="w-3 h-3 bg-white rounded-sm" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() && pendingAttachments.length === 0}
                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: '#FACC15',
                    color: '#000000',
                    boxShadow: '0 0 16px rgba(250,204,21,0.3)',
                  }}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>

            <p
              className="text-center mt-2"
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 9,
                color: '#525252',
                letterSpacing: '0.15em',
              }}
            >
              MÁX 5 ARCHIVOS · 20 MB C/U · PDF · WORD · IMÁGENES
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
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(250,204,21,0.18), rgba(250,204,21,0.04))',
            border: '0.5px solid rgba(250,204,21,0.3)',
            boxShadow: '0 0 12px rgba(250,204,21,0.18)',
          }}
        >
          <Scale className="w-4 h-4" style={{ color: '#FACC15' }} />
        </div>
      )}
      <div className={`max-w-[78%] ${isUser ? 'order-1' : ''}`}>
        <div
          className="rounded-2xl"
          style={
            isUser
              ? {
                  background: '#FFFFFF',
                  color: '#000000',
                  padding: '12px 16px',
                  boxShadow: '0 4px 18px rgba(255,255,255,0.12)',
                }
              : {
                  background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  padding: '16px 20px',
                  backdropFilter: 'blur(20px)',
                }
          }
        >
          {message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {message.attachments.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2 py-1 rounded"
                  style={{
                    background: isUser ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
                    fontSize: 10,
                    color: isUser ? '#000000' : '#FFFFFF',
                  }}
                >
                  <FileIcon className="w-3 h-3" />
                  <span className="truncate" style={{ maxWidth: 140 }}>{a.filename}</span>
                </div>
              ))}
            </div>
          )}
          {isUser ? (
            <p style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', letterSpacing: '-0.005em' }}>
              {message.content}
            </p>
          ) : (
            <div
              style={{ fontSize: 13 }}
              dangerouslySetInnerHTML={{
                __html:
                  renderMarkdown(message.content) +
                  (isStreaming ? '<span class="inline-block w-1.5 h-4 ml-0.5 animate-pulse" style="background:#FACC15;vertical-align:middle" />' : ''),
              }}
            />
          )}
        </div>
        <p
          className="mt-1 px-1"
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 9,
            color: '#525252',
            letterSpacing: '0.05em',
            textAlign: isUser ? 'right' : 'left',
          }}
        >
          {format(new Date(message.created_at), 'HH:mm', { locale: es })}
        </p>
      </div>
      {isUser && (
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid rgba(255,255,255,0.1)',
          }}
        >
          <User className="w-4 h-4" style={{ color: '#A1A1A1' }} />
        </div>
      )}
    </div>
  )
}

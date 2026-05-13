'use client'

import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { Users, Send, Loader2 } from 'lucide-react'
import type { ConversationListItem, ChatMessage, StaffProfile } from './types'

interface Props {
  conversation: ConversationListItem
  messages: ChatMessage[]
  sendersById: Map<string, StaffProfile>
  currentUserId: string
  loading: boolean
  hasMore: boolean
  onSendMessage: (body: string) => Promise<void>
  onLoadOlder: () => Promise<void>
}

export function ChatThread({
  conversation, messages, sendersById, currentUserId, loading, hasMore,
  onSendMessage, onLoadOlder,
}: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastMsgIdRef = useRef<string | null>(null)

  // Auto-scroll cuando llega un mensaje nuevo (no cuando se cargan viejos)
  useLayoutEffect(() => {
    const latest = messages[messages.length - 1]
    if (!latest) return
    if (latest.id !== lastMsgIdRef.current) {
      lastMsgIdRef.current = latest.id
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages])

  // Foco inicial
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [conversation.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim() || sending) return
    setSending(true)
    try {
      await onSendMessage(draft)
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  const isGroup = conversation.type === 'group'
  const headerName = isGroup
    ? conversation.name || 'Grupo'
    : (() => {
        const other = conversation.participants[0]
        if (!other) return 'Conversación'
        return `${other.first_name || ''} ${other.last_name || ''}`.trim() || other.email
      })()
  const headerSub = isGroup
    ? `${conversation.participants.length + 1} miembros`
    : conversation.participants[0]
      ? roleLabel(conversation.participants[0].role, conversation.participants[0].employee_type)
      : ''

  return (
    <>
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center gap-3">
        {isGroup ? (
          <span className="h-9 w-9 rounded-full bg-[#002855] text-white inline-flex items-center justify-center">
            <Users className="w-4 h-4" />
          </span>
        ) : (
          <Avatar name={headerName} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 truncate">{headerName}</p>
          <p className="text-[11px] text-gray-500 truncate">{headerSub}</p>
        </div>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {hasMore && (
          <div className="text-center mb-3">
            <button
              type="button"
              onClick={onLoadOlder}
              disabled={loading}
              className="text-[11px] text-gray-500 hover:text-gray-700 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Cargar mensajes anteriores
            </button>
          </div>
        )}
        {messages.length === 0 && !loading ? (
          <p className="text-xs text-gray-400 text-center py-8">
            Aún no hay mensajes. Sé el primero en escribir 👇
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m, idx) => {
              const sender = sendersById.get(m.sender_id)
              const isMe = m.sender_id === currentUserId
              const prev = messages[idx - 1]
              const groupedWithPrev =
                prev &&
                prev.sender_id === m.sender_id &&
                new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  sender={sender}
                  isMe={isMe}
                  showHeader={!groupedWithPrev}
                  isGroup={isGroup}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/30 focus:border-[#F2A900] max-h-32"
            style={{ minHeight: '40px' }}
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-[#F2A900] hover:bg-[#D4940A] disabled:bg-gray-200 disabled:text-gray-400 text-white transition-colors"
            aria-label="Enviar"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 px-1">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </form>
    </>
  )
}

function MessageBubble({
  message, sender, isMe, showHeader, isGroup,
}: {
  message: ChatMessage
  sender: StaffProfile | undefined
  isMe: boolean
  showHeader: boolean
  isGroup: boolean
}) {
  const senderName = sender
    ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || sender.email
    : 'Usuario'
  const timeStr = new Date(message.created_at).toLocaleTimeString('es-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        {showHeader && !isMe && isGroup && (
          <p className="text-[11px] text-gray-500 font-medium mb-1 px-2">{senderName}</p>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2 ${
            isMe
              ? 'bg-[#F2A900] text-white rounded-br-md'
              : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
          }`}
        >
          {message.body && (
            <p className="text-sm whitespace-pre-wrap break-words leading-snug">
              {message.body}
            </p>
          )}
          {message.attachment_url && (
            <p className={`text-[11px] mt-1 ${isMe ? 'text-white/80' : 'text-gray-500'}`}>
              {/* Placeholder — F4 implementa la preview/descarga */}
              📎 {message.attachment_name || 'Adjunto'}
            </p>
          )}
        </div>
        <p className={`text-[10px] text-gray-400 mt-0.5 px-2 ${isMe ? 'text-right' : 'text-left'}`}>
          {timeStr}
        </p>
      </div>
    </div>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?'
  return (
    <span className="h-9 w-9 rounded-full bg-gradient-to-br from-[#002855] to-[#003b7a] text-white text-xs font-bold inline-flex items-center justify-center">
      {initials}
    </span>
  )
}

function roleLabel(role: string, employeeType: string | null): string {
  if (role === 'admin') return 'Admin'
  if (employeeType === 'paralegal') return 'Paralegal'
  if (employeeType === 'senior_consultant') return 'Consultora Senior'
  if (employeeType === 'contracts_manager') return 'Contratos · Logística'
  return 'Empleado'
}

'use client'

import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { Users, Send, Loader2, Paperclip, X } from 'lucide-react'
import type { ConversationListItem, ChatMessage, StaffProfile, ChatMention } from './types'
import { MessageAttachment } from './message-attachment'
import { MentionAutocomplete } from './mention-autocomplete'
import { MessageBody } from './message-body'

export interface PendingAttachment {
  path: string
  attachment_type: 'image' | 'document'
  attachment_name: string
  attachment_size: number
}

interface Props {
  conversation: ConversationListItem
  messages: ChatMessage[]
  sendersById: Map<string, StaffProfile>
  currentUserId: string
  loading: boolean
  hasMore: boolean
  onSendMessage: (
    body: string,
    attachment?: PendingAttachment,
    mentions?: ChatMention[]
  ) => Promise<void>
  onLoadOlder: () => Promise<void>
  /** Si true, no renderiza el header interno — usado cuando el padre tiene el suyo */
  hideHeader?: boolean
}

export function ChatThread({
  conversation, messages, sendersById, currentUserId, loading, hasMore,
  onSendMessage, onLoadOlder, hideHeader = false,
}: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingMentions, setPendingMentions] = useState<ChatMention[]>([])
  // Estado del autocomplete: si hay trigger activo, qué se está buscando
  const [mentionState, setMentionState] = useState<{
    trigger: '@' | '#'
    query: string
    startIdx: number
  } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
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
    if (sending || uploading) return
    if (!draft.trim() && !pendingFile) return

    setSending(true)
    try {
      let attachment: PendingAttachment | undefined
      if (pendingFile) {
        setUploading(true)
        const form = new FormData()
        form.append('file', pendingFile)
        form.append('conversation_id', conversation.id)
        const res = await fetch('/api/chat/upload-attachment', {
          method: 'POST',
          credentials: 'same-origin',
          body: form,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          alert(err.error || 'Error subiendo el archivo')
          setUploading(false)
          setSending(false)
          return
        }
        const data = await res.json()
        attachment = {
          path: data.path,
          attachment_type: data.attachment_type,
          attachment_name: data.attachment_name,
          attachment_size: data.attachment_size,
        }
        setUploading(false)
      }
      // Filtrar mentions a las que efectivamente quedaron en el draft
      const activeMentions = pendingMentions.filter((m) => {
        const prefix = m.type === 'client' ? '@' : '#'
        return draft.includes(`${prefix}${m.label}`)
      })
      await onSendMessage(draft, attachment, activeMentions)
      setDraft('')
      setPendingFile(null)
      setPendingMentions([])
      setMentionState(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setSending(false)
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value)
    // Detectar trigger @ o # antes del cursor
    const el = textareaRef.current
    if (!el) return
    const cursor = el.selectionStart ?? value.length
    // Mira el último carácter @ o # antes del cursor
    const upToCursor = value.slice(0, cursor)
    const atIdx = upToCursor.lastIndexOf('@')
    const hashIdx = upToCursor.lastIndexOf('#')
    const triggerIdx = Math.max(atIdx, hashIdx)
    if (triggerIdx === -1) {
      setMentionState(null)
      return
    }
    // El trigger debe estar al inicio o precedido de espacio/salto
    if (triggerIdx > 0 && !/\s/.test(value[triggerIdx - 1])) {
      setMentionState(null)
      return
    }
    const after = upToCursor.slice(triggerIdx + 1)
    // Si hay espacio en lo que sigue, abortar
    if (/\s/.test(after)) {
      setMentionState(null)
      return
    }
    const trigger = (atIdx === triggerIdx ? '@' : '#') as '@' | '#'
    setMentionState({ trigger, query: after, startIdx: triggerIdx })
  }

  function applyMention(mention: ChatMention) {
    if (!mentionState) return
    const prefix = mention.type === 'client' ? '@' : '#'
    const replaceFrom = mentionState.startIdx
    const replaceTo = mentionState.startIdx + 1 + mentionState.query.length
    const newDraft =
      draft.slice(0, replaceFrom) +
      prefix + mention.label + ' ' +
      draft.slice(replaceTo)
    setDraft(newDraft)
    setPendingMentions((prev) => {
      // Evitar duplicados por id+type
      const exists = prev.some((m) => m.id === mention.id && m.type === mention.type)
      return exists ? prev : [...prev, mention]
    })
    setMentionState(null)
    // Reposicionar el cursor justo después de la mención insertada
    setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      const newPos = replaceFrom + prefix.length + mention.label.length + 1
      el.focus()
      el.setSelectionRange(newPos, newPos)
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Si el autocomplete está abierto, dejamos que él maneje Enter/Tab/flechas
    if (mentionState) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) {
      alert('El archivo excede el límite de 10 MB')
      e.target.value = ''
      return
    }
    setPendingFile(f)
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
      {!hideHeader && (
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
      )}

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
      <form onSubmit={handleSubmit} className="relative px-4 py-3 border-t border-gray-200 bg-white">
        {mentionState && (
          <div className="absolute left-4 right-4 bottom-full">
            <MentionAutocomplete
              trigger={mentionState.trigger}
              query={mentionState.query}
              onSelect={applyMention}
            />
          </div>
        )}
        {pendingFile && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <Paperclip className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <p className="text-xs text-gray-700 truncate flex-1">
              {pendingFile.name}{' '}
              <span className="text-gray-400">
                ({Math.round(pendingFile.size / 1024)} KB)
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                setPendingFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="h-6 w-6 inline-flex items-center justify-center rounded text-gray-400 hover:bg-gray-200"
              aria-label="Quitar archivo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
            className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-500 transition-colors"
            title="Adjuntar archivo"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje... usa @ para clientes y # para casos"
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/30 focus:border-[#F2A900] max-h-32"
            style={{ minHeight: '40px' }}
          />
          <button
            type="submit"
            disabled={(!draft.trim() && !pendingFile) || sending || uploading}
            className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-[#F2A900] hover:bg-[#D4940A] disabled:bg-gray-200 disabled:text-gray-400 text-white transition-colors"
            aria-label="Enviar"
          >
            {sending || uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 px-1">
          Enter para enviar · Shift+Enter para nueva línea · Adjuntos hasta 10 MB
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
            <MessageBody
              body={message.body}
              mentions={message.mentions || []}
              isMe={isMe}
            />
          )}
          {message.attachment_url && message.attachment_type && (
            <MessageAttachment
              path={message.attachment_url}
              type={message.attachment_type}
              name={message.attachment_name}
              size={message.attachment_size}
              isMe={isMe}
            />
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

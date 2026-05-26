'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Plus, X, Users, MessageCircle, Search, Loader2 } from 'lucide-react'
import { ChatThread, type PendingAttachment } from '@/app/employee/chat/chat-thread'
import type {
  ConversationListItem,
  ChatMessage,
  StaffProfile,
  ChatMention,
} from '@/app/employee/chat/types'

interface Props {
  currentUserId: string
  onClose: () => void
  onUnreadChange?: (total: number) => void
}

/**
 * Panel completo de chat embebido dentro del widget flotante.
 * Tiene 2 vistas: lista de conversaciones (default) y thread.
 * Reutiliza ChatThread del módulo /employee/chat.
 */
export function ChatPopupPanel({ currentUserId, onClose, onUnreadChange }: Props) {
  const supabase = createClient()
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sendersById, setSendersById] = useState<Map<string, StaffProfile>>(new Map())
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [view, setView] = useState<'list' | 'thread' | 'new-dm'>('list')
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [dmSearch, setDmSearch] = useState('')

  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0)

  useEffect(() => {
    onUnreadChange?.(totalUnread)
  }, [totalUnread, onUnreadChange])

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true)
    try {
      const res = await fetch('/api/chat/conversations', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } finally {
      setLoadingConvs(false)
    }
  }, [])

  const loadMessages = useCallback(async (convId: string, before?: string) => {
    setLoadingMessages(true)
    try {
      const url = new URL(`/api/chat/conversations/${convId}/messages`, window.location.origin)
      if (before) url.searchParams.set('before', before)
      const res = await fetch(url.toString(), { credentials: 'same-origin' })
      if (!res.ok) return
      const data = await res.json()
      const newMsgs: ChatMessage[] = data.messages || []
      const newSenders: StaffProfile[] = data.senders || []
      setHasMoreMessages(!!data.has_more)
      setSendersById((prev) => {
        const m = new Map(prev)
        for (const s of newSenders) m.set(s.id, s)
        return m
      })
      if (before) setMessages((prev) => [...newMsgs, ...prev])
      else setMessages(newMsgs)
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  const markAsRead = useCallback(async (convId: string) => {
    await fetch(`/api/chat/conversations/${convId}/read`, {
      method: 'POST',
      credentials: 'same-origin',
    })
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
    )
  }, [])

  // Carga inicial
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Cuando cambia la conv activa: cargar mensajes y marcar como leído
  useEffect(() => {
    if (!activeConvId) return
    setMessages([])
    loadMessages(activeConvId)
    markAsRead(activeConvId)
  }, [activeConvId, loadMessages, markAsRead])

  // Suscripción Realtime
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted || !session) return
      supabase.realtime.setAuth(session.access_token)
    })

    const channel = supabase
      .channel('chat-popup-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as ChatMessage
          if (msg.conversation_id === activeConvId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev
              return [...prev, msg]
            })
            if (!sendersById.has(msg.sender_id)) {
              const { data } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, email, role, employee_type')
                .eq('id', msg.sender_id)
                .single()
              if (data) {
                setSendersById((prev) => {
                  const m = new Map(prev)
                  m.set(data.id, data as StaffProfile)
                  return m
                })
              }
            }
            if (msg.sender_id !== currentUserId) markAsRead(activeConvId)
          } else {
            setConversations((prev) => {
              const updated = prev.map((c) =>
                c.id === msg.conversation_id
                  ? {
                      ...c,
                      last_message_at: msg.created_at,
                      last_message: {
                        id: msg.id,
                        body: msg.body,
                        attachment_type: msg.attachment_type,
                        attachment_name: msg.attachment_name,
                        created_at: msg.created_at,
                        sender_id: msg.sender_id,
                      },
                      unread_count:
                        msg.sender_id === currentUserId
                          ? c.unread_count
                          : c.unread_count + 1,
                    }
                  : c
              )
              return updated.sort((a, b) =>
                b.last_message_at.localeCompare(a.last_message_at)
              )
            })
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [activeConvId, currentUserId, markAsRead, sendersById, supabase])

  async function handleSendMessage(
    body: string,
    attachment?: PendingAttachment,
    mentions?: ChatMention[]
  ) {
    if (!activeConvId) return
    if (!body.trim() && !attachment) return
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: activeConvId,
        body: body.trim() || null,
        attachment_url: attachment?.path,
        attachment_type: attachment?.attachment_type,
        attachment_name: attachment?.attachment_name,
        attachment_size: attachment?.attachment_size,
        mentions: mentions || [],
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Error enviando mensaje')
      return
    }
    const data = await res.json()
    if (data?.message) {
      const newMsg = data.message as ChatMessage
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      })
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === activeConvId
            ? {
                ...c,
                last_message_at: newMsg.created_at,
                last_message: {
                  id: newMsg.id,
                  body: newMsg.body,
                  attachment_type: newMsg.attachment_type,
                  attachment_name: newMsg.attachment_name,
                  created_at: newMsg.created_at,
                  sender_id: newMsg.sender_id,
                },
              }
            : c
        )
        return updated.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
      })
    }
  }

  async function loadStaff() {
    const res = await fetch('/api/chat/staff', { credentials: 'same-origin' })
    if (res.ok) {
      const data = await res.json()
      setStaff(data.staff || [])
    }
  }

  async function handleStartDM(otherUserId: string) {
    const res = await fetch('/api/chat/conversations/dm', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ other_user_id: otherUserId }),
    })
    if (!res.ok) {
      alert('Error iniciando conversación')
      return
    }
    const data = await res.json()
    await loadConversations()
    setActiveConvId(data.conversation.id)
    setView('thread')
    setDmSearch('')
  }

  async function handleLoadOlder() {
    if (!activeConvId || messages.length === 0 || !hasMoreMessages) return
    await loadMessages(activeConvId, messages[0].created_at)
  }

  const activeConv = conversations.find((c) => c.id === activeConvId) || null

  // ────────────────── Render ──────────────────

  if (view === 'thread' && activeConv) {
    return (
      <div className="flex flex-col h-full">
        {/* Header con back */}
        <div
          className="px-3 py-2.5 flex items-center gap-2"
          style={{
            background: 'var(--admin-bg-elev)',
            borderBottom: '0.5px solid var(--admin-border)',
          }}
        >
          <button
            type="button"
            onClick={() => setView('list')}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md transition-opacity hover:opacity-80"
            style={{ color: 'var(--admin-fg-muted)' }}
            aria-label="Volver"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-bold truncate"
              style={{ color: 'var(--admin-fg)' }}
            >
              {convDisplayName(activeConv)}
            </p>
            <p
              className="text-[10px] truncate"
              style={{ color: 'var(--admin-fg-muted)' }}
            >
              {convDisplaySubtitle(activeConv)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md transition-opacity hover:opacity-80"
            style={{ color: 'var(--admin-fg-subtle)' }}
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <ChatThread
            conversation={activeConv}
            messages={messages}
            sendersById={sendersById}
            currentUserId={currentUserId}
            loading={loadingMessages}
            hasMore={hasMoreMessages}
            onSendMessage={handleSendMessage}
            onLoadOlder={handleLoadOlder}
            hideHeader
          />
        </div>
      </div>
    )
  }

  if (view === 'new-dm') {
    const filteredStaff = staff.filter((s) => {
      if (!dmSearch.trim()) return true
      const q = dmSearch.toLowerCase()
      const name = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase()
      return name.includes(q) || s.email.toLowerCase().includes(q)
    })
    return (
      <div className="flex flex-col h-full">
        <div
          className="px-3 py-2.5 flex items-center gap-2"
          style={{
            background: 'var(--admin-bg-elev)',
            borderBottom: '0.5px solid var(--admin-border)',
          }}
        >
          <button
            type="button"
            onClick={() => setView('list')}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md transition-opacity hover:opacity-80"
            style={{ color: 'var(--admin-fg-muted)' }}
            aria-label="Volver"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="text-sm font-bold flex-1" style={{ color: 'var(--admin-fg)' }}>
            Nuevo mensaje
          </p>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md transition-opacity hover:opacity-80"
            style={{ color: 'var(--admin-fg-subtle)' }}
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          className="px-3 py-2"
          style={{ borderBottom: '0.5px solid var(--admin-border)' }}
        >
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: 'var(--admin-fg-subtle)' }}
            />
            <input
              type="text"
              value={dmSearch}
              onChange={(e) => setDmSearch(e.target.value)}
              placeholder="Buscar persona..."
              className="w-full pl-8 pr-3 h-9 rounded-lg text-xs focus:outline-none focus:ring-2"
              style={{
                background: 'var(--admin-bg-elev)',
                color: 'var(--admin-fg)',
                border: '0.5px solid var(--admin-border-strong)',
              }}
              autoFocus
            />
          </div>
        </div>
        <div
          className="flex-1 overflow-y-auto"
          style={{ background: 'var(--admin-bg-elev)' }}
        >
          {filteredStaff.length === 0 ? (
            <p
              className="text-xs px-3 py-6 text-center"
              style={{ color: 'var(--admin-fg-subtle)' }}
            >
              {staff.length === 0 ? 'Cargando equipo...' : 'Sin resultados'}
            </p>
          ) : (
            <div>
              {filteredStaff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleStartDM(s.id)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors"
                  style={{ borderBottom: '0.5px solid var(--admin-border)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-bg-elev-2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <Avatar name={`${s.first_name || ''} ${s.last_name || ''}`} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--admin-fg)' }}
                    >
                      {`${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email}
                    </p>
                    <p
                      className="text-[10px] truncate"
                      style={{ color: 'var(--admin-fg-muted)' }}
                    >
                      {staffRoleLabel(s.role, s.employee_type)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Vista lista (default)
  return (
    <div className="flex flex-col h-full">
      <div
        className="px-3 py-2.5 flex items-center gap-2"
        style={{
          background: 'var(--admin-bg-elev)',
          borderBottom: '0.5px solid var(--admin-border)',
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: 'var(--admin-fg)' }}>
            Chat del equipo
          </p>
          <p
            className="text-[10px]"
            style={{ color: 'var(--admin-fg-muted)' }}
          >
            {totalUnread > 0 ? `${totalUnread} sin leer` : 'Al dia'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setView('new-dm')
            loadStaff()
          }}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md transition-opacity hover:opacity-80"
          style={{ color: 'var(--admin-fg-muted)' }}
          aria-label="Nueva conversación"
          title="Nueva conversación"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md transition-opacity hover:opacity-80"
          style={{ color: 'var(--admin-fg-subtle)' }}
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{ background: 'var(--admin-bg-elev)' }}
      >
        {loadingConvs && conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Loader2
              className="w-5 h-5 animate-spin mx-auto mb-2"
              style={{ color: 'var(--admin-fg-muted)' }}
            />
            <p className="text-xs" style={{ color: 'var(--admin-fg-subtle)' }}>
              Cargando conversaciones...
            </p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageCircle
              className="w-8 h-8 mx-auto mb-2"
              style={{ color: 'var(--admin-fg-faint)' }}
            />
            <p className="text-xs mb-3" style={{ color: 'var(--admin-fg-muted)' }}>
              Aun no tienes conversaciones.
            </p>
            <button
              type="button"
              onClick={() => {
                setView('new-dm')
                loadStaff()
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
              style={{ color: 'var(--admin-gold)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Iniciar conversacion
            </button>
          </div>
        ) : (
          <div>
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveConvId(c.id)
                  setView('thread')
                }}
                className="w-full text-left flex items-start gap-3 px-3 py-2.5 transition-colors"
                style={{ borderBottom: '0.5px solid var(--admin-border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-bg-elev-2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                {c.type === 'group' ? (
                  <span
                    className="flex-shrink-0 h-9 w-9 rounded-full inline-flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
                      color: '#FFFFFF',
                    }}
                  >
                    <Users className="w-4 h-4" />
                  </span>
                ) : (
                  <Avatar name={convDisplayName(c)} size="md" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1">
                    <p
                      className="text-sm truncate"
                      style={{
                        color: 'var(--admin-fg)',
                        fontWeight: c.unread_count > 0 ? 700 : 500,
                      }}
                    >
                      {convDisplayName(c)}
                    </p>
                    {c.last_message && (
                      <p
                        className="text-[10px] flex-shrink-0"
                        style={{
                          color: 'var(--admin-fg-subtle)',
                          fontFamily: 'var(--font-mono-tech)',
                        }}
                      >
                        {formatRelativeTime(c.last_message.created_at)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                      className="text-[11px] truncate"
                      style={{
                        color: c.unread_count > 0 ? 'var(--admin-fg)' : 'var(--admin-fg-muted)',
                      }}
                    >
                      {lastMessageSummary(c.last_message, currentUserId)}
                    </p>
                    {c.unread_count > 0 && (
                      <span
                        className="flex-shrink-0 h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold inline-flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, #F2C14E, var(--admin-gold))',
                          color: 'var(--admin-accent)',
                          boxShadow: '0 4px 10px rgba(216,155,29,0.28)',
                        }}
                      >
                        {c.unread_count > 9 ? '9+' : c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────── Helpers ──────────────────

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || '?'
  const classes = size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-9 w-9 text-xs'
  return (
    <span
      className={`flex-shrink-0 ${classes} rounded-full font-bold inline-flex items-center justify-center`}
      style={{
        background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
        color: '#FFFFFF',
        boxShadow: '0 0 0 0.5px rgba(255,255,255,0.18) inset',
      }}
    >
      {initials}
    </span>
  )
}

function convDisplayName(c: ConversationListItem): string {
  if (c.type === 'group') return c.name || 'Grupo'
  const other = c.participants[0]
  if (!other) return 'Conversación'
  return `${other.first_name || ''} ${other.last_name || ''}`.trim() || other.email
}

function convDisplaySubtitle(c: ConversationListItem): string {
  if (c.type === 'group') return `${c.participants.length + 1} miembros`
  const other = c.participants[0]
  if (!other) return ''
  return staffRoleLabel(other.role, other.employee_type)
}

function lastMessageSummary(
  last: ConversationListItem['last_message'],
  currentUserId: string
): string {
  if (!last) return 'Sin mensajes aún'
  const prefix = last.sender_id === currentUserId ? 'Tú: ' : ''
  if (last.attachment_type === 'image') return `${prefix}📷 Imagen`
  if (last.attachment_type === 'document') return `${prefix}📎 ${last.attachment_name || 'Documento'}`
  return prefix + (last.body || '')
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diffSec < 60) return 'ahora'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d`
  return d.toLocaleDateString('es-US', { day: 'numeric', month: 'short' })
}

function staffRoleLabel(role: string, employeeType: string | null): string {
  if (role === 'admin') return 'Admin'
  if (employeeType === 'paralegal') return 'Paralegal'
  if (employeeType === 'senior_consultant') return 'Consultora Senior'
  if (employeeType === 'contracts_manager') return 'Contratos · Logística'
  return 'Empleado'
}

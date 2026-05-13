'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle } from 'lucide-react'
import type { ConversationListItem, ChatMessage, StaffProfile, ChatMention } from './types'
import { ConversationsSidebar } from './conversations-sidebar'
import { ChatThread } from './chat-thread'

interface Props {
  currentUserId: string
  currentUserName: string
}

export function ChatClient({ currentUserId, currentUserName }: Props) {
  const supabase = createClient()
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sendersById, setSendersById] = useState<Map<string, StaffProfile>>(new Map())
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true)
    try {
      const res = await fetch('/api/chat/conversations', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
        if (!activeConvId && data.conversations?.[0]) {
          setActiveConvId(data.conversations[0].id)
        }
      }
    } finally {
      setLoadingConvs(false)
    }
  }, [activeConvId])

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
      if (before) {
        setMessages((prev) => [...newMsgs, ...prev])
      } else {
        setMessages(newMsgs)
      }
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  const markAsRead = useCallback(async (convId: string) => {
    await fetch(`/api/chat/conversations/${convId}/read`, {
      method: 'POST',
      credentials: 'same-origin',
    })
    // Resetear unread localmente
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
    )
  }, [])

  // Carga inicial
  useEffect(() => {
    loadConversations()
  }, [])

  // Cuando cambia la conversación activa: cargar mensajes y marcar como leído
  useEffect(() => {
    if (!activeConvId) return
    setMessages([])
    loadMessages(activeConvId)
    markAsRead(activeConvId)
  }, [activeConvId, loadMessages, markAsRead])

  // Suscripción Realtime global a INSERTs en messages
  useEffect(() => {
    const channel = supabase
      .channel('chat-messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as ChatMessage
          // Si es de la conv activa, lo añadimos al thread
          if (msg.conversation_id === activeConvId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev
              return [...prev, msg]
            })
            // Cargar perfil del sender si no lo tenemos
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
            // Marcar como leído inmediatamente si la conv está activa
            if (msg.sender_id !== currentUserId) {
              markAsRead(activeConvId)
            }
          } else {
            // No es la activa: bump unread + reordenar lista
            setConversations((prev) => {
              const updated = prev.map((c) => {
                if (c.id !== msg.conversation_id) return c
                return {
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
                  unread_count: msg.sender_id === currentUserId ? c.unread_count : c.unread_count + 1,
                }
              })
              return updated.sort((a, b) =>
                b.last_message_at.localeCompare(a.last_message_at)
              )
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeConvId, currentUserId, markAsRead, sendersById, supabase])

  async function handleSendMessage(
    body: string,
    attachment?: {
      path: string
      attachment_type: 'image' | 'document'
      attachment_name: string
      attachment_size: number
    },
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
    }
    // No actualizo localmente: el realtime listener inserta el mensaje
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
  }

  async function handleLoadOlder() {
    if (!activeConvId || messages.length === 0 || !hasMoreMessages) return
    await loadMessages(activeConvId, messages[0].created_at)
  }

  const activeConv = conversations.find((c) => c.id === activeConvId) || null

  return (
    <div className="h-[calc(100vh-180px)] min-h-[500px] flex bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <ConversationsSidebar
        currentUserId={currentUserId}
        conversations={conversations}
        activeId={activeConvId}
        loading={loadingConvs}
        onSelect={setActiveConvId}
        onStartDM={handleStartDM}
      />
      <div className="flex-1 flex flex-col bg-gray-50/30 min-w-0">
        {activeConv ? (
          <ChatThread
            conversation={activeConv}
            messages={messages}
            sendersById={sendersById}
            currentUserId={currentUserId}
            loading={loadingMessages}
            hasMore={hasMoreMessages}
            onSendMessage={handleSendMessage}
            onLoadOlder={handleLoadOlder}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center px-6">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {loadingConvs
                  ? 'Cargando conversaciones...'
                  : 'Selecciona una conversación o inicia una nueva'}
              </p>
              <p className="text-[11px] mt-1">Hola, {currentUserName}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

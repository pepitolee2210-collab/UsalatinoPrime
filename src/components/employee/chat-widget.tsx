'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { MessagesSquare, X, ExternalLink, Users, Plus } from 'lucide-react'

interface ConversationPreview {
  id: string
  type: 'dm' | 'group'
  name: string | null
  last_message_at: string
  participants: Array<{
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  }>
  last_message: {
    body: string | null
    attachment_type: 'image' | 'document' | null
    attachment_name: string | null
    created_at: string
    sender_id: string
  } | null
  unread_count: number
}

/**
 * Widget flotante de chat estilo Intercom para el panel del empleado.
 * Burbuja en la esquina inferior derecha. Click → panel con lista de
 * conversaciones + link "Abrir chat completo".
 */
export function ChatWidget({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationPreview[]>([])
  const [loading, setLoading] = useState(false)

  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/chat/conversations', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Refrescar cada 30s cuando está cerrado para mantener badge actualizado
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  // Cuando abren el panel, refrescar inmediatamente
  useEffect(() => {
    if (open) load()
  }, [open, load])

  return (
    <>
      {/* Burbuja */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed z-40 bottom-4 right-4 md:bottom-6 md:right-6 h-12 w-12 rounded-full bg-[#F2A900] hover:bg-[#D4940A] text-white shadow-lg shadow-amber-500/30 inline-flex items-center justify-center transition-transform active:scale-95"
        aria-label="Abrir chat"
      >
        {open ? <X className="w-5 h-5" /> : <MessagesSquare className="w-5 h-5" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold inline-flex items-center justify-center border-2 border-white">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed z-40 bottom-20 right-4 md:bottom-24 md:right-6 w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[70vh]">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">Chat del equipo</p>
              <p className="text-[11px] text-gray-500">
                {totalUnread > 0 ? `${totalUnread} sin leer` : 'Al día'}
              </p>
            </div>
            <Link
              href="/employee/chat"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#F2A900] font-medium"
              title="Abrir chat completo"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && conversations.length === 0 ? (
              <p className="text-xs text-gray-400 px-4 py-6 text-center">Cargando...</p>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-gray-400 px-4 py-6 text-center">
                Sin conversaciones aún.
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {conversations.slice(0, 8).map((c) => (
                  <ConvPreviewRow
                    key={c.id}
                    conv={c}
                    currentUserId={currentUserId}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>

          <Link
            href="/employee/chat"
            onClick={() => setOpen(false)}
            className="border-t border-gray-100 px-4 py-2.5 text-center text-xs font-medium text-[#F2A900] hover:bg-amber-50 inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva conversación
          </Link>
        </div>
      )}
    </>
  )
}

function ConvPreviewRow({
  conv, currentUserId, onClick,
}: {
  conv: ConversationPreview
  currentUserId: string
  onClick: () => void
}) {
  const name = (() => {
    if (conv.type === 'group') return conv.name || 'Grupo'
    const other = conv.participants[0]
    if (!other) return 'Conversación'
    return `${other.first_name || ''} ${other.last_name || ''}`.trim() || other.email
  })()

  const lastMsg = conv.last_message
  const preview = (() => {
    if (!lastMsg) return 'Sin mensajes aún'
    const prefix = lastMsg.sender_id === currentUserId ? 'Tú: ' : ''
    if (lastMsg.attachment_type === 'image') return `${prefix}📷 Imagen`
    if (lastMsg.attachment_type === 'document') return `${prefix}📎 ${lastMsg.attachment_name || 'Documento'}`
    return prefix + (lastMsg.body || '')
  })()

  return (
    <Link
      href="/employee/chat"
      onClick={onClick}
      className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
    >
      {conv.type === 'group' ? (
        <span className="flex-shrink-0 h-8 w-8 rounded-full bg-[#002855] text-white inline-flex items-center justify-center">
          <Users className="w-3.5 h-3.5" />
        </span>
      ) : (
        <Avatar name={name} />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
          {name}
        </p>
        <p className={`text-[11px] truncate ${conv.unread_count > 0 ? 'text-gray-700' : 'text-gray-500'}`}>
          {preview}
        </p>
      </div>
      {conv.unread_count > 0 && (
        <span className="flex-shrink-0 h-5 min-w-[20px] px-1.5 rounded-full bg-[#F2A900] text-white text-[10px] font-bold inline-flex items-center justify-center">
          {conv.unread_count > 9 ? '9+' : conv.unread_count}
        </span>
      )}
    </Link>
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
    <span className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-[#002855] to-[#003b7a] text-white text-[10px] font-bold inline-flex items-center justify-center">
      {initials}
    </span>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { MessagesSquare, X } from 'lucide-react'
import { ChatPopupPanel } from './chat-popup-panel'

/**
 * Widget flotante de chat estilo Messenger.
 * Burbuja en esquina inferior derecha → click abre panel completo
 * con lista de conversaciones, thread de mensajes, adjuntos y mentions.
 * Toda la experiencia ocurre dentro del popup, sin redirects.
 */
export function ChatWidget({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Cuando está cerrado, refrescar unread cada 30s vía endpoint sidebar-counts
  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/employee/sidebar-counts', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.chatUnread || 0)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (open) return // mientras está abierto, el panel propio maneja el contador
    refreshUnread()
    const interval = setInterval(refreshUnread, 30000)
    return () => clearInterval(interval)
  }, [open, refreshUnread])

  return (
    <>
      {/* Burbuja */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed z-40 bottom-4 right-4 md:bottom-6 md:right-6 h-13 w-13 rounded-full shadow-lg shadow-amber-500/30 inline-flex items-center justify-center transition-transform active:scale-95"
        aria-label={open ? 'Cerrar chat' : 'Abrir chat'}
        style={{
          height: 52,
          width: 52,
          background: 'var(--admin-gold)',
          color: 'var(--admin-bg)',
        }}
      >
        {open ? <X className="w-5 h-5" /> : <MessagesSquare className="w-5 h-5" />}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold inline-flex items-center justify-center border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel del chat — embebido, sin redirects */}
      {open && (
        <div className="fixed z-40 bottom-20 right-4 md:bottom-24 md:right-6 w-[calc(100vw-2rem)] max-w-[400px] h-[600px] max-h-[calc(100vh-7rem)] rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
          <ChatPopupPanel
            currentUserId={currentUserId}
            onClose={() => setOpen(false)}
            onUnreadChange={setUnreadCount}
          />
        </div>
      )}
    </>
  )
}

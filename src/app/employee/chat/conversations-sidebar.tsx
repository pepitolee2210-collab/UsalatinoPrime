'use client'

import { useEffect, useState } from 'react'
import { Plus, Users, Search, X, MessageCircle } from 'lucide-react'
import type { ConversationListItem, StaffProfile } from './types'

interface Props {
  currentUserId: string
  conversations: ConversationListItem[]
  activeId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onStartDM: (otherUserId: string) => void
}

export function ConversationsSidebar({
  currentUserId, conversations, activeId, loading, onSelect, onStartDM,
}: Props) {
  const [showNewDm, setShowNewDm] = useState(false)
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!showNewDm) return
    fetch('/api/chat/staff', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.staff) setStaff(d.staff)
      })
      .catch(() => {})
  }, [showNewDm])

  const filteredStaff = staff.filter((s) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const name = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase()
    return name.includes(q) || s.email.toLowerCase().includes(q)
  })

  return (
    <div className="w-72 border-r border-gray-200 bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#F2A900]" />
          Mensajes
        </h2>
        <button
          type="button"
          onClick={() => setShowNewDm(true)}
          title="Iniciar nueva conversación"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <p className="text-xs text-gray-400 px-4 py-6 text-center">Cargando...</p>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-gray-400 px-4 py-6 text-center">
            Sin conversaciones aún. Inicia una con el botón +.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {conversations.map((c) => (
              <ConversationRow
                key={c.id}
                conv={c}
                active={c.id === activeId}
                currentUserId={currentUserId}
                onClick={() => onSelect(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showNewDm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewDm(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-bold text-gray-900">Iniciar conversación directa</h3>
              <button
                type="button"
                onClick={() => setShowNewDm(false)}
                className="h-7 w-7 inline-flex items-center justify-center rounded text-gray-400 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="w-full pl-9 pr-3 h-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/40"
                  autoFocus
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                {filteredStaff.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">
                    Sin resultados.
                  </p>
                ) : (
                  filteredStaff.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onStartDM(s.id)
                        setShowNewDm(false)
                        setSearch('')
                      }}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <Avatar name={`${s.first_name || ''} ${s.last_name || ''}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {`${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {roleLabel(s.role, s.employee_type)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConversationRow({
  conv, active, currentUserId, onClick,
}: {
  conv: ConversationListItem
  active: boolean
  currentUserId: string
  onClick: () => void
}) {
  const displayName = conversationName(conv)
  const isGroup = conv.type === 'group'
  const last = conv.last_message

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-3 py-3 transition-colors ${
        active ? 'bg-[#F2A900]/10' : 'hover:bg-gray-50'
      }`}
    >
      {isGroup ? (
        <span className="flex-shrink-0 h-9 w-9 rounded-full bg-[#002855] text-white inline-flex items-center justify-center">
          <Users className="w-4 h-4" />
        </span>
      ) : (
        <Avatar name={displayName} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-sm font-semibold truncate ${active ? 'text-[#002855]' : 'text-gray-900'}`}>
            {displayName}
          </p>
          {last && (
            <p className="text-[10px] text-gray-400 flex-shrink-0">
              {formatRelativeTime(last.created_at)}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            {lastMessageSummary(last, currentUserId)}
          </p>
          {conv.unread_count > 0 && (
            <span className="flex-shrink-0 h-5 min-w-[20px] px-1.5 rounded-full bg-[#F2A900] text-white text-[10px] font-bold inline-flex items-center justify-center">
              {conv.unread_count > 99 ? '99+' : conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
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
    <span className="flex-shrink-0 h-9 w-9 rounded-full bg-gradient-to-br from-[#002855] to-[#003b7a] text-white text-xs font-bold inline-flex items-center justify-center">
      {initials}
    </span>
  )
}

function conversationName(c: ConversationListItem): string {
  if (c.type === 'group') return c.name || 'Grupo'
  const other = c.participants[0]
  if (!other) return 'Conversación'
  return `${other.first_name || ''} ${other.last_name || ''}`.trim() || other.email
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

function roleLabel(role: string, employeeType: string | null): string {
  if (role === 'admin') return 'Admin'
  if (employeeType === 'paralegal') return 'Paralegal'
  if (employeeType === 'senior_consultant') return 'Consultora Senior'
  if (employeeType === 'contracts_manager') return 'Contratos · Logística'
  return 'Empleado'
}

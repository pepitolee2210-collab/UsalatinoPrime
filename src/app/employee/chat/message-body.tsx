'use client'

import Link from 'next/link'
import type { ChatMention } from './types'

interface Props {
  body: string
  mentions: ChatMention[]
  isMe: boolean
}

/**
 * Renderiza el body de un mensaje resaltando las mentions como links.
 * Las mentions vienen como [{type:'client'|'case', id, label}] y en el body
 * aparecen como "@Label" o "#Label". Hace match exacto sobre label.
 */
export function MessageBody({ body, mentions, isMe }: Props) {
  if (!body) return null
  if (!mentions || mentions.length === 0) {
    return (
      <p className="text-sm whitespace-pre-wrap break-words leading-snug">
        {body}
      </p>
    )
  }

  // Construyo regex para todas las mentions, manejo caracteres especiales
  const tokens = mentions.map((m) => {
    const prefix = m.type === 'client' ? '@' : '#'
    return { ...m, full: `${prefix}${m.label}` }
  })

  // Split el body preservando los tokens
  // Recorrido lineal para máximo control
  const parts: Array<{ type: 'text' | 'mention'; value: string; mention?: ChatMention }> = []
  let cursor = 0
  while (cursor < body.length) {
    // Buscar el match más cercano de cualquier token desde cursor
    let bestIdx = -1
    let bestToken: typeof tokens[0] | null = null
    for (const t of tokens) {
      const i = body.indexOf(t.full, cursor)
      if (i !== -1 && (bestIdx === -1 || i < bestIdx)) {
        bestIdx = i
        bestToken = t
      }
    }
    if (bestIdx === -1 || !bestToken) {
      parts.push({ type: 'text', value: body.slice(cursor) })
      break
    }
    if (bestIdx > cursor) {
      parts.push({ type: 'text', value: body.slice(cursor, bestIdx) })
    }
    parts.push({
      type: 'mention',
      value: bestToken.full,
      mention: { type: bestToken.type, id: bestToken.id, label: bestToken.label },
    })
    cursor = bestIdx + bestToken.full.length
  }

  return (
    <p className="text-sm whitespace-pre-wrap break-words leading-snug">
      {parts.map((p, i) => {
        if (p.type === 'text') return <span key={i}>{p.value}</span>
        const m = p.mention!
        const href =
          m.type === 'client'
            ? `/employee/clientes/${m.id}`
            : `/employee/casos`
        const cls = isMe
          ? 'font-semibold underline decoration-white/60 hover:decoration-white'
          : m.type === 'client'
            ? 'font-semibold text-blue-700 hover:underline'
            : 'font-semibold text-emerald-700 hover:underline'
        return (
          <Link key={i} href={href} className={cls}>
            {p.value}
          </Link>
        )
      })}
    </p>
  )
}

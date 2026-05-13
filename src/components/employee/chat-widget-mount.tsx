'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatWidget } from './chat-widget'

/**
 * Wrapper que monta el ChatWidget tras resolver el userId actual.
 * Pensado para ser usado en distintos layouts (employee, admin, ceo).
 * Si el usuario no es staff (admin/employee), el widget no aparece —
 * /api/chat/conversations devuelve 403 y la lista queda vacía.
 */
export function ChatWidgetAutoMount() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted && user) setUserId(user.id)
    })
    return () => {
      mounted = false
    }
  }, [])

  if (!userId) return null
  return <ChatWidget currentUserId={userId} />
}

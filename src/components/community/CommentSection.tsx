'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { MessageCircle, Send } from 'lucide-react'
import { toast } from 'sonner'

interface Comment {
  id: string
  content: string
  created_at: string
  user: { first_name: string; last_name: string }
}

interface CommentSectionProps {
  postId: string
  userId: string
  comments: Comment[]
  isActive: boolean
}

export function CommentSection({ postId, userId, comments: initialComments, isActive }: CommentSectionProps) {
  const [comments, setComments] = useState(initialComments)
  const [newComment, setNewComment] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [sending, setSending] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || !isActive) return

    setSending(true)

    const { data, error } = await supabase
      .from('community_comments')
      .insert({ post_id: postId, user_id: userId, content: newComment.trim() })
      .select('id, content, created_at')
      .single()

    if (error) {
      toast.error('Error al enviar comentario')
      setSending(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .single()

    setComments(prev => [...prev, {
      ...data,
      user: profile || { first_name: 'Tú', last_name: '' },
    }])
    setNewComment('')
    setSending(false)
    setExpanded(true)
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `hace ${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs}h`
    const days = Math.floor(hrs / 24)
    return `hace ${days}d`
  }

  return (
    <div className="mt-3 pt-3 border-t">
      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2"
      >
        <MessageCircle className="w-4 h-4" />
        <span>{comments.length} comentario{comments.length !== 1 ? 's' : ''}</span>
      </button>

      {expanded && (
        <>
          {/* Comments list */}
          <div className="space-y-3 mb-3 max-h-64 overflow-y-auto">
            {comments.map(c => (
              <div key={c.id} className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-[#002855]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#002855]">
                    {c.user.first_name[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {c.user.first_name} {c.user.last_name}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 break-words">{c.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">
                Sé el primero en comentar
              </p>
            )}
          </div>

          {/* New comment form */}
          {isActive && (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escriba un comentario..."
                className="flex-1 min-w-0 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F2A900]/40"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newComment.trim() || sending}
                className="bg-[#002855] hover:bg-[#001a3a] flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  )
}

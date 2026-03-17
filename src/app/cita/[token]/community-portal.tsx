'use client'

import { useState } from 'react'
import { Video, ExternalLink } from 'lucide-react'

interface CommunityPost {
  id: string
  type: string
  title: string | null
  content: string | null
  video_url: string | null
  zoom_url: string | null
  pinned: boolean
  created_at: string
}

interface CommunityReaction {
  post_id: string
  user_id: string
  emoji: string
}

interface CommunityPortalProps {
  token: string
  clientId: string
  posts: CommunityPost[]
  reactions: CommunityReaction[]
}

const REACTION_EMOJIS = ['👍', '❤️', '🙌']

export function CommunityPortal({ token, clientId, posts, reactions }: CommunityPortalProps) {
  const [localReactions, setLocalReactions] = useState<CommunityReaction[]>(reactions)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  const zoomPost = posts.find(p => p.type === 'zoom')
  const feedPosts = posts.filter(p => p.type !== 'zoom')

  function getReactionCounts(postId: string) {
    const counts: Record<string, number> = {}
    localReactions
      .filter(r => r.post_id === postId)
      .forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1 })
    return counts
  }

  function hasReacted(postId: string, emoji: string) {
    return localReactions.some(r => r.post_id === postId && r.user_id === clientId && r.emoji === emoji)
  }

  async function toggleReaction(postId: string, emoji: string) {
    const key = `${postId}-${emoji}`
    if (loadingKey === key) return
    setLoadingKey(key)

    const reacted = hasReacted(postId, emoji)

    // Optimistic update
    if (reacted) {
      setLocalReactions(prev =>
        prev.filter(r => !(r.post_id === postId && r.user_id === clientId && r.emoji === emoji))
      )
    } else {
      setLocalReactions(prev => [...prev, { post_id: postId, user_id: clientId, emoji }])
    }

    try {
      const res = await fetch('/api/community/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, post_id: postId, emoji }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setLocalReactions(reactions)
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Zoom card */}
      {zoomPost?.zoom_url && (
        <div className="bg-gradient-to-r from-[#002855] to-[#003d7a] rounded-xl p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Video className="w-4 h-4 text-[#F2A900]" />
                <span className="text-[11px] font-semibold text-[#F2A900] uppercase tracking-wider">Sesión en Vivo</span>
              </div>
              <p className="font-bold text-base">{zoomPost.title || 'Sesión con Henry'}</p>
              {zoomPost.content && (
                <p className="text-white/70 text-sm mt-0.5">{zoomPost.content}</p>
              )}
            </div>
            <a
              href={zoomPost.zoom_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-[#F2A900] hover:bg-[#D4940A] text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Unirse
            </a>
          </div>
        </div>
      )}

      {/* Feed */}
      {feedPosts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 font-medium">No hay publicaciones aún</p>
          <p className="text-sm text-gray-400 mt-1">Henry publicará actualizaciones aquí pronto.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedPosts.map(post => {
            const counts = getReactionCounts(post.id)
            return (
              <div
                key={post.id}
                className={`rounded-xl border p-4 ${
                  post.pinned ? 'border-[#F2A900]/40 bg-[#F2A900]/5' : 'border-gray-100 bg-gray-50/50'
                }`}
              >
                {post.pinned && (
                  <p className="text-[10px] font-semibold text-[#F2A900] uppercase tracking-wider mb-2">📌 Fijado</p>
                )}
                {post.type === 'announcement' && !post.pinned && (
                  <p className="text-[10px] font-semibold text-[#002855] uppercase tracking-wider mb-1.5">📢 Anuncio</p>
                )}
                {post.title && (
                  <p className="font-semibold text-gray-900 mb-1">{post.title}</p>
                )}
                {post.content && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                )}
                {post.video_url && (
                  <a
                    href={post.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mt-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver video
                  </a>
                )}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  {REACTION_EMOJIS.map(emoji => {
                    const count = counts[emoji] || 0
                    const active = hasReacted(post.id, emoji)
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(post.id, emoji)}
                        disabled={loadingKey === `${post.id}-${emoji}`}
                        className={`flex items-center gap-1 text-sm px-2.5 py-1 rounded-full transition-all active:scale-90 ${
                          active
                            ? 'bg-[#F2A900]/20 text-[#D4940A] ring-1 ring-[#F2A900]/50'
                            : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <span>{emoji}</span>
                        {count > 0 && <span className="text-xs font-semibold">{count}</span>}
                      </button>
                    )
                  })}
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(post.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

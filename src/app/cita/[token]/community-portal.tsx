'use client'

import { useState } from 'react'
import { ExternalLink, Play } from 'lucide-react'

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

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000)
  if (diffH < 1) return 'Hace un momento'
  if (diffH < 24) return `Hace ${diffH}h`
  return d.toLocaleDateString('es-US', { day: 'numeric', month: 'short' })
}

export function CommunityPortal({ token, clientId, posts, reactions }: CommunityPortalProps) {
  const [localReactions, setLocalReactions] = useState<CommunityReaction[]>(reactions)
  const [bouncingKey, setBouncingKey] = useState<string | null>(null)
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
    if (reacted) {
      setLocalReactions(prev =>
        prev.filter(r => !(r.post_id === postId && r.user_id === clientId && r.emoji === emoji))
      )
    } else {
      setLocalReactions(prev => [...prev, { post_id: postId, user_id: clientId, emoji }])
      setBouncingKey(key)
      setTimeout(() => setBouncingKey(null), 400)
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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

        .community-wrap { font-family: 'DM Sans', sans-serif; }

        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes reaction-bounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.35); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes post-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .live-dot { animation: live-pulse 1.8s ease-in-out infinite; }

        .zoom-shimmer {
          background: linear-gradient(
            105deg,
            transparent 40%,
            rgba(242,169,0,0.12) 50%,
            transparent 60%
          );
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }

        .reaction-bounce { animation: reaction-bounce 0.4s cubic-bezier(0.36,0.07,0.19,0.97); }

        .post-card { animation: post-in 0.35s ease both; }
        .post-card:nth-child(1) { animation-delay: 0ms; }
        .post-card:nth-child(2) { animation-delay: 60ms; }
        .post-card:nth-child(3) { animation-delay: 120ms; }
        .post-card:nth-child(4) { animation-delay: 180ms; }
        .post-card:nth-child(n+5) { animation-delay: 240ms; }
      `}</style>

      <div className="community-wrap -mx-2 sm:mx-0 space-y-4">

        {/* ── Zoom session card ── */}
        {zoomPost?.zoom_url && (
          <div className="relative overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, #001d3d 0%, #002855 50%, #003d7a 100%)' }}>
            {/* shimmer overlay */}
            <div className="absolute inset-0 zoom-shimmer pointer-events-none" />

            {/* decorative circle */}
            <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full opacity-10"
              style={{ background: 'radial-gradient(circle, #F2A900 0%, transparent 70%)' }} />

            <div className="relative px-5 py-5">
              {/* Live badge */}
              <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 mb-3">
                <span className="live-dot w-2 h-2 rounded-full bg-[#F2A900] shrink-0" />
                <span className="text-[11px] font-semibold text-[#F2A900] tracking-widest uppercase">Sesiones en Vivo</span>
              </div>

              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white font-bold text-lg leading-tight truncate">
                    {zoomPost.title || 'Sesión con Henry'}
                  </p>
                  {zoomPost.content && (
                    <p className="text-white/60 text-sm mt-1 leading-snug">{zoomPost.content}</p>
                  )}
                </div>
                <a
                  href={zoomPost.zoom_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 group flex items-center gap-2 font-bold text-sm px-4 py-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #F2A900, #D4940A)', color: '#001d3d' }}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Unirse
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── Feed header ── */}
        {feedPosts.length > 0 && (
          <div className="flex items-center gap-3 px-1">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Publicaciones</span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>
        )}

        {/* ── Posts feed ── */}
        {feedPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #001d3d, #002855)' }}>
              <span className="text-2xl">✦</span>
            </div>
            <p className="font-semibold text-gray-700">Sin publicaciones aún</p>
            <p className="text-sm text-gray-400 text-center max-w-[220px]">
              Henry compartirá actualizaciones y recursos aquí pronto.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedPosts.map((post, idx) => {
              const counts = getReactionCounts(post.id)
              const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0)

              return (
                <div
                  key={post.id}
                  className="post-card bg-white rounded-2xl overflow-hidden"
                  style={{
                    boxShadow: post.pinned
                      ? '0 0 0 1.5px rgba(242,169,0,0.4), 0 4px 16px rgba(0,40,85,0.08)'
                      : '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
                    animationDelay: `${idx * 60}ms`,
                  }}
                >
                  {/* Pinned stripe */}
                  {post.pinned && (
                    <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #F2A900, #D4940A)' }} />
                  )}

                  <div className="p-4">
                    {/* Post header */}
                    <div className="flex items-center gap-3 mb-3">
                      {/* Henry avatar */}
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
                        style={{
                          background: 'linear-gradient(135deg, #002855, #003d7a)',
                          color: '#F2A900',
                          letterSpacing: '0.05em',
                        }}>
                        H
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 leading-none">Henry Orellana</p>
                          {post.type === 'announcement' && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                              style={{ background: '#002855', color: '#F2A900' }}>
                              Anuncio
                            </span>
                          )}
                          {post.pinned && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#F2A900]/15 text-[#B8780A]">
                              Fijado
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(post.created_at)}</p>
                      </div>
                    </div>

                    {/* Content */}
                    {post.title && (
                      <p className="font-semibold text-gray-900 text-sm mb-1.5 leading-snug">{post.title}</p>
                    )}
                    {post.content && (
                      <p className="text-[13.5px] text-gray-600 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                    )}

                    {/* Video link */}
                    {post.video_url && (
                      <a
                        href={post.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex items-center gap-2.5 p-3 rounded-xl transition-colors"
                        style={{ background: 'linear-gradient(135deg, #001d3d08, #002855/10)' }}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: 'linear-gradient(135deg, #002855, #003d7a)' }}>
                          <Play className="w-3.5 h-3.5 fill-[#F2A900] text-[#F2A900]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800">Ver video</p>
                          <p className="text-[11px] text-gray-400 truncate">{post.video_url}</p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      </a>
                    )}

                    {/* Reactions */}
                    <div className="flex items-center gap-2 mt-3.5">
                      <div className="flex items-center gap-1.5">
                        {REACTION_EMOJIS.map(emoji => {
                          const count = counts[emoji] || 0
                          const active = hasReacted(post.id, emoji)
                          const key = `${post.id}-${emoji}`
                          return (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(post.id, emoji)}
                              disabled={loadingKey === key}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all duration-150 select-none ${
                                bouncingKey === key ? 'reaction-bounce' : ''
                              }`}
                              style={active ? {
                                background: 'linear-gradient(135deg, rgba(242,169,0,0.18), rgba(242,169,0,0.1))',
                                boxShadow: '0 0 0 1.5px rgba(242,169,0,0.45)',
                                color: '#B8780A',
                              } : {
                                background: '#f5f5f7',
                                color: '#666',
                              }}
                            >
                              <span style={{ fontSize: '14px', lineHeight: 1 }}>{emoji}</span>
                              {count > 0 && (
                                <span className="text-[11px] font-bold">{count}</span>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {totalReactions > 0 && (
                        <p className="text-[11px] text-gray-400 ml-auto">
                          {totalReactions} {totalReactions === 1 ? 'reacción' : 'reacciones'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

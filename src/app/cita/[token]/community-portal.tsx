'use client'

import { useState } from 'react'
import { ExternalLink, Play, Megaphone, FileText, Pin } from 'lucide-react'

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

function getYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&\s]+)/,
    /youtu\.be\/([^?\s]+)/,
    /youtube\.com\/embed\/([^?\s]+)/,
    /youtube\.com\/shorts\/([^?\s]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function getYouTubeThumbnail(url: string): string | null {
  const id = getYouTubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000)
  if (diffH < 1) return 'Hace un momento'
  if (diffH < 24) return `Hace ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `Hace ${diffD}d`
  return d.toLocaleDateString('es-US', { day: 'numeric', month: 'short' })
}

export function CommunityPortal({ token, clientId, posts, reactions }: CommunityPortalProps) {
  const [localReactions, setLocalReactions] = useState<CommunityReaction[]>(reactions)
  const [bouncingKey, setBouncingKey] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  const zoomPost = posts.find(p => p.type === 'zoom')
  const videoPosts = posts.filter(p => p.type === 'video' && p.video_url)
  const textPosts = posts.filter(p => p.type !== 'zoom' && p.type !== 'video')

  // Pinned first within text feed
  const sortedTextPosts = [
    ...textPosts.filter(p => p.pinned),
    ...textPosts.filter(p => !p.pinned),
  ]

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

  const hasContent = zoomPost || videoPosts.length > 0 || sortedTextPosts.length > 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .cp-root { font-family: 'DM Sans', sans-serif; }

        @keyframes live-pulse {
          0%,100% { opacity:1; box-shadow: 0 0 0 0 rgba(242,169,0,0.7); }
          50% { opacity:.5; box-shadow: 0 0 0 5px rgba(242,169,0,0); }
        }
        @keyframes shimmer-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes reaction-pop {
          0%  { transform: scale(1); }
          40% { transform: scale(1.4); }
          70% { transform: scale(0.88); }
          100%{ transform: scale(1); }
        }
        @keyframes fade-up {
          from { opacity:0; transform: translateY(12px); }
          to   { opacity:1; transform: translateY(0); }
        }

        .live-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #F2A900;
          animation: live-pulse 2s ease-in-out infinite;
        }
        .zoom-shimmer::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%);
          animation: shimmer-sweep 3.5s linear infinite;
          pointer-events: none;
        }
        .reaction-pop { animation: reaction-pop 0.38s cubic-bezier(.36,.07,.19,.97) both; }
        .video-thumb { position: relative; overflow: hidden; }
        .video-thumb img { transition: transform 0.3s ease; }
        .video-thumb:hover img { transform: scale(1.04); }
        .play-overlay {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.25);
          transition: background 0.2s ease;
        }
        .video-thumb:hover .play-overlay { background: rgba(0,0,0,0.38); }
        .play-btn {
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(242,169,0,0.92);
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(4px);
          transition: transform 0.2s ease;
        }
        .video-thumb:hover .play-btn { transform: scale(1.1); }
        .post-card { animation: fade-up .3s ease both; }
      `}</style>

      <div className="cp-root space-y-6">

        {/* ─── Empty state ─── */}
        {!hasContent && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #001d3d, #002855)' }}>
              <span className="text-3xl">✦</span>
            </div>
            <p className="font-semibold text-gray-700">La comunidad está por comenzar</p>
            <p className="text-sm text-gray-400 max-w-[220px]">
              Henry pronto compartirá sesiones, videos y anuncios aquí.
            </p>
          </div>
        )}

        {/* ─── ZOOM CARD ─── */}
        {zoomPost?.zoom_url && (
          <div
            className="relative overflow-hidden rounded-2xl zoom-shimmer"
            style={{ background: 'linear-gradient(135deg, #001428 0%, #002255 55%, #003580 100%)' }}
          >
            {/* Gold glow blob */}
            <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(242,169,0,0.18) 0%, transparent 70%)' }} />

            <div className="relative p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="live-dot shrink-0" />
                <span className="text-[10px] font-bold text-[#F2A900] tracking-[0.18em] uppercase">
                  Sesiones en Vivo
                </span>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white font-bold text-xl leading-tight">
                    {zoomPost.title || 'Sesión con Henry'}
                  </p>
                  {zoomPost.content && (
                    <p className="text-white/55 text-sm mt-1 leading-snug">{zoomPost.content}</p>
                  )}
                </div>
                <a
                  href={zoomPost.zoom_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1.5 font-bold text-sm px-4 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #F2A900, #D4940A)', color: '#001428' }}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Unirse
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ─── VIDEOS GRABADOS ─── */}
        {videoPosts.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #002855, #003d7a)' }}>
                <Play className="w-3 h-3 fill-[#F2A900] text-[#F2A900]" />
              </div>
              <h3 className="font-bold text-sm text-gray-900 tracking-tight">Videos Grabados</h3>
              <span className="text-xs text-gray-400 font-medium">
                {videoPosts.length} {videoPosts.length === 1 ? 'video' : 'videos'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {videoPosts.map((post, idx) => {
                const thumb = post.video_url ? getYouTubeThumbnail(post.video_url) : null
                const counts = getReactionCounts(post.id)
                const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0)

                return (
                  <div
                    key={post.id}
                    className="bg-white rounded-xl overflow-hidden post-card"
                    style={{
                      boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)',
                      animationDelay: `${idx * 60}ms`,
                    }}
                  >
                    {/* Thumbnail */}
                    <a
                      href={post.video_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="video-thumb block aspect-video bg-gray-900"
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={post.title || 'Video'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg, #001428, #002855)' }}>
                          <Play className="w-8 h-8 text-[#F2A900]" />
                        </div>
                      )}
                      <div className="play-overlay">
                        <div className="play-btn">
                          <Play className="w-4 h-4 fill-[#001428] text-[#001428] ml-0.5" />
                        </div>
                      </div>
                    </a>

                    {/* Info */}
                    <div className="p-2.5">
                      {post.title && (
                        <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2 mb-1">
                          {post.title}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-gray-400">{formatDate(post.created_at)}</span>
                        {totalReactions > 0 && (
                          <span className="text-[10px] text-gray-400">{totalReactions} ✦</span>
                        )}
                      </div>

                      {/* Compact reactions */}
                      <div className="flex gap-1 mt-2">
                        {REACTION_EMOJIS.map(emoji => {
                          const count = counts[emoji] || 0
                          const active = hasReacted(post.id, emoji)
                          const key = `${post.id}-${emoji}`
                          return (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(post.id, emoji)}
                              disabled={loadingKey === key}
                              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-all select-none ${
                                bouncingKey === key ? 'reaction-pop' : ''
                              }`}
                              style={active ? {
                                background: 'rgba(242,169,0,0.15)',
                                boxShadow: '0 0 0 1px rgba(242,169,0,0.4)',
                              } : { background: '#f1f1f3' }}
                            >
                              <span style={{ fontSize: '11px' }}>{emoji}</span>
                              {count > 0 && <span className="font-bold text-gray-600">{count}</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ─── PUBLICACIONES ─── */}
        {sortedTextPosts.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #002855, #003d7a)' }}>
                <Megaphone className="w-3 h-3 text-[#F2A900]" />
              </div>
              <h3 className="font-bold text-sm text-gray-900 tracking-tight">Publicaciones</h3>
            </div>

            <div className="space-y-3">
              {sortedTextPosts.map((post, idx) => {
                const counts = getReactionCounts(post.id)
                const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0)

                return (
                  <div
                    key={post.id}
                    className="bg-white rounded-2xl overflow-hidden post-card"
                    style={{
                      boxShadow: post.pinned
                        ? '0 0 0 1.5px rgba(242,169,0,0.35), 0 4px 16px rgba(0,40,85,0.08)'
                        : '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
                      animationDelay: `${idx * 60}ms`,
                    }}
                  >
                    {/* Pinned stripe */}
                    {post.pinned && (
                      <div className="h-[3px]"
                        style={{ background: 'linear-gradient(90deg, #F2A900, #ffcd55, #F2A900)' }} />
                    )}

                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
                          style={{ background: 'linear-gradient(135deg, #002855, #003d7a)', color: '#F2A900' }}
                        >
                          H
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-gray-900">Henry Orellana</span>
                            {post.pinned && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#F2A900]/15 text-[#B8780A]">
                                <Pin className="w-2.5 h-2.5" />Fijado
                              </span>
                            )}
                            {post.type === 'announcement' && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                                style={{ background: '#002855', color: '#F2A900' }}>
                                Anuncio
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(post.created_at)}</p>
                        </div>
                      </div>

                      {/* Content */}
                      {post.title && (
                        <p className="font-semibold text-gray-900 text-[13.5px] mb-1.5 leading-snug">
                          {post.title}
                        </p>
                      )}
                      {post.content && (
                        <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                          {post.content}
                        </p>
                      )}

                      {/* Divider + reactions */}
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
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
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all select-none ${
                                  bouncingKey === key ? 'reaction-pop' : ''
                                }`}
                                style={active ? {
                                  background: 'linear-gradient(135deg, rgba(242,169,0,0.2), rgba(242,169,0,0.1))',
                                  boxShadow: '0 0 0 1.5px rgba(242,169,0,0.45)',
                                  color: '#9a6500',
                                } : { background: '#f1f1f3', color: '#777' }}
                              >
                                <span style={{ fontSize: '14px', lineHeight: 1 }}>{emoji}</span>
                                {count > 0 && <span className="text-[11px] font-bold">{count}</span>}
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
          </section>
        )}
      </div>
    </>
  )
}

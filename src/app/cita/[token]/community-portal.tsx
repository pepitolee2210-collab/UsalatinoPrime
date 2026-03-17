'use client'

import { useState } from 'react'
import { Play, ExternalLink, Megaphone, Pin } from 'lucide-react'

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

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000)
  if (diffH < 1) return 'Hace un momento'
  if (diffH < 24) return `Hace ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `Hace ${diffD}d`
  return d.toLocaleDateString('es-US', { day: 'numeric', month: 'long' })
}

// ── Sub-components ────────────────────────────────────────────────

function SectionDivider({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 my-8">
      <div className="flex-1 h-px bg-gray-200" />
      <div className="flex items-center gap-2 shrink-0 border border-gray-200 rounded-full px-4 py-1.5 bg-white shadow-sm">
        <span className="text-gray-500">{icon}</span>
        <span className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">{label}</span>
        {count !== undefined && (
          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">{count}</span>
        )}
      </div>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

function VideoCard({
  post,
  counts,
  myReactions,
  onReact,
  bouncingKey,
}: {
  post: CommunityPost
  counts: Record<string, number>
  myReactions: string[]
  onReact: (postId: string, emoji: string) => void
  bouncingKey: string | null
}) {
  const [thumbFailed, setThumbFailed] = useState(false)
  const ytId = post.video_url ? getYouTubeId(post.video_url) : null
  const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null

  return (
    <a
      href={post.video_url!}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl overflow-hidden border border-gray-100 hover:border-[#F2A900]/40 hover:shadow-lg transition-all duration-300"
      style={{ background: '#fff' }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-[#001428]">
        {thumb && !thumbFailed ? (
          <img
            src={thumb}
            alt={post.title || 'Video'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-3"
            style={{ background: 'linear-gradient(135deg, #001428 0%, #002855 100%)' }}
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(242,169,0,0.15)' }}>
              <Play className="w-6 h-6 text-[#F2A900]" />
            </div>
            {post.title && (
              <p className="text-white/60 text-xs text-center px-6 line-clamp-2">{post.title}</p>
            )}
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl" style={{ background: '#F2A900' }}>
            <Play className="w-6 h-6 fill-[#001428] text-[#001428] ml-0.5" />
          </div>
        </div>
        {/* Duration badge placeholder */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
          YouTube
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        {post.title && (
          <p className="font-semibold text-gray-900 text-sm leading-snug mb-1 line-clamp-2">
            {post.title}
          </p>
        )}
        {post.content && (
          <p className="text-xs text-gray-400 line-clamp-1 mb-3">{post.content}</p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-[11px] text-gray-400">{formatDate(post.created_at)}</span>
          <div className="flex gap-1">
            {REACTION_EMOJIS.map(emoji => {
              const count = counts[emoji] || 0
              const active = myReactions.includes(emoji)
              const bKey = `${post.id}-${emoji}`
              return (
                <button
                  key={emoji}
                  onClick={e => { e.preventDefault(); onReact(post.id, emoji) }}
                  className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-xs transition-all select-none ${
                    bouncingKey === bKey ? 'cp-bounce' : ''
                  }`}
                  style={active
                    ? { background: 'rgba(242,169,0,0.18)', boxShadow: '0 0 0 1px rgba(242,169,0,0.4)' }
                    : { background: '#f3f4f6' }
                  }
                >
                  <span style={{ fontSize: '12px' }}>{emoji}</span>
                  {count > 0 && <span className="font-bold text-gray-600 ml-0.5">{count}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </a>
  )
}

function PostCard({
  post,
  counts,
  myReactions,
  onReact,
  bouncingKey,
  isLast,
}: {
  post: CommunityPost
  counts: Record<string, number>
  myReactions: string[]
  onReact: (postId: string, emoji: string) => void
  bouncingKey: string | null
  isLast: boolean
}) {
  const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className={`py-6 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      {/* Author header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #001d3d, #002855)', color: '#F2A900' }}
        >
          H
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">Henry Orellana</span>
            {post.pinned && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(242,169,0,0.15)', color: '#9a6500' }}>
                <Pin className="w-2.5 h-2.5" /> Fijado
              </span>
            )}
            {post.type === 'announcement' && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: '#002855', color: '#F2A900' }}>
                Anuncio
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(post.created_at)}</p>
        </div>
      </div>

      {/* Content */}
      {post.title && (
        <h4 className="font-bold text-gray-900 text-base leading-snug mb-2">{post.title}</h4>
      )}
      {post.content && (
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{post.content}</p>
      )}

      {/* Reactions */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          {REACTION_EMOJIS.map(emoji => {
            const count = counts[emoji] || 0
            const active = myReactions.includes(emoji)
            const bKey = `${post.id}-${emoji}`
            return (
              <button
                key={emoji}
                onClick={() => onReact(post.id, emoji)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-all select-none ${
                  bouncingKey === bKey ? 'cp-bounce' : ''
                }`}
                style={active
                  ? { background: 'rgba(242,169,0,0.18)', boxShadow: '0 0 0 1.5px rgba(242,169,0,0.4)', color: '#9a6500' }
                  : { background: '#f3f4f6', color: '#6b7280' }
                }
              >
                <span style={{ fontSize: '15px', lineHeight: 1 }}>{emoji}</span>
                {count > 0 && <span className="text-xs font-bold">{count}</span>}
              </button>
            )
          })}
        </div>
        {totalReactions > 0 && (
          <p className="text-xs text-gray-400 ml-auto">
            {totalReactions} {totalReactions === 1 ? 'reacción' : 'reacciones'}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────

export function CommunityPortal({ token, clientId, posts, reactions }: CommunityPortalProps) {
  const [localReactions, setLocalReactions] = useState<CommunityReaction[]>(reactions)
  const [bouncingKey, setBouncingKey] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  const zoomPost = posts.find(p => p.type === 'zoom')
  const videoPosts = posts.filter(p => p.type === 'video' && p.video_url)
  const textPosts = [
    ...posts.filter(p => p.type !== 'zoom' && p.type !== 'video' && p.pinned),
    ...posts.filter(p => p.type !== 'zoom' && p.type !== 'video' && !p.pinned),
  ]

  function getCounts(postId: string) {
    const counts: Record<string, number> = {}
    localReactions.filter(r => r.post_id === postId).forEach(r => {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1
    })
    return counts
  }

  function getMyReactions(postId: string) {
    return localReactions
      .filter(r => r.post_id === postId && r.user_id === clientId)
      .map(r => r.emoji)
  }

  async function toggleReaction(postId: string, emoji: string) {
    const key = `${postId}-${emoji}`
    if (loadingKey === key) return
    setLoadingKey(key)

    const alreadyReacted = localReactions.some(
      r => r.post_id === postId && r.user_id === clientId && r.emoji === emoji
    )

    if (alreadyReacted) {
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

  const isEmpty = !zoomPost && videoPosts.length === 0 && textPosts.length === 0

  return (
    <>
      <style>{`
        @keyframes cp-bounce {
          0%  { transform: scale(1); }
          35% { transform: scale(1.45); }
          65% { transform: scale(0.88); }
          100%{ transform: scale(1); }
        }
        .cp-bounce { animation: cp-bounce 0.38s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes cp-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .zoom-shimmer::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
          animation: cp-shimmer 4s linear infinite;
          pointer-events: none;
        }
      `}</style>

      {/* ── Empty state ── */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #001428, #002855)' }}>
            <Megaphone className="w-7 h-7 text-[#F2A900]" />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-base">Comunidad próximamente</p>
            <p className="text-sm text-gray-400 mt-1 max-w-[240px]">
              Henry publicará sesiones, videos y actualizaciones aquí muy pronto.
            </p>
          </div>
        </div>
      )}

      {/* ── ZOOM ── */}
      {zoomPost?.zoom_url && (
        <div
          className="relative overflow-hidden rounded-2xl zoom-shimmer"
          style={{ background: 'linear-gradient(135deg, #000f1f 0%, #001f40 55%, #002d60 100%)' }}
        >
          {/* Gold glow */}
          <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(242,169,0,0.12) 0%, transparent 70%)' }} />
          <div className="absolute -left-8 -top-8 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(242,169,0,0.06) 0%, transparent 70%)' }} />

          <div className="relative p-6 sm:p-8">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#F2A900] shrink-0"
                style={{ boxShadow: '0 0 0 0 rgba(242,169,0,0.7)', animation: 'cp-pulse 2s ease-in-out infinite' }} />
              <span className="text-[10px] font-black text-[#F2A900] tracking-[0.2em] uppercase">Sesiones con Henry</span>
            </div>

            <div className="flex items-end justify-between gap-6">
              <div className="min-w-0">
                <p className="text-white font-bold text-xl sm:text-2xl leading-tight mb-1">
                  {zoomPost.title || 'Sesión en Vivo con Henry'}
                </p>
                {zoomPost.content && (
                  <p className="text-white/50 text-sm">{zoomPost.content}</p>
                )}
              </div>
              <a
                href={zoomPost.zoom_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-2 font-bold text-sm px-5 py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #F2A900, #ffca28)', color: '#001428' }}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Unirse
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── VIDEOS ── */}
      {videoPosts.length > 0 && (
        <div>
          <SectionDivider
            icon={<Play className="w-3.5 h-3.5" />}
            label="Videos Grabados"
            count={videoPosts.length}
          />
          <div className={`grid gap-4 ${videoPosts.length === 1 ? 'grid-cols-1 max-w-sm' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {videoPosts.map(post => (
              <VideoCard
                key={post.id}
                post={post}
                counts={getCounts(post.id)}
                myReactions={getMyReactions(post.id)}
                onReact={toggleReaction}
                bouncingKey={bouncingKey}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── PUBLICACIONES ── */}
      {textPosts.length > 0 && (
        <div>
          <SectionDivider
            icon={<Megaphone className="w-3.5 h-3.5" />}
            label="Publicaciones"
          />
          <div>
            {textPosts.map((post, i) => (
              <PostCard
                key={post.id}
                post={post}
                counts={getCounts(post.id)}
                myReactions={getMyReactions(post.id)}
                onReact={toggleReaction}
                bouncingKey={bouncingKey}
                isLast={i === textPosts.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

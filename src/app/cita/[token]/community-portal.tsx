'use client'

import { useState } from 'react'
import { Play, Megaphone, Video, Pin, ExternalLink, Calendar } from 'lucide-react'

interface SchedulingDay {
  day_of_week: number
  start_hour: number
  end_hour: number
}

interface CommunityPost {
  id: string; type: string; title: string | null; content: string | null
  video_url: string | null; zoom_url: string | null; pinned: boolean; created_at: string
}

interface CommunityReaction {
  post_id: string; user_id: string; emoji: string
}

interface Props {
  token: string
  clientId: string
  posts: CommunityPost[]
  reactions: CommunityReaction[]
  schedulingDays: SchedulingDay[]
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const EMOJIS = ['👍', '❤️', '🙌']

function fmt12(h: number) {
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}${ampm}`
}

function getYTId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&?\s]+)/)
  return m ? m[1] : null
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3.6e6)
  if (h < 1) return 'Hace un momento'
  if (h < 24) return `Hace ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `Hace ${d}d`
  return new Date(iso).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })
}

// ── Module wrapper ────────────────────────────────────────────────
function Module({ icon, title, subtitle, dark, children }: {
  icon: React.ReactNode; title: string; subtitle?: string
  dark?: boolean; children: React.ReactNode
}) {
  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-5"
        style={dark
          ? { background: 'linear-gradient(135deg, #000f1f 0%, #001d3d 100%)' }
          : { background: '#fff', borderBottom: '1.5px solid #f0f1f3' }
        }
      >
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={dark
            ? { background: 'rgba(242,169,0,0.18)' }
            : { background: 'linear-gradient(135deg, #001d3d, #002855)' }
          }
        >
          <span style={{ color: '#F2A900' }}>{icon}</span>
        </div>
        <div>
          <p className="font-bold text-[15px] leading-tight" style={{ color: dark ? '#fff' : '#111827' }}>{title}</p>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: dark ? 'rgba(255,255,255,0.4)' : '#9ca3af' }}>{subtitle}</p>}
        </div>
      </div>

      {/* Body */}
      <div style={{ background: '#fff' }}>{children}</div>
    </div>
  )
}

// ── ReactionRow ───────────────────────────────────────────────────
function ReactionRow({ postId, rxCounts, myRx, bouncing, onReact, small }: {
  postId: string; rxCounts: Record<string, number>; myRx: string[]
  bouncing: string | null; onReact: (pid: string, emoji: string) => void; small?: boolean
}) {
  const total = Object.values(rxCounts).reduce((a, b) => a + b, 0)
  return (
    <div className="flex items-center gap-1.5">
      {EMOJIS.map(emoji => {
        const cnt = rxCounts[emoji] || 0
        const active = myRx.includes(emoji)
        const k = `${postId}-${emoji}`
        return (
          <button
            key={emoji}
            onClick={e => { e.preventDefault(); onReact(postId, emoji) }}
            className={bouncing === k ? 'rx-pop' : ''}
            style={{
              display: 'flex', alignItems: 'center', gap: small ? '2px' : '4px',
              padding: small ? '3px 8px' : '5px 11px',
              borderRadius: '999px', cursor: 'pointer', transition: 'all .15s',
              fontSize: small ? '11px' : '13px', fontWeight: 700,
              background: active ? 'rgba(242,169,0,0.15)' : '#f5f6f8',
              boxShadow: active ? '0 0 0 1.5px rgba(242,169,0,0.5)' : 'none',
              color: active ? '#9a6500' : '#6b7280',
            }}
          >
            <span style={{ fontSize: small ? '12px' : '14px', lineHeight: 1 }}>{emoji}</span>
            {cnt > 0 && <span>{cnt}</span>}
          </button>
        )
      })}
      {!small && total > 0 && (
        <span className="text-xs text-gray-400 ml-auto">{total} {total === 1 ? 'reacción' : 'reacciones'}</span>
      )}
    </div>
  )
}

// ── Video Card (fixed width for horizontal carousel) ──────────────
function VideoCard({ post, thumb, rxCounts, myRx, onReact, bouncing }: {
  post: CommunityPost; thumb: string | null
  rxCounts: Record<string, number>; myRx: string[]
  onReact: (pid: string, emoji: string) => void; bouncing: string | null
}) {
  const [failed, setFailed] = useState(false)

  return (
    <a
      href={post.video_url!}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex-shrink-0 rounded-2xl overflow-hidden transition-all hover:shadow-lg"
      style={{ width: '210px', border: '1.5px solid #f0f1f3', display: 'block' }}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/9', background: '#001020' }}>
        {thumb && !failed ? (
          <img
            src={thumb}
            alt={post.title || ''}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #001020 0%, #002255 100%)' }}>
            <Play className="w-7 h-7 text-[#F2A900]" />
          </div>
        )}
        {/* Play overlay on hover */}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.32)' }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: '#F2A900' }}>
            <Play className="w-4 h-4 fill-[#001020] text-[#001020] ml-0.5" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 bg-white">
        {post.title && (
          <p className="font-semibold text-gray-900 text-xs leading-snug mb-0.5 line-clamp-2">{post.title}</p>
        )}
        <p className="text-[10px] text-gray-400 mb-2.5">{timeAgo(post.created_at)}</p>
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
          <ReactionRow
            postId={post.id} rxCounts={rxCounts} myRx={myRx}
            bouncing={bouncing} onReact={onReact} small
          />
        </div>
      </div>
    </a>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export function CommunityPortal({ token, clientId, posts, reactions, schedulingDays }: Props) {
  const [localRx, setLocalRx] = useState(reactions)
  const [bouncing, setBouncing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const zoomPost   = posts.find(p => p.type === 'zoom')
  const videoPosts = posts.filter(p => p.type === 'video' && p.video_url)
  const textPosts  = [
    ...posts.filter(p => p.type !== 'zoom' && p.type !== 'video' && p.pinned),
    ...posts.filter(p => p.type !== 'zoom' && p.type !== 'video' && !p.pinned),
  ]

  function counts(pid: string) {
    const c: Record<string, number> = {}
    localRx.filter(r => r.post_id === pid).forEach(r => { c[r.emoji] = (c[r.emoji] || 0) + 1 })
    return c
  }
  function mine(pid: string) {
    return localRx.filter(r => r.post_id === pid && r.user_id === clientId).map(r => r.emoji)
  }

  async function react(pid: string, emoji: string) {
    const key = `${pid}-${emoji}`
    if (busy === key) return
    setBusy(key)
    const had = localRx.some(r => r.post_id === pid && r.user_id === clientId && r.emoji === emoji)
    setLocalRx(prev =>
      had
        ? prev.filter(r => !(r.post_id === pid && r.user_id === clientId && r.emoji === emoji))
        : [...prev, { post_id: pid, user_id: clientId, emoji }]
    )
    if (!had) { setBouncing(key); setTimeout(() => setBouncing(null), 380) }
    try {
      await fetch('/api/community/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, post_id: pid, emoji }),
      })
    } catch { setLocalRx(reactions) }
    finally { setBusy(null) }
  }

  return (
    <>
      <style>{`
        @keyframes rx-pop{0%{transform:scale(1)}40%{transform:scale(1.5)}70%{transform:scale(.85)}100%{transform:scale(1)}}
        .rx-pop{animation:rx-pop .35s cubic-bezier(.36,.07,.19,.97) both}
        @keyframes live-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.75)}}
        .live-dot{width:8px;height:8px;border-radius:50%;background:#F2A900;animation:live-pulse 1.6s ease-in-out infinite}
        .vid-scroll{overflow-x:auto;scrollbar-width:none;display:flex;gap:12px;padding:16px 20px 20px 20px}
        .vid-scroll::-webkit-scrollbar{display:none}
        .vid-scroll::after{content:'';flex-shrink:0;width:4px}
      `}</style>

      <div className="space-y-4">

        {/* ══ MÓDULO 1 — Sesiones con Henry ══ */}
        <Module dark icon={<Video className="w-4.5 h-4.5" />} title="Sesiones con Henry" subtitle="Sesiones grupales en vivo">
          <div className="px-6 py-5 space-y-5">

            {/* Schedule pills */}
            {schedulingDays.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Horario semanal</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {schedulingDays.map(d => (
                    <div
                      key={d.day_of_week}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: 'linear-gradient(135deg, #001d3d, #002855)', border: '1px solid rgba(242,169,0,0.2)' }}
                    >
                      <span className="text-xs font-black" style={{ color: '#F2A900' }}>{DAY_NAMES[d.day_of_week]}</span>
                      <span className="text-[10px] text-white/50">·</span>
                      <span className="text-xs font-medium text-white/80">{fmt12(d.start_hour)} – {fmt12(d.end_hour)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Zoom button */}
            {zoomPost?.zoom_url ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="live-dot shrink-0" />
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#F2A900' }}>Sesión disponible</span>
                </div>
                <a
                  href={zoomPost.zoom_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-sm transition-all hover:opacity-90 active:scale-[.98]"
                  style={{ background: 'linear-gradient(135deg, #F2A900 0%, #ffca28 100%)', color: '#001020' }}
                >
                  <Play className="w-4 h-4 fill-current" />
                  Unirse a la sesión de Zoom
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
              </div>
            ) : (
              schedulingDays.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">Henry actualizará la información de sesiones pronto.</p>
              )
            )}

            {/* No zoom link but has schedule */}
            {!zoomPost?.zoom_url && schedulingDays.length > 0 && (
              <p className="text-sm text-gray-400 text-center py-1">El link de Zoom aparecerá aquí cuando Henry publique la sesión.</p>
            )}
          </div>
        </Module>

        {/* ══ MÓDULO 2 — Videos Grabados (carousel) ══ */}
        <Module icon={<Play className="w-4 h-4" />} title="Videos Grabados"
          subtitle={videoPosts.length > 0 ? `${videoPosts.length} video${videoPosts.length !== 1 ? 's' : ''} disponible${videoPosts.length !== 1 ? 's' : ''}` : 'Sin videos aún'}
        >
          {videoPosts.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#f5f6f8' }}>
                <Play className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">Henry aún no ha subido videos grabados.</p>
            </div>
          ) : (
            <>
              {videoPosts.length > 1 && (
                <p className="text-[11px] text-gray-400 text-right px-5 pt-3">← Desliza para ver más</p>
              )}
              <div className="vid-scroll">
                {videoPosts.map(post => {
                  const ytId = post.video_url ? getYTId(post.video_url) : null
                  const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null
                  return (
                    <VideoCard
                      key={post.id}
                      post={post}
                      thumb={thumb}
                      rxCounts={counts(post.id)}
                      myRx={mine(post.id)}
                      onReact={react}
                      bouncing={bouncing}
                    />
                  )
                })}
              </div>
            </>
          )}
        </Module>

        {/* ══ MÓDULO 3 — Publicaciones ══ */}
        <Module icon={<Megaphone className="w-4 h-4" />} title="Publicaciones" subtitle="Mensajes de Henry para la comunidad">
          {textPosts.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#f5f6f8' }}>
                <Megaphone className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No hay publicaciones aún.</p>
            </div>
          ) : (
            <div>
              {textPosts.map((post, i) => (
                <div
                  key={post.id}
                  className="px-6 py-6"
                  style={{ borderTop: i > 0 ? '1.5px solid #f3f4f6' : 'none' }}
                >
                  {/* Author row */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm"
                      style={{ background: 'linear-gradient(135deg, #001020, #002255)', color: '#F2A900' }}
                    >
                      H
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">Henry Orellana</span>
                        {post.pinned && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(242,169,0,0.12)', color: '#9a6500' }}>
                            <Pin className="w-2.5 h-2.5" />Fijado
                          </span>
                        )}
                        {post.type === 'announcement' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: '#001d3d', color: '#F2A900' }}>
                            Anuncio
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(post.created_at)}</p>
                    </div>
                  </div>

                  {/* Content */}
                  {post.title && (
                    <p className="font-bold text-gray-900 text-[15px] leading-snug mb-2">{post.title}</p>
                  )}
                  {post.content && (
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  )}

                  {/* Reactions */}
                  <div className="mt-4 pt-4" style={{ borderTop: '1.5px solid #f3f4f6' }}>
                    <ReactionRow
                      postId={post.id} rxCounts={counts(post.id)} myRx={mine(post.id)}
                      bouncing={bouncing} onReact={react}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Module>

      </div>
    </>
  )
}

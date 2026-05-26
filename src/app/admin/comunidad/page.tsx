'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Video, Pin, PinOff,
  Trash2, Plus, Link2, Save, Loader2, DollarSign, CalendarClock, Clock,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function fmtHour(h: number) {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

interface DayConfig {
  day_of_week: number
  start_hour: number
  end_hour: number
  is_available: boolean
}

type Post = {
  id: string
  type: string
  title: string | null
  content: string | null
  video_url: string | null
  zoom_url: string | null
  pinned: boolean
  created_at: string
}

const DARK_INPUT_CLS =
  'w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/30 ' +
  'bg-white/[0.04] border border-white/10 text-white placeholder:text-white/30'

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono-tech)',
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.18em',
  color: 'var(--admin-fg-muted)',
}

const BTN_PRIMARY =
  'inline-flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50 ' +
  'bg-white text-black text-[12px] font-semibold tracking-tight ' +
  'shadow-[0_4px_18px_rgba(255,255,255,0.18),0_0_0_0.5px_rgba(255,255,255,0.4)_inset]'

export default function AdminComunidadPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, free: 0, zellePending: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [newPost, setNewPost] = useState({
    type: 'text' as string,
    title: '',
    content: '',
    video_url: '',
    zoom_url: '',
  })

  const [zoomUrl, setZoomUrl] = useState('')
  const [zoomTitle, setZoomTitle] = useState('Sesión en Vivo con Henry')

  const [scheduleConfig, setScheduleConfig] = useState<DayConfig[]>(
    DAYS.map((_, i) => ({ day_of_week: i, start_hour: 9, end_hour: 18, is_available: false }))
  )
  const [savingSchedule, setSavingSchedule] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: memberships } = await supabase.from('community_memberships').select('status')

    const total = memberships?.length || 0
    const active = memberships?.filter(m => m.status === 'active').length || 0
    const free = memberships?.filter(m => m.status === 'free').length || 0

    const { count: zellePending } = await supabase
      .from('zelle_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    setStats({ total, active, free, zellePending: zellePending || 0 })

    const { data: postsData } = await supabase
      .from('community_posts')
      .select('*')
      .neq('type', 'zoom')
      .order('created_at', { ascending: false })
      .limit(50)

    setPosts(postsData || [])

    const { data: zoom } = await supabase
      .from('community_posts')
      .select('zoom_url, title, content')
      .eq('type', 'zoom')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (zoom) {
      setZoomUrl(zoom.zoom_url || '')
      setZoomTitle(zoom.title || 'Sesión en Vivo con Henry')
    }

    const { data: schedData } = await supabase
      .from('scheduling_config')
      .select('day_of_week, start_hour, end_hour, is_available')
      .order('day_of_week')

    if (schedData && schedData.length > 0) {
      setScheduleConfig(
        DAYS.map((_, i) => {
          const found = schedData.find(d => d.day_of_week === i)
          return found
            ? { day_of_week: i, start_hour: found.start_hour, end_hour: found.end_hour, is_available: found.is_available }
            : { day_of_week: i, start_hour: 9, end_hour: 18, is_available: false }
        })
      )
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('community_posts')
      .insert({
        author_id: user.id,
        type: newPost.type,
        title: newPost.title || null,
        content: newPost.content || null,
        video_url: newPost.type === 'video' ? newPost.video_url || null : null,
      })

    if (error) {
      toast.error('Error al crear publicación')
    } else {
      toast.success('Publicación creada')
      setNewPost({ type: 'text', title: '', content: '', video_url: '', zoom_url: '' })
      loadData()
    }
    setSaving(false)
  }

  async function handleSaveZoom() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('community_posts').delete().eq('type', 'zoom')

    if (zoomUrl.trim()) {
      await supabase.from('community_posts').insert({
        author_id: user.id,
        type: 'zoom',
        title: zoomTitle,
        zoom_url: zoomUrl.trim(),
      })
    }

    toast.success('Link de Zoom actualizado')
    setSaving(false)
  }

  async function handleSaveSchedule() {
    setSavingSchedule(true)
    const updates = scheduleConfig.map(day =>
      supabase.from('scheduling_config').upsert(
        { day_of_week: day.day_of_week, start_hour: day.start_hour, end_hour: day.end_hour, is_available: day.is_available },
        { onConflict: 'day_of_week' }
      )
    )
    await Promise.all(updates)
    toast.success('Horarios guardados')
    setSavingSchedule(false)
  }

  function updateDay(idx: number, changes: Partial<DayConfig>) {
    setScheduleConfig(prev => prev.map(d => d.day_of_week === idx ? { ...d, ...changes } : d))
  }

  async function togglePin(postId: string, currentPinned: boolean) {
    await supabase.from('community_posts').update({ pinned: !currentPinned }).eq('id', postId)
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, pinned: !currentPinned } : p))
  }

  async function deletePost(postId: string) {
    if (!confirm('¿Eliminar esta publicación?')) return
    await supabase.from('community_posts').delete().eq('id', postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
    toast.success('Publicación eliminada')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--admin-fg-muted)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Sistema · Comunidad"
        title="Comunidad"
        accentDot
        description="Gestiona membresías, sesiones de Zoom en vivo, publicaciones, horarios disponibles y pagos Zelle."
        telemetry={[
          { label: 'Miembros', value: stats.total.toLocaleString() },
          { label: 'Activos', value: stats.active.toString() },
          { label: 'Gratis', value: stats.free.toString() },
          ...(stats.zellePending > 0 ? [{ label: 'Zelle Pend.', value: stats.zellePending.toString() }] : []),
        ]}
      />

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Users className="w-4 h-4" />} label="Total miembros" value={stats.total} tone="white" />
        <StatCard label="Activos · $25" value={stats.active} tone="success" />
        <StatCard label="Gratis" value={stats.free} tone="neutral" />
      </div>

      {/* Zelle Payments Link */}
      <Link href="/admin/comunidad/zelle">
        <div
          className="rounded-2xl p-4 transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
          style={{
            background: stats.zellePending > 0
              ? 'linear-gradient(180deg, rgba(250,204,21,0.10), rgba(20,20,20,0.92))'
              : 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
            border: stats.zellePending > 0
              ? '0.5px solid rgba(250,204,21,0.3)'
              : '0.5px solid var(--admin-border-strong)',
            backdropFilter: 'blur(20px)',
            boxShadow: stats.zellePending > 0 ? '0 0 24px rgba(250,204,21,0.15)' : 'none',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  background: stats.zellePending > 0 ? 'rgba(250,204,21,0.15)' : 'var(--admin-accent-soft)',
                  border: stats.zellePending > 0 ? '0.5px solid rgba(250,204,21,0.3)' : '0.5px solid var(--admin-border-strong)',
                  color: stats.zellePending > 0 ? '#FACC15' : 'var(--admin-fg-muted)',
                }}
              >
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>
                  Pagos Zelle
                </p>
                <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', marginTop: 2 }}>
                  {stats.zellePending > 0
                    ? `${stats.zellePending} comprobante${stats.zellePending > 1 ? 's' : ''} pendiente${stats.zellePending > 1 ? 's' : ''} de revisión`
                    : 'No hay pagos pendientes'}
                </p>
              </div>
            </div>
            {stats.zellePending > 0 ? (
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full"
                style={{
                  background: '#FACC15',
                  color: 'var(--admin-bg-deep)',
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  boxShadow: '0 0 16px rgba(250,204,21,0.4)',
                }}
              >
                {stats.zellePending} →
              </span>
            ) : (
              <span style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 700, color: 'var(--admin-fg-subtle)', letterSpacing: '0.15em' }}>
                VER TODOS →
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Zoom Config */}
      <Panel icon={<Video className="w-4 h-4" />} title="Link de Zoom" iconTone="yellow">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label style={LABEL_STYLE}>URL DE ZOOM</label>
            <input value={zoomUrl} onChange={(e) => setZoomUrl(e.target.value)} placeholder="https://zoom.us/j/…" className={DARK_INPUT_CLS} />
          </div>
          <div className="space-y-1.5">
            <label style={LABEL_STYLE}>TÍTULO DE LA SESIÓN</label>
            <input value={zoomTitle} onChange={(e) => setZoomTitle(e.target.value)} className={DARK_INPUT_CLS} />
          </div>
          <button onClick={handleSaveZoom} disabled={saving} className={BTN_PRIMARY}>
            <Save className="w-3.5 h-3.5" /> Guardar Zoom
          </button>
        </div>
      </Panel>

      {/* Schedule Config */}
      <Panel
        icon={<CalendarClock className="w-4 h-4" />}
        title="Horarios de Sesiones"
        description="Los días y horas activados se muestran automáticamente en el portal del cliente (/cita → Comunidad)."
        iconTone="yellow"
      >
        <div className="space-y-2">
          {scheduleConfig.map(day => (
            <div
              key={day.day_of_week}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: day.is_available ? 'rgba(250,204,21,0.06)' : 'rgba(255,255,255,0.025)',
                border: day.is_available ? '0.5px solid rgba(250,204,21,0.25)' : '0.5px solid var(--admin-border)',
              }}
            >
              <button
                type="button"
                onClick={() => updateDay(day.day_of_week, { is_available: !day.is_available })}
                className="relative shrink-0 transition-all duration-200"
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  background: day.is_available ? '#FACC15' : 'var(--admin-border)',
                  border: day.is_available ? '0.5px solid #FACC15' : '0.5px solid rgba(255,255,255,0.15)',
                  boxShadow: day.is_available ? '0 0 12px rgba(250,204,21,0.3)' : 'none',
                }}
              >
                <span
                  className="absolute top-0.5 rounded-full transition-transform"
                  style={{
                    width: 16,
                    height: 16,
                    background: day.is_available ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
                    transform: `translateX(${day.is_available ? '20px' : '2px'})`,
                  }}
                />
              </button>

              <span
                style={{
                  width: 96,
                  fontSize: 13,
                  fontWeight: 600,
                  color: day.is_available ? '#FFFFFF' : 'var(--admin-fg-subtle)',
                  letterSpacing: '-0.005em',
                }}
              >
                {DAYS[day.day_of_week]}
              </span>

              {day.is_available ? (
                <div className="flex items-center gap-2 flex-1">
                  <Clock className="w-3 h-3 shrink-0" style={{ color: '#FACC15' }} />
                  <HourSelect
                    value={day.start_hour}
                    onChange={(v) => updateDay(day.day_of_week, { start_hour: v })}
                    filter={(h) => h < day.end_hour}
                  />
                  <span style={{ color: 'var(--admin-fg-subtle)', fontSize: 12, fontFamily: 'var(--font-mono-tech)' }}>–</span>
                  <HourSelect
                    value={day.end_hour}
                    onChange={(v) => updateDay(day.day_of_week, { end_hour: v })}
                    filter={(h) => h > day.start_hour}
                  />
                </div>
              ) : (
                <span
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 10,
                    color: 'var(--admin-fg-subtle)',
                    letterSpacing: '0.1em',
                    flex: 1,
                  }}
                >
                  SIN SESIÓN ESTE DÍA
                </span>
              )}
            </div>
          ))}

          <div className="pt-2">
            <button onClick={handleSaveSchedule} disabled={savingSchedule} className={BTN_PRIMARY}>
              {savingSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar horarios
            </button>
          </div>
        </div>
      </Panel>

      {/* Create Post */}
      <Panel icon={<Plus className="w-4 h-4" />} title="Nueva Publicación" iconTone="yellow">
        <form onSubmit={handleCreatePost} className="space-y-3">
          <div className="flex gap-1 p-1 rounded-full" style={{ background: 'var(--admin-accent-soft)', border: '0.5px solid var(--admin-border)', display: 'inline-flex' }}>
            {(['text', 'video', 'announcement'] as const).map(type => {
              const isActive = newPost.type === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setNewPost({ ...newPost, type })}
                  className="px-3 py-1.5 rounded-full transition-all duration-300"
                  style={{
                    background: isActive ? '#FFFFFF' : 'transparent',
                    color: isActive ? 'var(--admin-bg-deep)' : 'var(--admin-fg-muted)',
                    fontSize: 11.5,
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '-0.005em',
                    boxShadow: isActive ? '0 0 12px rgba(255,255,255,0.15)' : 'none',
                  }}
                >
                  {type === 'text' && '📝 Texto'}
                  {type === 'video' && '🎬 Video'}
                  {type === 'announcement' && '📢 Anuncio'}
                </button>
              )
            })}
          </div>
          <input
            value={newPost.title}
            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
            placeholder="Título (opcional)"
            className={DARK_INPUT_CLS}
          />
          <textarea
            value={newPost.content}
            onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
            placeholder="¿Qué quiere compartir con la comunidad?"
            rows={3}
            className={DARK_INPUT_CLS + ' resize-y'}
            style={{ minHeight: 80 }}
          />
          {newPost.type === 'video' && (
            <div className="flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--admin-fg-muted)' }} />
              <input
                value={newPost.video_url}
                onChange={(e) => setNewPost({ ...newPost, video_url: e.target.value })}
                placeholder="URL del video (YouTube o TikTok)"
                className={DARK_INPUT_CLS}
              />
            </div>
          )}
          <button type="submit" disabled={saving} className={BTN_PRIMARY}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Publicar
          </button>
        </form>
      </Panel>

      {/* Posts List */}
      <div>
        <h2
          className="mb-3"
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: 'var(--admin-fg-muted)',
          }}
        >
          PUBLICACIONES ({posts.length})
        </h2>
        <div className="space-y-3">
          {posts.map(post => (
            <div
              key={post.id}
              className="rounded-2xl p-4"
              style={{
                background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
                border: post.pinned ? '0.5px solid rgba(250,204,21,0.3)' : '0.5px solid var(--admin-border-strong)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{
                        background: 'var(--admin-accent-soft)',
                        border: '0.5px solid rgba(255,255,255,0.12)',
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 9,
                        fontWeight: 700,
                        color: 'var(--admin-fg-muted)',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {post.type === 'text' && '📝 TEXTO'}
                      {post.type === 'video' && '🎬 VIDEO'}
                      {post.type === 'announcement' && '📢 ANUNCIO'}
                    </span>
                    {post.pinned && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(250,204,21,0.12)',
                          border: '0.5px solid rgba(250,204,21,0.3)',
                          fontFamily: 'var(--font-mono-tech)',
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#FDE68A',
                          letterSpacing: '0.1em',
                        }}
                      >
                        📌 FIJADO
                      </span>
                    )}
                  </div>
                  {post.title && (
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>
                      {post.title}
                    </p>
                  )}
                  {post.content && (
                    <p style={{ fontSize: 13, color: 'var(--admin-fg-muted)', marginTop: 4, lineHeight: 1.5 }} className="line-clamp-2">
                      {post.content}
                    </p>
                  )}
                  {post.video_url && (
                    <p
                      className="truncate mt-2"
                      style={{
                        fontFamily: 'var(--font-mono-tech)',
                        fontSize: 11,
                        color: '#60A5FA',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {post.video_url}
                    </p>
                  )}
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      color: 'var(--admin-fg-subtle)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {new Date(post.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => togglePin(post.id, post.pinned)}
                    title={post.pinned ? 'Desfijar' : 'Fijar'}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/10"
                    style={{ color: post.pinned ? '#FACC15' : 'var(--admin-fg-muted)' }}
                  >
                    {post.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => deletePost(post.id)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-red-500/10"
                    style={{ color: '#FCA5A5' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <div
              className="rounded-2xl py-16 text-center"
              style={{
                background: 'linear-gradient(180deg, rgba(20,20,20,0.7), rgba(8,8,8,0.7))',
                border: '0.5px solid var(--admin-border)',
              }}
            >
              <p style={{ fontSize: 13, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.15em' }}>
                NO HAY PUBLICACIONES AÚN
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function Panel({
  icon, title, description, children, iconTone = 'white',
}: {
  icon: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
  iconTone?: 'white' | 'yellow'
}) {
  const tone = iconTone === 'yellow'
    ? { bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.3)', color: '#FACC15' }
    : { bg: 'var(--admin-accent-soft)', border: 'rgba(255,255,255,0.12)', color: 'var(--admin-fg)' }

  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
        border: '0.5px solid var(--admin-border-strong)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.03), transparent 60%)' }}
      />
      <div className="relative">
        <div className="flex items-start gap-3 mb-4">
          <span
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
            style={{
              background: tone.bg,
              border: `0.5px solid ${tone.border}`,
              color: tone.color,
            }}
          >
            {icon}
          </span>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.018em', color: 'var(--admin-fg)' }}>{title}</h2>
            {description && (
              <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', marginTop: 3, lineHeight: 1.55 }}>{description}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

const STAT_TONE = {
  white:   { valueColor: '#FFFFFF' },
  success: { valueColor: '#86EFAC' },
  neutral: { valueColor: '#CBD5E1' },
} as const

function StatCard({ icon, label, value, tone }: { icon?: React.ReactNode; label: string; value: number; tone: keyof typeof STAT_TONE }) {
  const t = STAT_TONE[tone]
  return (
    <div
      className="rounded-2xl p-4 text-center transition-transform duration-300 hover:-translate-y-0.5"
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
        border: '0.5px solid var(--admin-border-strong)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {icon && (
        <div className="mb-2 inline-flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'var(--admin-accent-soft)', border: '0.5px solid rgba(255,255,255,0.12)', color: 'var(--admin-fg)' }}>
          {icon}
        </div>
      )}
      <p style={{ fontSize: 28, fontWeight: 600, color: t.valueColor, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      <p
        className="mt-1"
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.18em',
          color: 'var(--admin-fg-subtle)',
        }}
      >
        {label.toUpperCase()}
      </p>
    </div>
  )
}

function HourSelect({ value, onChange, filter }: { value: number; onChange: (v: number) => void; filter: (h: number) => boolean }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="appearance-none px-2.5 py-1 pr-6 rounded-lg outline-none cursor-pointer transition-colors focus:border-white/30"
        style={{
          background: 'var(--admin-accent-soft)',
          border: '0.5px solid var(--admin-border-strong)',
          color: 'var(--admin-fg)',
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.02em',
          colorScheme: 'dark',
        }}
      >
        {HOURS.filter(filter).map(h => (
          <option key={h} value={h} style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>
            {fmtHour(h)}
          </option>
        ))}
      </select>
      <span aria-hidden className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--admin-fg-subtle)', fontSize: 9 }}>▾</span>
    </div>
  )
}

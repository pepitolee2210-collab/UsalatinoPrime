'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Users, FileText, Video, Megaphone, Pin, PinOff,
  Trash2, Plus, Link2, Save, Loader2, DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

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

export default function AdminComunidadPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, free: 0, zellePending: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // New post form
  const [newPost, setNewPost] = useState({
    type: 'text' as string,
    title: '',
    content: '',
    video_url: '',
    zoom_url: '',
  })

  // Zoom config
  const [zoomUrl, setZoomUrl] = useState('')
  const [zoomTitle, setZoomTitle] = useState('Sesión en Vivo con Henry')
  const [zoomSchedule, setZoomSchedule] = useState('Todos los días')

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)

    // Stats
    const { data: memberships } = await supabase
      .from('community_memberships')
      .select('status')

    const total = memberships?.length || 0
    const active = memberships?.filter(m => m.status === 'active').length || 0
    const free = memberships?.filter(m => m.status === 'free').length || 0

    // Zelle pending count
    const { count: zellePending } = await supabase
      .from('zelle_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    setStats({ total, active, free, zellePending: zellePending || 0 })

    // Posts
    const { data: postsData } = await supabase
      .from('community_posts')
      .select('*')
      .neq('type', 'zoom')
      .order('created_at', { ascending: false })
      .limit(50)

    setPosts(postsData || [])

    // Current zoom config
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
      setZoomSchedule(zoom.content || 'Todos los días')
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

    // Delete old zoom posts and create new one
    await supabase
      .from('community_posts')
      .delete()
      .eq('type', 'zoom')

    if (zoomUrl.trim()) {
      await supabase
        .from('community_posts')
        .insert({
          author_id: user.id,
          type: 'zoom',
          title: zoomTitle,
          content: zoomSchedule,
          zoom_url: zoomUrl.trim(),
        })
    }

    toast.success('Link de Zoom actualizado')
    setSaving(false)
  }

  async function togglePin(postId: string, currentPinned: boolean) {
    await supabase
      .from('community_posts')
      .update({ pinned: !currentPinned })
      .eq('id', postId)

    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, pinned: !currentPinned } : p
    ))
  }

  async function deletePost(postId: string) {
    if (!confirm('¿Eliminar esta publicación?')) return

    await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)

    setPosts(prev => prev.filter(p => p.id !== postId))
    toast.success('Publicación eliminada')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Comunidad</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 text-center">
            <Users className="w-6 h-6 text-[#002855] mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total miembros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            <p className="text-sm text-gray-500">Activos ($25)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-600">{stats.free}</p>
            <p className="text-sm text-gray-500">Gratis</p>
          </CardContent>
        </Card>
      </div>

      {/* Zelle Payments Link */}
      <Link href="/admin/comunidad/zelle">
        <Card className={`cursor-pointer transition-colors ${stats.zellePending > 0 ? 'border-[#F2A900] bg-[#F2A900]/5 hover:bg-[#F2A900]/10' : 'hover:bg-gray-50'}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stats.zellePending > 0 ? 'bg-[#F2A900]/20' : 'bg-gray-100'}`}>
                  <DollarSign className={`w-5 h-5 ${stats.zellePending > 0 ? 'text-[#F2A900]' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Pagos Zelle</p>
                  <p className="text-sm text-gray-500">
                    {stats.zellePending > 0
                      ? `${stats.zellePending} comprobante${stats.zellePending > 1 ? 's' : ''} pendiente${stats.zellePending > 1 ? 's' : ''} de revisión`
                      : 'No hay pagos pendientes'
                    }
                  </p>
                </div>
              </div>
              {stats.zellePending > 0 && (
                <Badge className="bg-[#F2A900] text-white text-sm px-3">
                  {stats.zellePending} &rarr;
                </Badge>
              )}
              {stats.zellePending === 0 && (
                <span className="text-sm text-gray-400">Ver todos &rarr;</span>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Zoom Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="w-5 h-5 text-[#F2A900]" />
            Link de Zoom
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>URL de Zoom</Label>
            <div className="flex gap-2">
              <Input
                value={zoomUrl}
                onChange={(e) => setZoomUrl(e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="h-11"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={zoomTitle}
                onChange={(e) => setZoomTitle(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Horario</Label>
              <Input
                value={zoomSchedule}
                onChange={(e) => setZoomSchedule(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
          <Button onClick={handleSaveZoom} disabled={saving} className="bg-[#002855]">
            <Save className="w-4 h-4 mr-2" />
            Guardar Zoom
          </Button>
        </CardContent>
      </Card>

      {/* Create Post */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="w-5 h-5 text-[#F2A900]" />
            Nueva Publicación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreatePost} className="space-y-3">
            <div className="flex gap-2">
              {(['text', 'video', 'announcement'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setNewPost({ ...newPost, type })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    newPost.type === type
                      ? 'bg-[#002855] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {type === 'text' && '📝 Texto'}
                  {type === 'video' && '🎬 Video'}
                  {type === 'announcement' && '📢 Anuncio'}
                </button>
              ))}
            </div>
            <Input
              value={newPost.title}
              onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
              placeholder="Título (opcional)"
              className="h-11"
            />
            <textarea
              value={newPost.content}
              onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
              placeholder="¿Qué quiere compartir con la comunidad?"
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F2A900]/40 resize-none"
            />
            {newPost.type === 'video' && (
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-gray-400" />
                <Input
                  value={newPost.video_url}
                  onChange={(e) => setNewPost({ ...newPost, video_url: e.target.value })}
                  placeholder="URL del video (YouTube o TikTok)"
                  className="h-11"
                />
              </div>
            )}
            <Button type="submit" disabled={saving} className="bg-[#F2A900] hover:bg-[#D4940A] text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publicar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Posts List */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          Publicaciones ({posts.length})
        </h2>
        <div className="space-y-3">
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">
                      {post.type === 'text' && '📝 Texto'}
                      {post.type === 'video' && '🎬 Video'}
                      {post.type === 'announcement' && '📢 Anuncio'}
                    </Badge>
                    {post.pinned && <Badge className="bg-[#F2A900] text-xs">📌 Fijado</Badge>}
                  </div>
                  {post.title && <p className="font-semibold text-gray-900">{post.title}</p>}
                  {post.content && <p className="text-sm text-gray-600 line-clamp-2">{post.content}</p>}
                  {post.video_url && <p className="text-xs text-blue-500 truncate mt-1">{post.video_url}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(post.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => togglePin(post.id, post.pinned)}
                    title={post.pinned ? 'Desfijar' : 'Fijar'}
                  >
                    {post.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePost(post.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <p className="text-center text-gray-400 py-8">No hay publicaciones aún</p>
          )}
        </div>
      </div>
    </div>
  )
}

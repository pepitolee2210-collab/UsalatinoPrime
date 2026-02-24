import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PostCard } from '@/components/community/PostCard'
import { ZoomCard } from '@/components/community/ZoomCard'
import { PaywallOverlay } from '@/components/community/PaywallOverlay'

export default async function ComunidadPage({
  searchParams,
}: {
  searchParams: Promise<{ activated?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get membership status
  const { data: membership } = await supabase
    .from('community_memberships')
    .select('status, current_period_end')
    .eq('user_id', user.id)
    .single()

  const isActive = membership?.status === 'active'

  // Ensure free membership record exists for new users
  if (!membership) {
    await supabase
      .from('community_memberships')
      .insert({ user_id: user.id, status: 'free' })
  }

  // Get zoom post (pinned zoom card)
  const { data: zoomPost } = await supabase
    .from('community_posts')
    .select('zoom_url, title, content')
    .eq('type', 'zoom')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Get posts
  const { data: posts } = await supabase
    .from('community_posts')
    .select(`
      id, type, title, content, video_url, pinned, created_at,
      author:profiles(first_name, last_name, avatar_url)
    `)
    .neq('type', 'zoom')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(isActive ? 50 : 3)

  // Get reactions and comments for each post
  const postsWithDetails = await Promise.all(
    (posts || []).map(async (post) => {
      // Reaction counts
      const { data: reactions } = await supabase
        .from('community_reactions')
        .select('emoji')
        .eq('post_id', post.id)

      const reactionCounts: Record<string, number> = {}
      reactions?.forEach(r => {
        reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1
      })

      // User's reaction
      const { data: userReaction } = await supabase
        .from('community_reactions')
        .select('emoji')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .single()

      // Comments
      const { data: comments } = await supabase
        .from('community_comments')
        .select(`
          id, content, created_at,
          user:profiles!community_comments_user_id_profiles_fkey(first_name, last_name)
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
        .limit(20)

      return {
        ...post,
        author: (Array.isArray(post.author) ? post.author[0] : post.author) || { first_name: 'Usuario', last_name: '', avatar_url: null },
        reactions: Object.entries(reactionCounts).map(([emoji, count]) => ({ emoji, count })),
        userReaction: userReaction?.emoji || null,
        comments: (comments || []).map(c => ({
          ...c,
          user: Array.isArray(c.user) ? c.user[0] : c.user,
        })),
      }
    })
  )

  const params = await searchParams

  return (
    <div className="space-y-5">
      {/* Welcome toast for new members */}
      {params.activated && isActive && (
        <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center">
          <p className="text-green-800 font-medium">
            🎉 ¡Bienvenido a la comunidad! Ya tiene acceso completo.
          </p>
        </div>
      )}

      {/* Zoom card (always visible for active members) */}
      {isActive && zoomPost?.zoom_url && (
        <ZoomCard
          zoomUrl={zoomPost.zoom_url}
          title={zoomPost.title || undefined}
          schedule={zoomPost.content || undefined}
        />
      )}

      {/* Paywall for free users */}
      {!isActive && (
        <PaywallOverlay />
      )}

      {/* Posts feed (only for active members) */}
      {isActive && postsWithDetails.map(post => (
        <PostCard
          key={post.id}
          post={post}
          userId={user.id}
          isActive={isActive}
        />
      ))}

      {isActive && postsWithDetails.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Aún no hay publicaciones</p>
          <p className="text-gray-400 text-sm mt-1">Henry publicará contenido pronto</p>
        </div>
      )}
    </div>
  )
}

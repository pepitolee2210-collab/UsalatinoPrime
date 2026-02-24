import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { VideoCard } from '@/components/community/VideoCard'
import { PaywallOverlay } from '@/components/community/PaywallOverlay'

export default async function VideosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('community_memberships')
    .select('status')
    .eq('user_id', user.id)
    .single()

  const isActive = membership?.status === 'active'

  if (!isActive) {
    return <PaywallOverlay />
  }

  const { data: videos } = await supabase
    .from('community_posts')
    .select('id, title, video_url, created_at')
    .eq('type', 'video')
    .not('video_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div>
      <h2 className="text-xl font-bold text-[#002855] mb-4">Videos</h2>

      {videos && videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map(video => (
            <VideoCard
              key={video.id}
              title={video.title}
              videoUrl={video.video_url!}
              createdAt={video.created_at}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Aún no hay videos</p>
          <p className="text-gray-400 text-sm mt-1">Los videos aparecerán aquí pronto</p>
        </div>
      )}
    </div>
  )
}

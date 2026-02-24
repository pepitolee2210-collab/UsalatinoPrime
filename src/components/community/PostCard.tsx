'use client'

import { ReactionBar } from './ReactionBar'
import { CommentSection } from './CommentSection'
import { Pin, Megaphone } from 'lucide-react'

interface PostCardProps {
  post: {
    id: string
    type: string
    title: string | null
    content: string | null
    video_url: string | null
    pinned: boolean
    created_at: string
    author: { first_name: string; last_name: string; avatar_url?: string | null }
    reactions: { emoji: string; count: number }[]
    userReaction: string | null
    comments: {
      id: string
      content: string
      created_at: string
      user: { first_name: string; last_name: string }
    }[]
  }
  userId: string
  isActive: boolean
}

function getVideoEmbed(url: string) {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (ytMatch) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${ytMatch[1]}`}
        className="w-full aspect-video rounded-lg"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }

  // TikTok - link externo
  if (url.includes('tiktok.com')) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors text-center"
      >
        <span className="text-2xl mb-2 block">🎵</span>
        <span className="text-sm font-medium text-[#002855]">Ver video en TikTok</span>
      </a>
    )
  }

  // Generic link
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors text-center"
    >
      <span className="text-sm font-medium text-[#002855]">Ver video</span>
    </a>
  )
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `hace ${days}d`
  return new Date(date).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })
}

export function PostCard({ post, userId, isActive }: PostCardProps) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#002855] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {post.author.avatar_url ? (
            <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[#F2A900] font-bold text-sm">
              {post.author.first_name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{post.author.first_name} {post.author.last_name}</span>
            {post.pinned && <Pin className="w-3.5 h-3.5 text-[#F2A900]" />}
            {post.type === 'announcement' && <Megaphone className="w-3.5 h-3.5 text-[#F2A900]" />}
          </div>
          <span className="text-xs text-gray-400">{timeAgo(post.created_at)}</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        {post.title && (
          <h3 className="font-bold text-[#002855] text-lg mb-1">{post.title}</h3>
        )}
        {post.content && (
          <p className="text-gray-700 whitespace-pre-wrap text-[15px] leading-relaxed">
            {post.content}
          </p>
        )}
      </div>

      {/* Video embed */}
      {post.video_url && (
        <div className="px-4 pb-3">
          {getVideoEmbed(post.video_url)}
        </div>
      )}

      {/* Reactions */}
      <div className="px-4 pb-2">
        <ReactionBar
          postId={post.id}
          userId={userId}
          reactions={post.reactions}
          userReaction={post.userReaction}
        />
      </div>

      {/* Comments */}
      <div className="px-4 pb-4">
        <CommentSection
          postId={post.id}
          userId={userId}
          comments={post.comments}
          isActive={isActive}
        />
      </div>
    </div>
  )
}

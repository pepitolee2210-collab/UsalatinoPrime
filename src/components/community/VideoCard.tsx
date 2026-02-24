'use client'

import { ExternalLink } from 'lucide-react'

interface VideoCardProps {
  title: string | null
  videoUrl: string
  createdAt: string
}

function getPlatform(url: string): 'youtube' | 'tiktok' | 'other' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com')) return 'tiktok'
  return 'other'
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export function VideoCard({ title, videoUrl, createdAt }: VideoCardProps) {
  const platform = getPlatform(videoUrl)
  const ytId = platform === 'youtube' ? getYouTubeId(videoUrl) : null

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* Thumbnail / embed */}
      {ytId ? (
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          className="w-full aspect-video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-full aspect-video bg-gradient-to-br from-gray-900 to-gray-700 hover:opacity-90 transition-opacity"
        >
          <div className="text-center">
            <span className="text-4xl block mb-2">
              {platform === 'tiktok' ? '🎵' : '🎬'}
            </span>
            <span className="text-white text-sm font-medium">
              Ver en {platform === 'tiktok' ? 'TikTok' : 'enlace externo'}
            </span>
          </div>
        </a>
      )}

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {title && (
              <h3 className="font-medium text-gray-900 text-sm truncate">{title}</h3>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(createdAt).toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}
              {' · '}
              {platform === 'youtube' ? 'YouTube' : platform === 'tiktok' ? 'TikTok' : 'Video'}
            </p>
          </div>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </a>
        </div>
      </div>
    </div>
  )
}

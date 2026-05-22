'use client'

import { useEffect, useState } from 'react'
import { Download, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'

interface Props {
  path: string
  type: 'image' | 'document'
  name: string | null
  size: number | null
  isMe: boolean
}

// Caché simple en memoria de signed URLs (TTL 50 min — las URLs duran 60)
const urlCache = new Map<string, { url: string; expiresAt: number }>()
const URL_TTL_MS = 50 * 60 * 1000

async function fetchSignedUrl(path: string): Promise<string | null> {
  const cached = urlCache.get(path)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const res = await fetch(`/api/chat/upload-attachment?path=${encodeURIComponent(path)}`, {
    credentials: 'same-origin',
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.url) return null

  urlCache.set(path, { url: data.url, expiresAt: Date.now() + URL_TTL_MS })
  return data.url
}

export function MessageAttachment({ path, type, name, size, isMe }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchSignedUrl(path).then((u) => {
      if (cancelled) return
      setUrl(u)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  if (type === 'image') {
    return (
      <a
        href={url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-1 rounded-lg overflow-hidden bg-black/5 max-w-[280px]"
      >
        {loading || !url ? (
          <div className="h-40 w-[260px] flex items-center justify-center bg-gray-100">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : (
          <img
            src={url}
            alt={name || 'imagen'}
            className="block max-w-full max-h-[280px] object-contain"
          />
        )}
      </a>
    )
  }

  // Documento
  const sizeKb = size ? Math.round(size / 1024) : null
  const containerClasses = isMe
    ? 'bg-white/15 border-white/20 text-white'
    : 'bg-gray-50 border-gray-200 text-gray-900'
  const iconBg = isMe ? 'bg-white/20' : 'bg-white border border-gray-200'

  return (
    <a
      href={url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      download={name || undefined}
      className={`mt-1 flex items-center gap-2.5 rounded-lg border px-2.5 py-2 max-w-[280px] transition-opacity ${containerClasses} ${
        !url ? 'pointer-events-none opacity-70' : 'hover:opacity-90'
      }`}
    >
      <span className={`h-9 w-9 rounded-md inline-flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {type === 'document' ? (
          <FileText className={`w-4 h-4 ${isMe ? 'text-white' : 'text-gray-600'}`} />
        ) : (
          <ImageIcon className={`w-4 h-4 ${isMe ? 'text-white' : 'text-gray-600'}`} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate">{name || 'Documento'}</p>
        <p className={`text-[10px] ${isMe ? 'text-white/70' : 'text-gray-500'}`}>
          {loading ? 'Generando enlace...' : sizeKb ? `${sizeKb} KB` : ''}
        </p>
      </div>
      {url && <Download className={`w-3.5 h-3.5 flex-shrink-0 ${isMe ? 'text-white/70' : 'text-gray-400'}`} />}
    </a>
  )
}

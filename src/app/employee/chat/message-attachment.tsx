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
        className="block mt-1 rounded-lg overflow-hidden max-w-[280px]"
        style={{ background: 'var(--admin-bg-elev-2)' }}
      >
        {loading || !url ? (
          <div
            className="h-40 w-[260px] flex items-center justify-center"
            style={{ background: 'var(--admin-bg-elev-2)' }}
          >
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--admin-fg-muted)' }} />
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
  const containerStyle: React.CSSProperties = isMe
    ? {
        background: 'rgba(255,255,255,0.16)',
        border: '0.5px solid rgba(255,255,255,0.22)',
        color: '#FFFFFF',
      }
    : {
        background: 'var(--admin-bg-elev-2)',
        border: '0.5px solid var(--admin-border)',
        color: 'var(--admin-fg)',
      }
  const iconStyle: React.CSSProperties = isMe
    ? { background: 'rgba(255,255,255,0.22)' }
    : { background: 'var(--admin-bg-elev)', border: '0.5px solid var(--admin-border)' }

  return (
    <a
      href={url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      download={name || undefined}
      className={`mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 max-w-[280px] transition-opacity ${
        !url ? 'pointer-events-none opacity-70' : 'hover:opacity-90'
      }`}
      style={containerStyle}
    >
      <span
        className="h-9 w-9 rounded-md inline-flex items-center justify-center flex-shrink-0"
        style={iconStyle}
      >
        {type === 'document' ? (
          <FileText
            className="w-4 h-4"
            style={{ color: isMe ? '#FFFFFF' : 'var(--admin-fg-muted)' }}
          />
        ) : (
          <ImageIcon
            className="w-4 h-4"
            style={{ color: isMe ? '#FFFFFF' : 'var(--admin-fg-muted)' }}
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate">{name || 'Documento'}</p>
        <p
          className="text-[10px]"
          style={{ color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--admin-fg-subtle)' }}
        >
          {loading ? 'Generando enlace...' : sizeKb ? `${sizeKb} KB` : ''}
        </p>
      </div>
      {url && (
        <Download
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--admin-fg-subtle)' }}
        />
      )}
    </a>
  )
}

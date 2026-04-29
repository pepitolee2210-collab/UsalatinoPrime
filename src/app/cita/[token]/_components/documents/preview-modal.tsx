'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface PreviewModalProps {
  token: string
  doc: { id: string; name: string } | null
  onClose: () => void
}

/**
 * Modal de preview que usa el proxy /api/client/preview-doc?raw=1 para
 * embed same-origin sin romper CSP. Soporta PDF e imágenes.
 */
export function PreviewModal({ token, doc, onClose }: PreviewModalProps) {
  // Bloquear scroll body mientras está abierto
  useEffect(() => {
    if (!doc) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [doc])

  if (!doc || typeof document === 'undefined') return null

  const url = `/api/client/preview-doc?token=${encodeURIComponent(token)}&id=${encodeURIComponent(doc.id)}&raw=1`

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <header
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white font-semibold text-sm truncate flex-1 mr-4">{doc.name}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={url}
            download={doc.name}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold text-white"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            Descargar
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        </div>
      </header>
      <div
        className="flex-1 flex items-stretch justify-center px-4 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src={url}
          className="w-full h-full rounded-xl bg-white"
          title={doc.name}
        />
      </div>
    </div>,
    document.body,
  )
}

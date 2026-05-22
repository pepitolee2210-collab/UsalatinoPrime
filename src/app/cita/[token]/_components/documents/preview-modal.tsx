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
 * embed same-origin sin romper CSP. Detecta el tipo por extensión:
 *   - PDF → <iframe>
 *   - Imagen (jpg/jpeg/png/gif/webp/heic/heif) → <img>
 *   - Otros → fallback con "Descargar para abrir"
 *
 * Mismo patrón que el modal de empleado en case-tabs-by-phase.tsx
 * (commit 935e848). Usar <img> para imágenes es necesario porque Mobile
 * Safari y Chrome móvil renderizan inconsistente imágenes embebidas en
 * iframes.
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
  const ext = doc.name.toLowerCase().split('.').pop() || ''
  const isPDF = ext === 'pdf'
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)

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
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold text-white"
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
        className="flex-1 min-h-0 overflow-auto flex items-center justify-center px-4 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        {isPDF ? (
          <iframe
            src={url}
            className="w-full h-full rounded-xl bg-white"
            title={doc.name}
          />
        ) : isImage ? (
          <img
            src={url}
            alt={doc.name}
            className="max-w-full max-h-full object-contain rounded-xl"
          />
        ) : (
          <div className="bg-white rounded-2xl p-8 max-w-sm text-center">
            <span
              className="material-symbols-outlined block mx-auto mb-3"
              style={{ fontSize: 56, color: 'rgb(156, 163, 175)' }}
            >
              description
            </span>
            <p className="text-sm text-gray-600 mb-4">
              Vista previa no disponible para este formato.
            </p>
            <a
              href={url}
              download={doc.name}
              className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--color-ulp-primary)' }}
            >
              Descargar para abrir
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

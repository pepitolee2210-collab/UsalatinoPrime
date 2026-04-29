'use client'

import { useState } from 'react'
import type { UploadFile } from './types'
import { fileTypeIcon, formatBytes } from './types'

interface FileRowProps {
  file: UploadFile
  token: string
  onPreview: (file: { id: string; name: string }) => void
  onDelete: (id: string) => Promise<void> | void
  fromPreviousPhase: boolean
  phaseLabel?: string
}

export function FileRow({ file, token, onPreview, onDelete, fromPreviousPhase, phaseLabel }: FileRowProps) {
  const [deleting, setDeleting] = useState(false)
  const downloadHref = `/api/client/preview-doc?token=${encodeURIComponent(token)}&id=${encodeURIComponent(file.id)}&raw=1`
  const canDelete = file.status !== 'approved'

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: 'var(--color-ulp-surface-container-low)' }}
    >
      <span
        className="material-symbols-outlined flex-shrink-0"
        style={{ fontSize: 18, color: 'var(--color-ulp-on-surface-variant)' }}
      >
        {fileTypeIcon(file.file_type)}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="ulp-body-sm font-medium truncate"
          style={{ color: 'var(--color-ulp-on-surface)' }}
        >
          {file.name}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            {formatBytes(file.file_size)}
          </span>
          {fromPreviousPhase && phaseLabel && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(180, 83, 9, 0.1)',
                color: 'var(--color-ulp-primary)',
              }}
            >
              Subido en {phaseLabel}
            </span>
          )}
          {file.status === 'rejected' && file.rejection_reason && (
            <span className="text-[10px] truncate" style={{ color: 'rgb(185 28 28)' }}>
              {file.rejection_reason}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onPreview({ id: file.id, name: file.name })}
        className="w-8 h-8 rounded-full flex items-center justify-center"
        aria-label="Ver"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          visibility
        </span>
      </button>
      <a
        href={downloadHref}
        download={file.name}
        className="w-8 h-8 rounded-full flex items-center justify-center"
        aria-label="Descargar"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          download
        </span>
      </a>
      {canDelete && (
        <button
          type="button"
          disabled={deleting}
          onClick={async () => {
            if (!confirm('¿Eliminar este archivo?')) return
            setDeleting(true)
            try {
              await onDelete(file.id)
            } finally {
              setDeleting(false)
            }
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          aria-label="Eliminar"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 18, color: deleting ? 'var(--color-ulp-outline)' : 'rgb(185 28 28)' }}
          >
            {deleting ? 'progress_activity' : 'delete'}
          </span>
        </button>
      )}
    </div>
  )
}

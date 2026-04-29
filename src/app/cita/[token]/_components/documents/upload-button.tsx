'use client'

import { useRef, useState } from 'react'
import { ACCEPT_ATTR, uploadClientDocument } from './upload-client'

interface UploadButtonProps {
  token: string
  documentTypeId: number
  slotLabel?: string | null
  label: string
  variant?: 'primary' | 'ghost'
  onUploaded: () => void
  onError: (msg: string) => void
}

/**
 * Botón con input file oculto. Maneja el upload completo:
 * signed URL → Storage → confirm. Toast de error visible al padre.
 */
export function UploadButton({
  token,
  documentTypeId,
  slotLabel,
  label,
  variant = 'primary',
  onUploaded,
  onError,
}: UploadButtonProps) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      await uploadClientDocument({ token, file, documentTypeId, slotLabel })
      onUploaded()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }

  const baseStyle = variant === 'primary'
    ? {
        background: 'var(--color-ulp-primary-container)',
        color: 'var(--color-ulp-on-primary-container)',
      }
    : {
        background: 'transparent',
        color: 'var(--color-ulp-primary)',
        border: '1px dashed var(--color-ulp-outline)',
      }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-60"
        style={baseStyle}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          {busy ? 'progress_activity' : 'upload'}
        </span>
        {busy ? 'Subiendo...' : label}
      </button>
    </>
  )
}

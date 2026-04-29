'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { STATUS_VISUAL, type DocItem } from './types'
import { FileRow } from './file-row'
import { UploadButton } from './upload-button'

interface DocumentCardMultipleProps {
  doc: DocItem
  token: string
  phaseLabel?: string
  onPreview: (file: { id: string; name: string }) => void
  onDelete: (id: string) => Promise<void>
  onChange: () => void
  onError: (msg: string) => void
}

/**
 * Card para slot_kind=multiple_named. Cada slot tiene un nombre custom
 * dado por el cliente (ej. "Carta del Sr. Juan Pérez"). Hasta max_slots.
 */
export function DocumentCardMultiple({
  doc,
  token,
  phaseLabel,
  onPreview,
  onDelete,
  onChange,
  onError,
}: DocumentCardMultipleProps) {
  const [showModal, setShowModal] = useState(false)
  const [pendingSlotName, setPendingSlotName] = useState('')

  const visual = STATUS_VISUAL[doc.status]
  const slotEntries = Object.entries(doc.uploads).filter(([, files]) => files.length > 0)
  const slotCount = slotEntries.length
  const maxReached = doc.max_slots ? slotCount >= doc.max_slots : false

  return (
    <article
      className="rounded-2xl border overflow-hidden"
      style={{
        background: 'var(--color-ulp-surface-container-lowest)',
        borderColor: 'var(--color-ulp-outline-variant)',
        borderLeftWidth: 4,
        borderLeftColor: visual.borderLeftColor === 'transparent' ? 'var(--color-ulp-outline-variant)' : visual.borderLeftColor,
      }}
    >
      <div className="p-4">
        <header className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="ulp-body-md font-semibold" style={{ color: 'var(--color-ulp-on-surface)' }}>
              {doc.name_es}
            </h3>
            {doc.description_es && (
              <p
                className="ulp-body-sm mt-1"
                style={{ color: 'var(--color-ulp-on-surface-variant)' }}
              >
                {doc.description_es}
              </p>
            )}
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-ulp-outline)' }}>
              {slotCount}{doc.max_slots ? ` de ${doc.max_slots}` : ''} archivos agregados
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0"
            style={{ background: visual.bg, color: visual.textColor }}
          >
            <span className="material-symbols-outlined" data-fill="1" style={{ fontSize: 12 }}>
              {visual.icon}
            </span>
            {visual.label}
          </span>
        </header>

        {slotEntries.length > 0 && (
          <div className="space-y-3 mt-3">
            {slotEntries.map(([slotLabel, files]) => (
              <section key={slotLabel}>
                <p
                  className="ulp-label mb-1.5 truncate"
                  style={{ color: 'var(--color-ulp-on-surface-variant)' }}
                >
                  {slotLabel}
                </p>
                <div className="space-y-1.5">
                  {files.map((f) => (
                    <FileRow
                      key={f.id}
                      file={f}
                      token={token}
                      onPreview={onPreview}
                      onDelete={async (id) => {
                        await onDelete(id)
                        onChange()
                      }}
                      fromPreviousPhase={doc.from_previous_phase}
                      phaseLabel={phaseLabel}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-3">
          <button
            type="button"
            disabled={maxReached}
            onClick={() => {
              setPendingSlotName('')
              setShowModal(true)
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{
              background: 'transparent',
              color: 'var(--color-ulp-primary)',
              border: '1px dashed var(--color-ulp-outline)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              add
            </span>
            {maxReached ? 'Máximo alcanzado' : 'Añadir archivo'}
          </button>
        </div>

        {doc.legal_reference && (
          <p
            className="text-[10px] mt-3 italic"
            style={{ color: 'var(--color-ulp-outline)' }}
          >
            Referencia legal: {doc.legal_reference}
          </p>
        )}
      </div>

      {showModal && (
        <SlotNameModal
          docName={doc.name_es}
          value={pendingSlotName}
          onChange={setPendingSlotName}
          onCancel={() => setShowModal(false)}
          onConfirm={(name) => {
            setShowModal(false)
            setPendingSlotName(name)
          }}
        />
      )}

      {/* Si hay nombre confirmado y aún no se subió archivo, abrir picker */}
      {pendingSlotName && !showModal && (
        <PendingUploadOverlay
          token={token}
          documentTypeId={doc.type_id}
          slotName={pendingSlotName}
          onDone={() => {
            setPendingSlotName('')
            onChange()
          }}
          onError={(msg) => {
            onError(msg)
            setPendingSlotName('')
          }}
        />
      )}
    </article>
  )
}

interface SlotNameModalProps {
  docName: string
  value: string
  onChange: (v: string) => void
  onCancel: () => void
  onConfirm: (name: string) => void
}

function SlotNameModal({ docName, value, onChange, onCancel, onConfirm }: SlotNameModalProps) {
  const trimmed = value.trim()
  const canConfirm = trimmed.length > 0 && trimmed.length <= 80

  // Bloquear scroll body mientras el modal está abierto
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2 className="ulp-h3" style={{ fontSize: 22 }}>
            Nuevo archivo
          </h2>
          <p className="ulp-body-sm mt-1" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            Para <strong>{docName}</strong>. Asigna un nombre descriptivo para identificarlo.
          </p>
        </header>
        <div>
          <label className="ulp-label block mb-1.5" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            Nombre del archivo
          </label>
          <input
            type="text"
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={80}
            placeholder="ej. Carta del Sr. Juan Pérez"
            className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
            style={{
              borderColor: 'var(--color-ulp-outline-variant)',
              background: 'var(--color-ulp-surface-container-low)',
              color: 'var(--color-ulp-on-surface)',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canConfirm) onConfirm(trimmed)
              if (e.key === 'Escape') onCancel()
            }}
          />
          <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--color-ulp-outline)' }}>
            {value.length}/80
          </p>
        </div>
        <footer className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-sm font-bold"
            style={{ background: 'var(--color-ulp-surface-container)', color: 'var(--color-ulp-on-surface)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(trimmed)}
            className="px-4 py-2 rounded-full text-sm font-bold disabled:opacity-50"
            style={{
              background: 'var(--color-ulp-primary-container)',
              color: 'var(--color-ulp-on-primary-container)',
            }}
          >
            Continuar
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

interface PendingUploadOverlayProps {
  token: string
  documentTypeId: number
  slotName: string
  onDone: () => void
  onError: (msg: string) => void
}

/**
 * Una vez que el cliente confirmó el nombre, abre directamente el file picker
 * via el UploadButton montado al instante.
 */
function PendingUploadOverlay({
  token,
  documentTypeId,
  slotName,
  onDone,
  onError,
}: PendingUploadOverlayProps) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div className="bg-white rounded-3xl p-5 max-w-sm w-full text-center space-y-4 shadow-2xl">
        <h2 className="ulp-h3" style={{ fontSize: 20 }}>
          Subir “{slotName}”
        </h2>
        <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          Selecciona el archivo (PDF, JPG, PNG, WebP o HEIC).
        </p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => onError('Cancelado')}
            className="px-4 py-2 rounded-full text-sm font-bold"
            style={{ background: 'var(--color-ulp-surface-container)' }}
          >
            Cancelar
          </button>
          <UploadButton
            token={token}
            documentTypeId={documentTypeId}
            slotLabel={slotName}
            label="Elegir archivo"
            onUploaded={onDone}
            onError={onError}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}

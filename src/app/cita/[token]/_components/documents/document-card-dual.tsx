'use client'

import { STATUS_VISUAL, type DocItem } from './types'
import { FileRow } from './file-row'
import { UploadButton } from './upload-button'

interface DocumentCardDualProps {
  doc: DocItem
  token: string
  phaseLabel?: string
  onPreview: (file: { id: string; name: string }) => void
  onDelete: (id: string) => Promise<void>
  onChange: () => void
  onError: (msg: string) => void
}

/**
 * Card para slot_kind=dual_es_en (original ES + traducción EN).
 * Cada slot tiene su propio FileRow + UploadButton.
 */
export function DocumentCardDual({
  doc,
  token,
  phaseLabel,
  onPreview,
  onDelete,
  onChange,
  onError,
}: DocumentCardDualProps) {
  const visual = STATUS_VISUAL[doc.status]
  const esFiles = doc.uploads.es ?? []
  const enFiles = doc.uploads.en ?? []

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
        <header className="flex items-start justify-between gap-3 mb-3">
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

        <div className="space-y-3">
          <SlotSection
            label="Original (Español)"
            iconName="description"
            files={esFiles}
            token={token}
            documentTypeId={doc.type_id}
            slotLabel="es"
            phaseLabel={phaseLabel}
            fromPreviousPhase={doc.from_previous_phase}
            onPreview={onPreview}
            onDelete={onDelete}
            onChange={onChange}
            onError={onError}
          />
          <SlotSection
            label="Traducción certificada (Inglés)"
            iconName="translate"
            files={enFiles}
            token={token}
            documentTypeId={doc.type_id}
            slotLabel="en"
            phaseLabel={phaseLabel}
            fromPreviousPhase={doc.from_previous_phase}
            onPreview={onPreview}
            onDelete={onDelete}
            onChange={onChange}
            onError={onError}
          />
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
    </article>
  )
}

interface SlotSectionProps {
  label: string
  iconName: string
  files: DocItem['uploads'][string]
  token: string
  documentTypeId: number
  slotLabel: 'es' | 'en'
  phaseLabel?: string
  fromPreviousPhase: boolean
  onPreview: (file: { id: string; name: string }) => void
  onDelete: (id: string) => Promise<void>
  onChange: () => void
  onError: (msg: string) => void
}

function SlotSection({
  label,
  iconName,
  files,
  token,
  documentTypeId,
  slotLabel,
  phaseLabel,
  fromPreviousPhase,
  onPreview,
  onDelete,
  onChange,
  onError,
}: SlotSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, color: 'var(--color-ulp-on-surface-variant)' }}
          >
            {iconName}
          </span>
          <p className="ulp-label" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            {label}
          </p>
        </div>
        {files.length === 0 && (
          <UploadButton
            token={token}
            documentTypeId={documentTypeId}
            slotLabel={slotLabel}
            label={slotLabel === 'es' ? 'Subir original' : 'Subir traducción'}
            variant="ghost"
            onUploaded={onChange}
            onError={onError}
          />
        )}
      </div>
      {files.length > 0 && (
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
              fromPreviousPhase={fromPreviousPhase}
              phaseLabel={phaseLabel}
            />
          ))}
        </div>
      )}
    </section>
  )
}

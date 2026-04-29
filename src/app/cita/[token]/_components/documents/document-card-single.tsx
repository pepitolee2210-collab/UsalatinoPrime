'use client'

import { STATUS_VISUAL, type DocItem } from './types'
import { FileRow } from './file-row'
import { UploadButton } from './upload-button'

interface DocumentCardSingleProps {
  doc: DocItem
  token: string
  phaseLabel?: string
  onPreview: (file: { id: string; name: string }) => void
  onDelete: (id: string) => Promise<void>
  onChange: () => void
  onError: (msg: string) => void
}

/**
 * Card para document_type con slot_kind=single (un solo archivo).
 */
export function DocumentCardSingle({
  doc,
  token,
  phaseLabel,
  onPreview,
  onDelete,
  onChange,
  onError,
}: DocumentCardSingleProps) {
  const visual = STATUS_VISUAL[doc.status]
  const files = doc.uploads.default ?? []

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
          </div>
          <StatusBadge visual={visual} />
        </header>

        {files.length > 0 ? (
          <div className="space-y-1.5 mt-3">
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
        ) : (
          <div className="flex justify-end mt-3">
            <UploadButton
              token={token}
              documentTypeId={doc.type_id}
              label="Subir archivo"
              onUploaded={onChange}
              onError={onError}
            />
          </div>
        )}

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

function StatusBadge({ visual }: { visual: typeof STATUS_VISUAL[keyof typeof STATUS_VISUAL] }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0"
      style={{ background: visual.bg, color: visual.textColor }}
    >
      <span className="material-symbols-outlined" data-fill="1" style={{ fontSize: 12 }}>
        {visual.icon}
      </span>
      {visual.label}
    </span>
  )
}

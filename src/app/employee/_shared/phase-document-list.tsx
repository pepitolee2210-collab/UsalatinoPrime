'use client'

import { Eye, Download } from 'lucide-react'
import type { UploadFile } from './phase-types'
import type { PhaseKey } from './phase-tokens'

interface PhaseDocumentListProps {
  phase: PhaseKey
  uploads: UploadFile[]
  onPreview: (doc: UploadFile) => void
  emptyMessage?: string
}

const STATUS_LABEL: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending:            { label: 'Pendiente',         bg: 'var(--admin-bg-elev-2)',     text: 'var(--admin-fg-muted)', border: 'var(--admin-border-strong)' },
  uploaded:           { label: 'En revisión',       bg: 'var(--admin-gold-soft)',     text: 'var(--admin-gold)',     border: 'var(--admin-gold-border, var(--admin-gold))' },
  in_review:          { label: 'En revisión',       bg: 'var(--admin-gold-soft)',     text: 'var(--admin-gold)',     border: 'var(--admin-gold-border, var(--admin-gold))' },
  approved:           { label: 'Aprobado',          bg: 'var(--admin-green-soft)',    text: 'var(--admin-green)',    border: 'var(--admin-green)' },
  rejected:           { label: 'Rechazado',         bg: 'var(--admin-red-soft)',      text: 'var(--admin-red)',      border: 'var(--admin-red)' },
  needs_translation:  { label: 'Falta traducción',  bg: 'var(--admin-gold-soft)',     text: 'var(--admin-gold)',     border: 'var(--admin-gold-border, var(--admin-gold))' },
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function PhaseDocumentList({ uploads, onPreview, emptyMessage }: PhaseDocumentListProps) {
  if (uploads.length === 0) {
    return (
      <p
        className="text-center py-4"
        style={{ fontSize: 12, color: 'var(--admin-fg-subtle)' }}
      >
        {emptyMessage ?? 'Sin archivos en esta fase.'}
      </p>
    )
  }

  // Agrupar por document_type para presentar mejor
  const byType = new Map<string, UploadFile[]>()
  for (const u of uploads) {
    const key = u.document_type_name_es ?? u.category_name_es ?? 'Otros'
    const list = byType.get(key) ?? []
    list.push(u)
    byType.set(key, list)
  }

  return (
    <div className="space-y-4">
      {Array.from(byType.entries()).map(([groupName, files]) => (
        <div key={groupName} className="space-y-2">
          <p
            style={{
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: 'var(--admin-fg-subtle)',
              textTransform: 'uppercase',
            }}
          >
            {groupName}{' '}
            <span
              style={{
                color: 'var(--admin-fg-subtle)',
                fontWeight: 500,
                textTransform: 'none',
                letterSpacing: 'normal',
              }}
            >
              · {files.length} archivo{files.length === 1 ? '' : 's'}
            </span>
          </p>
          <ul className="space-y-1.5">
            {files.map(doc => {
              const status = STATUS_LABEL[doc.status] ?? STATUS_LABEL.uploaded
              const isPDF = doc.name.toLowerCase().endsWith('.pdf')
              const icon = isPDF ? 'picture_as_pdf' : doc.file_type?.startsWith('image/') ? 'image' : 'description'
              return (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg transition-colors"
                  style={{
                    background: 'var(--admin-bg-elev)',
                    border: '0.5px solid var(--admin-border)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-bg-elev-2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--admin-bg-elev)' }}
                >
                  <span
                    className="material-symbols-outlined flex-shrink-0"
                    style={{ fontSize: 22, color: 'var(--admin-fg-muted)' }}
                  >
                    {icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="truncate"
                      style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-fg)' }}
                    >
                      {doc.slot_label || doc.name}
                    </p>
                    <div
                      className="flex items-center gap-2 mt-0.5"
                      style={{ fontSize: 11, color: 'var(--admin-fg-muted)' }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono-tech)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {formatBytes(doc.file_size)}
                      </span>
                      <span>·</span>
                      <span
                        className="px-1.5 py-0.5 rounded"
                        style={{
                          background: status.bg,
                          color: status.text,
                          border: `0.5px solid ${status.border}`,
                          fontFamily: 'var(--font-mono-tech)',
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                        }}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPreview(doc)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      color: 'var(--admin-fg-muted)',
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-bg-deep)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    title="Vista previa"
                    aria-label="Vista previa"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href={`/api/employee/download-case-doc?id=${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    style={{ color: 'var(--admin-fg-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-bg-deep)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    title="Descargar"
                    aria-label="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

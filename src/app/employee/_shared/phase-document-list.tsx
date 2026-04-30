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

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-gray-100 text-gray-600' },
  uploaded: { label: 'En revisión', className: 'bg-amber-100 text-amber-700' },
  in_review: { label: 'En revisión', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Aprobado', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazado', className: 'bg-rose-100 text-rose-700' },
  needs_translation: { label: 'Falta traducción', className: 'bg-orange-100 text-orange-700' },
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
      <p className="text-xs text-gray-400 text-center py-4">{emptyMessage ?? 'Sin archivos en esta fase.'}</p>
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
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {groupName} <span className="text-gray-400 font-medium normal-case tracking-normal">· {files.length} archivo{files.length === 1 ? '' : 's'}</span>
          </p>
          <ul className="space-y-1.5">
            {files.map(doc => {
              const status = STATUS_LABEL[doc.status] ?? STATUS_LABEL.uploaded
              const isPDF = doc.name.toLowerCase().endsWith('.pdf')
              const icon = isPDF ? 'picture_as_pdf' : doc.file_type?.startsWith('image/') ? 'image' : 'description'
              return (
                <li
                  key={doc.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-white transition-colors hover:bg-gray-50`}
                  style={{ borderLeftWidth: 3 }}
                >
                  <span
                    className="material-symbols-outlined flex-shrink-0"
                    style={{ fontSize: 22, color: 'rgb(107, 114, 128)' }}
                  >
                    {icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.slot_label || doc.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                      <span>{formatBytes(doc.file_size)}</span>
                      <span>·</span>
                      <span className={`px-1.5 py-0.5 rounded ${status.className}`}>{status.label}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPreview(doc)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
                    title="Vista previa"
                    aria-label="Vista previa"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href={`/api/employee/download-case-doc?id=${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
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

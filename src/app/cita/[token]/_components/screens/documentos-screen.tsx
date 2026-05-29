'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { DocumentProgressDonut } from '../documents/document-progress-donut'
import { DocumentSectionAccordion } from '../documents/document-section-accordion'
import { DocumentCardSingle } from '../documents/document-card-single'
import { DocumentCardDual } from '../documents/document-card-dual'
import { DocumentCardMultiple } from '../documents/document-card-multiple'
import { PreviewModal } from '../documents/preview-modal'
import { UploadInstructionsBanner } from '../documents/upload-instructions-banner'
import { deleteClientDocument } from '../documents/upload-client'
import type { DocItem, RequiredDocsResponse, UploadFile } from '../documents/types'
import { formatBytes, fileTypeIcon } from '../documents/types'
import type { CasePhase } from '@/types/database'

interface DocumentosScreenProps {
  token: string
  serviceSlug: string
}

const PHASE_LABEL: Record<CasePhase, string> = {
  custodia: 'Custodia',
  i360: 'I-360',
  i485: 'I-485',
  completado: 'fase anterior',
  asilo_sustentos: 'Sustentos',
  asilo_reforzar: 'Reforzar Asilo',
  asilo_completado: 'fase anterior',
  apelacion: 'Apelación',
  cambio_de_corte: 'Cambio de Corte',
}

export function DocumentosScreen({ token }: DocumentosScreenProps) {
  const [data, setData] = useState<RequiredDocsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewDoc, setPreviewDoc] = useState<{ id: string; name: string } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/cita/${encodeURIComponent(token)}/required-documents`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        throw new Error('Error al cargar documentos')
      }
      const json: RequiredDocsResponse = await res.json()
      setData(json)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDelete = useCallback(
    async (docId: string) => {
      try {
        await deleteClientDocument(token, docId)
        toast.success('Archivo eliminado')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al eliminar')
      }
    },
    [token],
  )

  const handleChange = useCallback(() => {
    fetchData()
  }, [fetchData])

  const handleError = useCallback((msg: string) => {
    toast.error(msg)
  }, [])

  if (loading) {
    return (
      <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto">
        <SkeletonHero />
      </div>
    )
  }

  if (!data || !data.current_phase) {
    return (
      <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto space-y-6">
        <header>
          <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
            Tus documentos
          </p>
          <h1 className="ulp-h2 italic mt-1" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
            Mis Documentos
          </h1>
        </header>
        <UploadInstructionsBanner />
        <EmptyState
          icon="hourglass_empty"
          title="Tu equipo aún no ha asignado tu fase"
          description="Cuando tu asesora legal asigne tu fase, los documentos requeridos aparecerán automáticamente."
        />
      </div>
    )
  }

  if (data.categories.length === 0) {
    return (
      <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto space-y-6">
        <header>
          <h1 className="ulp-h2 italic" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
            Mis Documentos
          </h1>
        </header>
        <UploadInstructionsBanner />
        <EmptyState
          icon="task_alt"
          title="Sin documentos pendientes"
          description="No hay documentos requeridos para tu fase actual."
        />
      </div>
    )
  }

  const phaseLabel = data.current_phase ? PHASE_LABEL[data.current_phase] : undefined

  return (
    <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto space-y-6">
      <header>
        <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
          Tus documentos
        </p>
        <h1 className="ulp-h2 italic mt-1" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
          Mis Documentos
        </h1>
        <p className="ulp-body-md mt-2" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          Sube los documentos requeridos para tu fase de{' '}
          <strong>{phaseLabel?.toLowerCase()}</strong>. Solo se aceptan archivos PDF escaneados.
        </p>
      </header>

      <UploadInstructionsBanner />

      <section
        className="rounded-2xl border p-5 flex items-center justify-between"
        style={{
          background: 'var(--color-ulp-surface-container-lowest)',
          borderColor: 'var(--color-ulp-outline-variant)',
        }}
      >
        <div>
          <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
            Tu progreso
          </p>
          <p className="ulp-body-sm mt-1" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            {data.total_completed} de {data.total_required} documentos completados.
          </p>
        </div>
        <DocumentProgressDonut completed={data.total_completed} total={data.total_required} size={88} />
      </section>

      <div className="space-y-3">
        {data.member_groups && data.member_groups.length > 0 ? (
          // Asilo Político: agrupar por miembro de familia.
          data.member_groups.map((mg, idx) => {
            const hasPending = mg.docs.some((d) => d.status === 'pending' || d.status === 'rejected')
            const defaultOpen = idx === 0 && hasPending
            // Adaptamos MemberGroup → CategoryGroup para reusar DocumentSectionAccordion
            // sin tener que crear un componente nuevo idéntico.
            const adaptedCategory = {
              code: `mg_${mg.role}_${mg.member_index ?? 'na'}`,
              name_es: mg.label,
              icon: mg.icon,
              total_required: mg.total_required,
              total_completed: mg.total_completed,
              docs: mg.docs,
            }
            return (
              <DocumentSectionAccordion
                key={adaptedCategory.code}
                category={adaptedCategory}
                defaultOpen={defaultOpen}
              >
                {mg.docs.map((doc) => (
                  <DocCardRouter
                    key={`${doc.type_id}:${doc.member_role ?? 'general'}:${doc.member_index ?? 'na'}`}
                    doc={doc}
                    token={token}
                    phaseLabel={phaseLabel}
                    onPreview={setPreviewDoc}
                    onDelete={handleDelete}
                    onChange={handleChange}
                    onError={handleError}
                  />
                ))}
              </DocumentSectionAccordion>
            )
          })
        ) : (
          // SIJS y servicios sin agrupamiento por miembro: categorías legales tradicionales.
          data.categories.map((category, idx) => {
            const hasPending = category.docs.some((d) => d.status === 'pending' || d.status === 'rejected')
            const defaultOpen = idx === 0 && hasPending
            return (
              <DocumentSectionAccordion
                key={category.code}
                category={category}
                defaultOpen={defaultOpen}
              >
                {category.docs.map((doc) => (
                  <DocCardRouter
                    key={`${doc.type_id}:${doc.member_role ?? 'general'}:${doc.member_index ?? 'na'}`}
                    doc={doc}
                    token={token}
                    phaseLabel={phaseLabel}
                    onPreview={setPreviewDoc}
                    onDelete={handleDelete}
                    onChange={handleChange}
                    onError={handleError}
                  />
                ))}
              </DocumentSectionAccordion>
            )
          })
        )}

        {data.extra_documents && data.extra_documents.length > 0 && (
          <ExtraDocumentsSection
            files={data.extra_documents}
            onPreview={setPreviewDoc}
          />
        )}
      </div>

      <PreviewModal token={token} doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  )
}

interface DocCardRouterProps {
  doc: DocItem
  token: string
  phaseLabel?: string
  onPreview: (file: { id: string; name: string }) => void
  onDelete: (id: string) => Promise<void>
  onChange: () => void
  onError: (msg: string) => void
}

function DocCardRouter(props: DocCardRouterProps) {
  switch (props.doc.slot_kind) {
    case 'single':
      return <DocumentCardSingle {...props} />
    case 'dual_es_en':
      return <DocumentCardDual {...props} />
    case 'multiple_named':
      return <DocumentCardMultiple {...props} />
    default:
      return null
  }
}

function SkeletonHero() {
  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border p-5 h-24 animate-pulse"
        style={{
          background: 'var(--color-ulp-surface-container-low)',
          borderColor: 'var(--color-ulp-outline-variant)',
        }}
      />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border p-4 h-20 animate-pulse"
          style={{
            background: 'var(--color-ulp-surface-container-low)',
            borderColor: 'var(--color-ulp-outline-variant)',
          }}
        />
      ))}
    </div>
  )
}

/**
 * Sección read-only para documentos del cliente sin `document_type_id` —
 * típicamente añadidos al expediente por el equipo legal desde su panel admin
 * o employee. El cliente puede verlos/previsualizarlos pero no eliminarlos.
 */
function ExtraDocumentsSection({
  files,
  onPreview,
}: {
  files: UploadFile[]
  onPreview: (file: { id: string; name: string }) => void
}) {
  return (
    <section
      className="rounded-2xl border overflow-hidden"
      style={{
        background: 'var(--color-ulp-surface-container-lowest)',
        borderColor: 'var(--color-ulp-outline-variant)',
        borderLeftWidth: 4,
        borderLeftColor: 'var(--color-ulp-outline)',
      }}
    >
      <header
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: 'var(--color-ulp-surface-container-low)' }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 20, color: 'var(--color-ulp-on-surface-variant)' }}
        >
          folder_open
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="ulp-body-md font-semibold" style={{ color: 'var(--color-ulp-on-surface)' }}>
            Otros documentos de tu expediente
          </h3>
          <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            Tu equipo legal añadió estos archivos a tu caso.
          </p>
        </div>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: 'var(--color-ulp-surface-container-high)',
            color: 'var(--color-ulp-on-surface-variant)',
          }}
        >
          {files.length}
        </span>
      </header>
      <ul className="divide-y" style={{ borderColor: 'var(--color-ulp-outline-variant)' }}>
        {files.map((f) => (
          <li key={f.id} className="px-4 py-3 flex items-center gap-3">
            <span
              className="material-symbols-outlined flex-shrink-0"
              style={{ fontSize: 22, color: 'var(--color-ulp-on-surface-variant)' }}
            >
              {fileTypeIcon(f.file_type)}
            </span>
            <button
              type="button"
              onClick={() => onPreview({ id: f.id, name: f.name })}
              className="flex-1 min-w-0 text-left hover:underline"
            >
              <p
                className="ulp-body-sm font-medium truncate"
                style={{ color: 'var(--color-ulp-on-surface)' }}
              >
                {f.name}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
                {formatBytes(f.file_size)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div
      className="rounded-2xl border p-8 text-center space-y-3"
      style={{
        background: 'var(--color-ulp-surface-container-low)',
        borderColor: 'var(--color-ulp-outline-variant)',
      }}
    >
      <span
        className="material-symbols-outlined block mx-auto"
        style={{ fontSize: 56, color: 'var(--color-ulp-outline)' }}
      >
        {icon}
      </span>
      <p className="ulp-body-md font-semibold" style={{ color: 'var(--color-ulp-on-surface)' }}>
        {title}
      </p>
      <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
        {description}
      </p>
    </div>
  )
}

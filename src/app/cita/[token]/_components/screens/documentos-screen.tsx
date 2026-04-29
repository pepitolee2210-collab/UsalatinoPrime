'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { DocumentProgressDonut } from '../documents/document-progress-donut'
import { DocumentSectionAccordion } from '../documents/document-section-accordion'
import { DocumentCardSingle } from '../documents/document-card-single'
import { DocumentCardDual } from '../documents/document-card-dual'
import { DocumentCardMultiple } from '../documents/document-card-multiple'
import { PreviewModal } from '../documents/preview-modal'
import { deleteClientDocument } from '../documents/upload-client'
import type { DocItem, RequiredDocsResponse } from '../documents/types'
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
      <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto">
        <header className="mb-6">
          <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
            Tus documentos
          </p>
          <h1 className="ulp-h2 italic mt-1" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
            Mis Documentos
          </h1>
        </header>
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
      <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto">
        <header className="mb-6">
          <h1 className="ulp-h2 italic" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
            Mis Documentos
          </h1>
        </header>
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
          <strong>{phaseLabel?.toLowerCase()}</strong>. Acepta PDF, JPG, PNG, WebP y HEIC.
        </p>
      </header>

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
        {data.categories.map((category, idx) => {
          // Abre por defecto la primera categoría con docs pendientes
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
                  key={doc.type_id}
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
        })}
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

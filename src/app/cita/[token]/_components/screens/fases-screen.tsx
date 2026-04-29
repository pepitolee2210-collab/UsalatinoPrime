'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { FormCard } from '../forms/form-card'
import { FormRunner } from '../forms/form-runner'
import { ClientStoryWizard } from '../../client-story-wizard'
import type { CasePhase } from '@/types/database'
import type { RequiredFormsResponse, FormSummary } from '../forms/types'

interface FasesScreenProps {
  token: string
  clientName: string
  currentPhase: CasePhase | null
}

const PHASE_HEADERS: Record<CasePhase, { number: string; title: string; description: string }> = {
  custodia: {
    number: 'Fase 01',
    title: 'Custodia',
    description: 'Formularios para obtener la orden de custodia con hallazgos SIJS.',
  },
  i360: {
    number: 'Fase 02',
    title: 'I-360',
    description: 'Formularios para la petición ante USCIS.',
  },
  i485: {
    number: 'Fase 03',
    title: 'I-485',
    description: 'Formularios para el ajuste de estatus.',
  },
  completado: {
    number: 'Completado',
    title: 'Proceso completado',
    description: 'Ya no quedan formularios por llenar.',
  },
}

export function FasesScreen({ token, clientName, currentPhase }: FasesScreenProps) {
  const [data, setData] = useState<RequiredFormsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [storyOpen, setStoryOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/cita/${encodeURIComponent(token)}/required-forms`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Error al cargar formularios')
      const j: RequiredFormsResponse = await res.json()
      setData(j)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const header = currentPhase ? PHASE_HEADERS[currentPhase] : null

  if (loading) {
    return (
      <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto space-y-4">
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--color-ulp-surface-container-low)' }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--color-ulp-surface-container-low)' }} />
        ))}
      </div>
    )
  }

  if (!data || !data.current_phase || data.forms.length === 0) {
    return (
      <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto">
        {header ? (
          <header className="mb-6">
            <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
              {header.number}
            </p>
            <h1 className="ulp-h1 italic mt-1" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
              {header.title}
            </h1>
          </header>
        ) : (
          <header className="mb-6">
            <h1 className="ulp-h2 italic" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
              Fases
            </h1>
          </header>
        )}
        <EmptyState />
      </div>
    )
  }

  const totalUserFields = data.forms.reduce((s, f) => s + f.total_user_fields, 0)
  const completedFields = data.forms.reduce((s, f) => s + f.completed_user_fields, 0)
  const pct = totalUserFields === 0 ? 100 : Math.round((completedFields / totalUserFields) * 100)

  const handleOpen = (form: FormSummary) => {
    if (form.is_special_story) {
      setStoryOpen(true)
      return
    }
    setOpenSlug(form.slug)
  }

  return (
    <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto space-y-5">
      {header && (
        <header>
          <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
            {header.number}
          </p>
          <h1 className="ulp-h1 italic mt-1" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
            {header.title}
          </h1>
          <p className="ulp-body-md mt-2" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            {header.description}
            {data.state_us && (
              <>
                {' '}Aplican formularios de <strong>{data.state_us}</strong>.
              </>
            )}
          </p>
          <div className="mt-4">
            <div className="flex justify-between items-baseline mb-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-ulp-outline)' }}>
                Progreso global de la fase
              </p>
              <p className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--color-ulp-primary)' }}>
                {pct}%
              </p>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-ulp-secondary-fixed-dim)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: 'var(--color-ulp-primary)',
                }}
              />
            </div>
          </div>
        </header>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.forms.map((form) => (
          <FormCard key={form.slug} form={form} onOpen={() => handleOpen(form)} />
        ))}
      </section>

      {openSlug && (
        <FormRunner
          token={token}
          slug={openSlug}
          onClose={() => setOpenSlug(null)}
          onSubmitted={() => fetchData()}
        />
      )}

      {storyOpen && (
        <StoryFullscreen onClose={() => { setStoryOpen(false); fetchData() }}>
          <ClientStoryWizard token={token} clientName={clientName} declarationDocs={[]} />
        </StoryFullscreen>
      )}
    </div>
  )
}

function StoryFullscreen({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex flex-col" onClick={onClose}>
      <div
        className="mt-auto sm:mt-12 sm:mx-auto bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-3xl flex-1 sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 flex items-center gap-3 border-b" style={{ borderColor: 'var(--color-ulp-outline-variant)' }}>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-ulp-surface-container)' }}
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
          <h2 className="ulp-body-md font-bold flex-1 truncate" style={{ color: 'var(--color-ulp-on-surface)' }}>
            Mi Historia — Declaración Jurada
          </h2>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl border p-8 text-center space-y-3"
      style={{
        background: 'var(--color-ulp-surface-container-low)',
        borderColor: 'var(--color-ulp-outline-variant)',
      }}
    >
      <span className="material-symbols-outlined block mx-auto" style={{ fontSize: 56, color: 'var(--color-ulp-outline)' }}>
        hourglass_empty
      </span>
      <p className="ulp-body-md font-semibold">Tu equipo aún no ha asignado formularios</p>
      <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
        Cuando tu asesora legal active tu fase, los formularios aparecerán automáticamente.
      </p>
    </div>
  )
}

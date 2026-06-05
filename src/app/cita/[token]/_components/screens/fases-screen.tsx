'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { FormCard } from '../forms/form-card'
import { FormRunner } from '../forms/form-runner'
import { PortalSheet } from '../portal-sheet'
import { ClientStoryWizard } from '../../client-story-wizard'
import { I360WizardCore, type I360FormData } from '@/components/i360/I360WizardCore'
import { I589PartAWizardCore } from '@/components/i589/I589PartAWizardCore'
import { EvidenceUrlsManager } from '../evidence-urls-manager'
import { CartaCambioCorteClientWizard } from '../carta-cambio-corte-wizard'
import { CredibleFearQuestionnaireWizard } from '../forms/credible-fear-questionnaire-wizard'
import { WitnessLettersWizard } from '../forms/witness-letters-wizard'
import type { CasePhase } from '@/types/database'
import type { RequiredFormsResponse, FormSummary } from '../forms/types'

interface I360DataResponse {
  form_data: I360FormData
  status: string | null
  prefill_sources: Record<string, Record<string, unknown>>
}

// Shape del response del endpoint /api/cita/[token]/i589-data.
// (No exportamos por separado; vive solo en este screen.)
interface I589DataResponse {
  case_id: string
  parts: Record<'a1' | 'a2' | 'a3' | 'a4', {
    form_data: Record<string, unknown>
    status: string | null
    updated_at: string | null
    submitted_at: string | null
    admin_notes: string | null
  }>
  prefill_sources: {
    profile: Record<string, unknown> | null
    contract: Record<string, unknown> | null
  }
}

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
  matrimonio_i130: {
    number: 'Fase 01',
    title: 'Petición (I-130)',
    description: 'Formulario I-130 (petición de familiar) por tu matrimonio con un ciudadano.',
  },
  matrimonio_i485: {
    number: 'Fase 02',
    title: 'Ajuste (I-485)',
    description: 'Formulario I-485 para el ajuste de estatus y obtener la Green Card.',
  },
  asilo_sustentos: {
    number: 'Fase 01',
    title: 'Sustentos',
    description: 'Formularios I-589 (partes 1-5) y documentos de identidad.',
  },
  asilo_reforzar: {
    number: 'Fase 02',
    title: 'Reforzar Asilo',
    description: 'Declaración jurada, evidencias y Miedo Creíble.',
  },
  asilo_completado: {
    number: 'Completado',
    title: 'Proceso completado',
    description: 'Expediente presentado ante USCIS.',
  },
  apelacion: {
    number: 'Fase única',
    title: 'Apelación',
    description: 'Formularios EOIR-26 y EOIR-26A (opcional) para presentar tu apelación ante la BIA.',
  },
  cambio_de_corte: {
    number: 'Fase única',
    title: 'Cambio de Corte',
    description: 'Formulario EOIR-33 para notificar tu cambio de domicilio o solicitar transferencia de venue.',
  },
}

export function FasesScreen({ token, clientName, currentPhase }: FasesScreenProps) {
  const [data, setData] = useState<RequiredFormsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [storyOpen, setStoryOpen] = useState(false)
  const [i360Open, setI360Open] = useState(false)
  const [i360Data, setI360Data] = useState<I360DataResponse | null>(null)
  const [i360Loading, setI360Loading] = useState(false)
  const [i589Open, setI589Open] = useState(false)
  const [i589Data, setI589Data] = useState<I589DataResponse | null>(null)
  const [i589Loading, setI589Loading] = useState(false)
  const [urlsOpen, setUrlsOpen] = useState(false)
  const [ccCartaOpen, setCcCartaOpen] = useState(false)
  const [credibleFearOpen, setCredibleFearOpen] = useState(false)
  const [witnessOpen, setWitnessOpen] = useState(false)

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

  const handleOpen = async (form: FormSummary) => {
    if (form.is_special_story) {
      setStoryOpen(true)
      return
    }
    if (form.is_special_i360) {
      setI360Loading(true)
      try {
        const res = await fetch(`/api/cita/${encodeURIComponent(token)}/i360-data`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('No se pudo cargar el formulario')
        const json: I360DataResponse = await res.json()
        setI360Data(json)
        setI360Open(true)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al abrir el formulario')
      } finally {
        setI360Loading(false)
      }
      return
    }
    if (form.is_special_i589) {
      // Wizard I-589 Parte A — abre fullscreen con 4 steps.
      setI589Loading(true)
      try {
        const res = await fetch(`/api/cita/${encodeURIComponent(token)}/i589-data`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('No se pudo cargar el formulario I-589')
        const json: I589DataResponse = await res.json()
        setI589Data(json)
        setI589Open(true)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al abrir el formulario')
      } finally {
        setI589Loading(false)
      }
      return
    }
    if (form.is_special_evidence_urls) {
      // Manager de URLs de evidencia (Fase 2 Asilo Político).
      setUrlsOpen(true)
      return
    }
    if (form.is_special_credible_fear_questionnaire) {
      // Cuestionario Miedo Creíble (Fase 2 Asilo Político / Reforzar Asilo).
      setCredibleFearOpen(true)
      return
    }
    if (form.is_special_witness_form) {
      // Formulario de Testigos (Fase 2 Asilo Político / Reforzar Asilo).
      setWitnessOpen(true)
      return
    }
    if (form.is_special_cc_carta) {
      // Carta de Cambio de Corte — wizard cliente bidireccional con admin.
      setCcCartaOpen(true)
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
        <PortalSheet
          title="Mi Historia — Declaración Jurada"
          onClose={() => { setStoryOpen(false); fetchData() }}
        >
          <ClientStoryWizard token={token} clientName={clientName} declarationDocs={[]} />
        </PortalSheet>
      )}

      {i360Open && i360Data && (
        <PortalSheet
          title="Form I-360 — Petición SIJS"
          onClose={() => { setI360Open(false); fetchData() }}
        >
          <I360WizardCore
            mode="client"
            token={token}
            clientName={clientName}
            initialData={i360Data.form_data}
            prefillSources={i360Data.prefill_sources}
            initialStatus={i360Data.status}
            onSaved={fetchData}
            onClose={() => { setI360Open(false); fetchData() }}
          />
        </PortalSheet>
      )}

      {i360Loading && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="rounded-2xl bg-white px-6 py-4 shadow-xl flex items-center gap-3">
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 22 }}>progress_activity</span>
            <span className="text-sm font-medium text-gray-700">Cargando tu formulario…</span>
          </div>
        </div>
      )}

      {i589Open && i589Data && (
        <PortalSheet
          title="Formulario I-589 — Páginas 1 a 4"
          onClose={() => { setI589Open(false); fetchData() }}
        >
          <I589PartAWizardCore
            token={token}
            initialData={i589Data}
            onSuccess={() => { setI589Open(false); fetchData() }}
            onClose={() => { setI589Open(false); fetchData() }}
          />
        </PortalSheet>
      )}

      {i589Loading && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="rounded-2xl bg-white px-6 py-4 shadow-xl flex items-center gap-3">
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 22 }}>progress_activity</span>
            <span className="text-sm font-medium text-gray-700">Cargando tu formulario I-589…</span>
          </div>
        </div>
      )}

      {urlsOpen && (
        <PortalSheet
          title="Enlaces de noticias y evidencia"
          onClose={() => { setUrlsOpen(false); fetchData() }}
        >
          <div className="px-6 py-6 max-w-2xl mx-auto">
            <p className="text-sm text-gray-600 mb-4">
              Pega URLs de noticias, reportes de DD.HH., o publicaciones que respalden tu caso.
              La IA legal usará estas fuentes al generar tu relato de Miedo Creíble.
            </p>
            <EvidenceUrlsManager token={token} />
          </div>
        </PortalSheet>
      )}

      {ccCartaOpen && data && (
        <PortalSheet
          title="Carta de Cambio de Corte (6 págs)"
          onClose={() => { setCcCartaOpen(false); fetchData() }}
        >
          <CartaCambioCorteClientWizard
            token={token}
            caseId={data.case_id}
            clientName={clientName}
          />
        </PortalSheet>
      )}

      {credibleFearOpen && (
        <PortalSheet
          title="Cuestionario Miedo Creíble (M1-M11)"
          onClose={() => { setCredibleFearOpen(false); fetchData() }}
        >
          <CredibleFearQuestionnaireWizard
            token={token}
            onClose={() => { setCredibleFearOpen(false); fetchData() }}
          />
        </PortalSheet>
      )}

      {witnessOpen && (
        <PortalSheet
          title="Cartas de Testigos"
          onClose={() => { setWitnessOpen(false); fetchData() }}
        >
          <WitnessLettersWizard
            token={token}
            onClose={() => { setWitnessOpen(false); fetchData() }}
          />
        </PortalSheet>
      )}
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

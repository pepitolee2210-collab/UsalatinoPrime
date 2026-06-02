'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EvidenceUrlsManager } from '../evidence-urls-manager'
import { CredibleFearQuestionnaireWizard } from '../forms/credible-fear-questionnaire-wizard'
import { PortalSheet } from '../portal-sheet'

interface ReforzarScreenProps {
  token: string
  clientName: string
}

interface QuestionnaireSummary {
  progress: {
    pct: number
    modulesComplete: number
    modulesTotal: number
    answeredRequired: number
    totalRequired: number
  }
  status: string | null
  locked_for_client: boolean
}

interface ValidationIssue {
  severity: 'blocker' | 'warning'
  module: string
  message: string
}

interface ValidationData {
  ready: boolean
  blockers: ValidationIssue[]
  warnings: ValidationIssue[]
}

interface CredibleFearDraft {
  id: string
  version: number
  body_md: string
  sources: Array<{ url: string; title: string }>
  generated_at: string
  edited_by_diana: boolean
}

interface ScreenContext {
  questionnaire: QuestionnaireSummary | null
  validation: ValidationData | null
  draft: CredibleFearDraft | null
  documentsByCategory: Record<string, number>
}

const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  documentos_legales: 'Identificación e inmigración',
  sobre_la_familia: 'Familia',
  evidencia_situacion: 'Evidencia de persecución',
  pruebas_membresia: 'Pruebas de mi identidad / grupo',
  cartas_testigos: 'Cartas de testigos',
  documentos_viaje: 'Viaje y tránsito',
}

/**
 * Pantalla de Fase 2 (Reforzar Asilo) del cliente.
 *
 * El flujo v5 reemplaza el viejo upload manual del "affidavit personal" por
 * un cuestionario guiado de 11 módulos. Esta pantalla ahora es un dashboard
 * que muestra:
 *   1. Progreso del cuestionario + CTA a la pestaña Formularios.
 *   2. URLs de evidencia (quick-add legacy + alias del M9).
 *   3. Resumen de documentos subidos por categoría.
 *   4. Validación pre-generación (qué falta para que la firma pueda generar).
 *   5. Preview del último Miedo Creíble generado.
 */
export function ReforzarScreen({ token, clientName }: ReforzarScreenProps) {
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [ctx, setCtx] = useState<ScreenContext>({
    questionnaire: null,
    validation: null,
    draft: null,
    documentsByCategory: {},
  })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [qRes, validationRes, draftRes, docsRes] = await Promise.all([
        fetch(`/api/cita/${encodeURIComponent(token)}/asilo-miedo-creible`, { cache: 'no-store' }),
        fetch(`/api/cita/${encodeURIComponent(token)}/asilo-miedo-creible/validation`, { cache: 'no-store' }),
        fetch(`/api/cita/${encodeURIComponent(token)}/credible-fear-current`, { cache: 'no-store' }),
        fetch(`/api/cita/${encodeURIComponent(token)}/required-documents`, { cache: 'no-store' }),
      ])

      const qJson = qRes.ok ? await qRes.json() : null
      const validationJson = validationRes.ok ? await validationRes.json() : null
      const draftJson = draftRes.ok ? await draftRes.json() : null
      const docsJson = docsRes.ok ? await docsRes.json() : null

      const documentsByCategory: Record<string, number> = {}
      if (docsJson?.categories) {
        for (const cat of docsJson.categories as Array<{ category_code: string; docs?: Array<{ uploads?: Record<string, unknown[]> }> }>) {
          let count = 0
          for (const d of cat.docs ?? []) {
            count += Object.values(d.uploads ?? {}).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0)
          }
          if (count > 0) documentsByCategory[cat.category_code] = count
        }
      }

      setCtx({
        questionnaire: qJson
          ? {
              progress: qJson.progress,
              status: qJson.status,
              locked_for_client: qJson.locked_for_client,
            }
          : null,
        validation: validationJson,
        draft: draftJson?.draft ?? null,
        documentsByCategory,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  if (loading) {
    return (
      <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto space-y-4">
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--color-ulp-surface-container-low)' }} />
        <div className="h-48 rounded-2xl animate-pulse" style={{ background: 'var(--color-ulp-surface-container-low)' }} />
      </div>
    )
  }

  const qPct = ctx.questionnaire?.progress.pct ?? 0
  const modulesDone = ctx.questionnaire?.progress.modulesComplete ?? 0
  const modulesTotal = ctx.questionnaire?.progress.modulesTotal ?? 11

  return (
    <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto space-y-6">
      <header>
        <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
          Fase 02
        </p>
        <h1 className="ulp-h1 italic mt-1" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
          Reforzar Asilo
        </h1>
        <p className="ulp-body-md mt-2" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          Hola {clientName}. En esta fase tu equipo legal usará tus respuestas
          y tu evidencia para redactar el relato formal del Miedo Creíble que
          va a USCIS. Tú nos das la información, nosotros la organizamos.
        </p>
      </header>

      {/* 1. Cuestionario */}
      <section className="rounded-2xl border bg-white p-5 space-y-3" style={{ borderColor: 'var(--color-ulp-outline-variant)' }}>
        <header className="flex items-start gap-3">
          <span className="material-symbols-outlined text-purple-700" data-fill="1" style={{ fontSize: 22 }}>
            shield_person
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-900">
              1. Cuestionario Miedo Creíble (M1-M11)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              11 módulos guiados sobre tu historia. La IA legal y tu abogada los usan para escribir tu declaración.
            </p>
          </div>
        </header>

        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-ulp-outline)' }}>
              Tu progreso
            </p>
            <p className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--color-ulp-primary)' }}>
              {modulesDone}/{modulesTotal} módulos · {qPct}%
            </p>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-ulp-secondary-fixed-dim)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${qPct}%`, background: 'var(--color-ulp-primary)' }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="w-full px-4 py-2.5 rounded-full text-sm font-bold"
          style={{
            background: qPct >= 100 ? 'var(--color-ulp-surface-container)' : 'var(--color-ulp-primary-container)',
            color: qPct >= 100 ? 'var(--color-ulp-on-surface)' : 'var(--color-ulp-on-primary-container)',
          }}
        >
          {qPct >= 100 ? 'Revisar mis respuestas' : 'Continuar cuestionario'}
        </button>
      </section>

      {/* 2. URLs de evidencia */}
      <section className="rounded-2xl border bg-white p-5 space-y-3" style={{ borderColor: 'var(--color-ulp-outline-variant)' }}>
        <header className="flex items-start gap-3">
          <span className="material-symbols-outlined text-blue-700" data-fill="1" style={{ fontSize: 22 }}>
            link
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-900">
              2. URLs de evidencia
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Atajo para pegar URLs sueltas. Si prefieres elegirlas con guía, hazlo desde el Módulo 9 del cuestionario.
            </p>
          </div>
        </header>
        <EvidenceUrlsManager token={token} />
      </section>

      {/* 3. Documentos subidos */}
      <section
        className="rounded-2xl border p-5 space-y-3"
        style={{
          borderColor: 'rgb(110 231 183)',
          background: 'rgb(236 253 245)',
        }}
      >
        <header className="flex items-start gap-3">
          <span className="material-symbols-outlined text-emerald-700" data-fill="1" style={{ fontSize: 22 }}>
            folder
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-900">
              3. Sube evidencia que respalde tu caso (opcional pero muy recomendado)
            </h2>
            <p className="text-xs text-gray-700 mt-0.5">
              La IA legal cita tus documentos como evidencia ante USCIS. Mientras más pruebas concretas tengas, más fuerte tu caso.
            </p>
            <p className="text-[11px] mt-1.5 text-gray-600">
              Ejemplos: denuncias policiales, reportes médicos / psicológicos, capturas de amenazas (WhatsApp, SMS, redes),
              fotos de lesiones o propiedad dañada, cartas juradas de testigos, credenciales de partido / sindicato / ONG.
            </p>
          </div>
        </header>
        {Object.keys(ctx.documentsByCategory).length === 0 ? (
          <p className="text-xs italic text-gray-700">
            Aún no has subido documentos. Ve a la pestaña <strong>Documentos</strong> para empezar.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {Object.entries(ctx.documentsByCategory).map(([cat, count]) => (
              <li
                key={cat}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255, 255, 255, 0.7)' }}
              >
                <span className="material-symbols-outlined text-emerald-700" style={{ fontSize: 16 }}>
                  check_circle
                </span>
                <span className="flex-1">{DOCUMENT_CATEGORY_LABELS[cat] ?? cat}</span>
                <span className="font-bold tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => {
            // Click programático en el botón "Documentos" del sidenav/bottomnav —
            // patrón sin acoplar al padre porque el portal usa state interno.
            const btn = Array.from(document.querySelectorAll<HTMLButtonElement>('nav button')).find((b) =>
              /^\s*folder\s*Documentos\s*$/.test(b.textContent ?? ''),
            )
            btn?.click()
          }}
          className="w-full px-4 py-2.5 rounded-full text-sm font-bold flex items-center justify-center gap-2"
          style={{
            background: 'var(--color-ulp-primary-container)',
            color: 'var(--color-ulp-on-primary-container)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>folder_open</span>
          Ir a Documentos
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
        </button>
      </section>

      {/* 4. Validación */}
      {ctx.validation && (
        <section
          className="rounded-2xl border p-5 space-y-3"
          style={{
            background: ctx.validation.ready ? 'rgb(236 253 245)' : 'rgb(255 251 235)',
            borderColor: ctx.validation.ready ? 'rgb(110 231 183)' : 'rgb(252 211 77)',
          }}
        >
          <header className="flex items-start gap-3">
            <span
              className="material-symbols-outlined"
              data-fill="1"
              style={{
                fontSize: 22,
                color: ctx.validation.ready ? 'rgb(4 120 87)' : 'rgb(180 83 9)',
              }}
            >
              {ctx.validation.ready ? 'task_alt' : 'pending_actions'}
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-gray-900">
                4. {ctx.validation.ready ? 'Listo para generar' : 'Aún faltan datos'}
              </h2>
              <p className="text-xs text-gray-700 mt-0.5">
                {ctx.validation.ready
                  ? 'Tu cuestionario tiene todo lo necesario. Cuando tu equipo legal lo decida, la IA generará tu declaración.'
                  : 'Resuelve los siguientes puntos para habilitar la generación del Miedo Creíble.'}
              </p>
            </div>
          </header>
          {ctx.validation.blockers.length > 0 && (
            <ul className="space-y-1.5">
              {ctx.validation.blockers.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgb(185 28 28)' }}>
                    error
                  </span>
                  <span className="text-gray-800">{b.message}</span>
                </li>
              ))}
            </ul>
          )}
          {ctx.validation.warnings.length > 0 && (
            <ul className="space-y-1.5 pt-1 border-t" style={{ borderColor: 'rgb(252 211 77)' }}>
              {ctx.validation.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgb(180 83 9)' }}>
                    lightbulb
                  </span>
                  <span className="text-gray-800">{w.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 5. Preview del draft */}
      <section className="rounded-2xl border bg-white p-5 space-y-3" style={{ borderColor: 'var(--color-ulp-outline-variant)' }}>
        <header className="flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-700" data-fill="1" style={{ fontSize: 22 }}>
            article
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-900">
              5. Tu relato de Miedo Creíble
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Cuando tu equipo legal genere tu declaración verás aquí la versión actual.
              Revísala con Diana en tu próxima cita.
            </p>
          </div>
        </header>

        {ctx.draft ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-gray-500">
              <span>Versión {ctx.draft.version}</span>
              <span>·</span>
              <span>{new Date(ctx.draft.generated_at).toLocaleDateString('es-MX')}</span>
              {ctx.draft.edited_by_diana && (
                <span className="ml-auto text-emerald-700">Revisado por Diana</span>
              )}
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 max-h-96 overflow-y-auto whitespace-pre-wrap text-xs text-gray-800 leading-relaxed">
              {ctx.draft.body_md}
            </div>
            {ctx.draft.sources.length > 0 && (
              <div className="text-[10px] text-gray-500">
                <p className="font-bold uppercase mb-1">Fuentes citadas:</p>
                <ul className="space-y-0.5">
                  {ctx.draft.sources.map((s, i) => (
                    <li key={i} className="truncate">
                      [{i + 1}]{' '}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            Aún no hay relato generado. Completa el cuestionario y tu equipo legal lo generará cuando esté listo.
          </p>
        )}
      </section>

      {wizardOpen && (
        <PortalSheet
          title="Cuestionario Miedo Creíble (M1-M11)"
          onClose={() => { setWizardOpen(false); fetchAll() }}
        >
          <CredibleFearQuestionnaireWizard
            token={token}
            onClose={() => { setWizardOpen(false); fetchAll() }}
          />
        </PortalSheet>
      )}
    </div>
  )
}

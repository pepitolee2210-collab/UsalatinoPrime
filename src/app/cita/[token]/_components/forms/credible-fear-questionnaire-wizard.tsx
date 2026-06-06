'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  calculateProgress,
  getApplicableModules,
  getVisibleQuestions,
  hasAnswerValue,
  type CFAnswers,
  type CFAnswerValue,
  type CFApproximateDate,
  type CFIncidentValue,
  type CFModule,
  type CFOption,
  type CFQuestion,
  type CFUrlValue,
  type CFWitnessValue,
} from '@/lib/legal/asilo-miedo-creible-form-schema'
import { useAutosave } from '@/lib/hooks/use-autosave'

interface ApiResponse {
  case_id: string
  form_instance_id: string | null
  current_phase: string | null
  country_code: string | null
  modules: CFModule[]
  applicable_module_ids: string[]
  answers: CFAnswers
  prefill: Record<string, string | null>
  country_evidence_options: CFOption[]
  progress: ReturnType<typeof calculateProgress>
  locked_for_client: boolean
  status: string | null
}

interface CredibleFearQuestionnaireWizardProps {
  token: string
  /** Llamada al cerrar — el padre debe refrescar required-forms. */
  onClose: () => void
}

export function CredibleFearQuestionnaireWizard({ token, onClose }: CredibleFearQuestionnaireWizardProps) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<CFAnswers>({})
  const [activeModuleId, setActiveModuleId] = useState<string>('M1')
  const [submitting, setSubmitting] = useState(false)
  const lastSavedRef = useRef<string>('')

  // Carga inicial
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/cita/${encodeURIComponent(token)}/asilo-miedo-creible`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text()
          throw new Error(t || 'No se pudo cargar el cuestionario')
        }
        return r.json() as Promise<ApiResponse>
      })
      .then((json) => {
        if (cancelled) return
        setData(json)
        // Hidratar con saved + prefill (saved gana en colisión)
        const initial: CFAnswers = { ...json.answers }
        for (const [key, val] of Object.entries(json.prefill)) {
          if (val === null) continue
          if (initial[key] === undefined || initial[key] === null || initial[key] === '') {
            initial[key] = val
          }
        }
        setAnswers(initial)
        lastSavedRef.current = JSON.stringify(json.answers)
      })
      .catch((err) => {
        if (cancelled) return
        toast.error(err instanceof Error ? err.message : 'Error al cargar')
        onClose()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [token, onClose])

  // Bloquear scroll del body
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const applicableModules = useMemo(() => getApplicableModules(answers), [answers])
  const activeModule = applicableModules.find((m) => m.id === activeModuleId) ?? applicableModules[0]

  // Si el módulo activo deja de ser aplicable (M11 desaparece al cambiar M1),
  // saltar al primero disponible.
  useEffect(() => {
    if (!applicableModules.find((m) => m.id === activeModuleId)) {
      setActiveModuleId(applicableModules[0]?.id ?? 'M1')
    }
  }, [applicableModules, activeModuleId])

  const progress = useMemo(() => calculateProgress(answers), [answers])

  // Autosave a prueba de pérdidas (debounce + reintento + beforeunload/visibilitychange + guardado al desmontar)
  const autosave = useAutosave<CFAnswers>({
    save: async (a) => {
      const serialized = JSON.stringify(a)
      // Evita re-enviar un snapshot idéntico al último confirmado.
      if (serialized === lastSavedRef.current) return true
      const r = await fetch(`/api/cita/${encodeURIComponent(token)}/asilo-miedo-creible`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: a }),
      })
      if (r.ok) lastSavedRef.current = serialized
      return r.ok
    },
    beacon: (a) => [
      {
        url: `/api/cita/${encodeURIComponent(token)}/asilo-miedo-creible`,
        method: 'PUT',
        body: JSON.stringify({ answers: a }),
      },
    ],
  })

  const setAnswer = useCallback(
    (key: string, value: CFAnswerValue) => {
      setAnswers((prev) => {
        const next = { ...prev, [key]: value }
        autosave.schedule(next)
        return next
      })
    },
    [autosave],
  )

  const handleSubmit = useCallback(async () => {
    await autosave.flush()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/cita/${encodeURIComponent(token)}/asilo-miedo-creible/submit`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? 'No se pudo enviar')
      }
      toast.success('Cuestionario enviado a tu equipo legal')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSubmitting(false)
    }
  }, [autosave, onClose, token])

  // Al cambiar de módulo, fuerza el guardado de lo pendiente antes de navegar.
  const selectModule = useCallback(
    (id: string) => {
      void autosave.flush()
      setActiveModuleId(id)
    },
    [autosave],
  )

  if (loading || !data || !activeModule) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <span
          className="material-symbols-outlined animate-spin"
          style={{ fontSize: 32, color: 'var(--color-ulp-primary)' }}
        >
          progress_activity
        </span>
        <p className="text-sm text-gray-600">Cargando tu cuestionario…</p>
      </div>
    )
  }

  const locked = data.locked_for_client

  // Inyectar las opciones de country_evidence_links en m9_prefilled_country_urls
  const countryOptions = data.country_evidence_options

  return (
    <div className="flex flex-col sm:flex-row h-full overflow-hidden">
      {/* Sidebar de módulos */}
      <ModuleSidebar
        modules={applicableModules}
        active={activeModule.id}
        onSelect={selectModule}
        answers={answers}
      />

      {/* Contenido del módulo activo */}
      <div className="flex-1 flex flex-col min-h-0">
        <ProgressHeader progress={progress} saving={autosave.saveState} locked={locked} />

        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-6 max-w-3xl mx-auto w-full">
          <ModuleHeader mod={activeModule} />
          {getVisibleQuestions(activeModule, answers).map((q) => (
            <QuestionRenderer
              key={q.semanticKey}
              question={q}
              value={answers[q.semanticKey]}
              answers={answers}
              countryOptions={countryOptions}
              onChange={(v) => setAnswer(q.semanticKey, v)}
              disabled={locked || submitting}
            />
          ))}
        </div>

        <FooterNav
          modules={applicableModules}
          activeId={activeModule.id}
          onSelect={selectModule}
          progress={progress}
          onSubmit={handleSubmit}
          submitting={submitting}
          locked={locked}
        />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Sub-componentes UI
// ──────────────────────────────────────────────────────────────────

function ModuleSidebar({
  modules,
  active,
  onSelect,
  answers,
}: {
  modules: CFModule[]
  active: string
  onSelect: (id: string) => void
  answers: CFAnswers
}) {
  return (
    <aside
      className="w-full sm:w-64 sm:max-w-64 flex-shrink-0 border-b sm:border-b-0 sm:border-r overflow-x-auto sm:overflow-y-auto"
      style={{
        background: 'var(--color-ulp-surface-container-low)',
        borderColor: 'var(--color-ulp-outline-variant)',
      }}
    >
      <nav className="flex sm:flex-col gap-1 p-2">
        {modules.map((mod) => {
          const visible = getVisibleQuestions(mod, answers)
          const required = visible.filter((q) => q.required)
          const answered = required.filter((q) => hasAnswerValue(answers[q.semanticKey], q.type))
          const isComplete = required.length === 0 || answered.length === required.length
          const isActive = mod.id === active
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => onSelect(mod.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-left flex-shrink-0 transition-colors"
              style={{
                background: isActive ? 'var(--color-ulp-primary-container)' : 'transparent',
                color: isActive ? 'var(--color-ulp-on-primary-container)' : 'var(--color-ulp-on-surface)',
              }}
            >
              <span
                className="material-symbols-outlined flex-shrink-0"
                style={{ fontSize: 18, color: isComplete ? 'rgb(4 120 87)' : 'var(--color-ulp-outline)' }}
                data-fill={isComplete ? '1' : '0'}
              >
                {isComplete ? 'check_circle' : mod.icon}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  {mod.numberLabel}
                </span>
                <span className="text-xs font-semibold whitespace-nowrap sm:whitespace-normal">
                  {mod.shortTitleEs}
                </span>
              </span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

function ProgressHeader({
  progress,
  saving,
  locked,
}: {
  progress: ReturnType<typeof calculateProgress>
  saving: 'idle' | 'saving' | 'saved' | 'error'
  locked: boolean
}) {
  return (
    <div
      className="flex-shrink-0 px-5 sm:px-8 py-2 border-b text-[11px]"
      style={{
        background: 'var(--color-ulp-surface-container-lowest)',
        borderColor: 'var(--color-ulp-outline-variant)',
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <span style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          {locked
            ? '🔒 El cuestionario está bloqueado por tu equipo legal.'
            : 'Tus respuestas se guardan automáticamente'}
        </span>
        <span className="flex items-center gap-2 tabular-nums" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          <span>{progress.modulesComplete}/{progress.modulesTotal} módulos</span>
          <span>·</span>
          <span>{progress.pct}%</span>
          <SaveBadge state={saving} />
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--color-ulp-secondary-fixed-dim)' }}
      >
        <div
          className="h-full transition-all"
          style={{ width: `${progress.pct}%`, background: 'var(--color-ulp-primary)' }}
        />
      </div>
    </div>
  )
}

function SaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null
  const map = {
    saving: { label: 'Guardando…', icon: 'progress_activity', color: 'rgb(180 83 9)' },
    saved: { label: 'Guardado', icon: 'check', color: 'rgb(4 120 87)' },
    error: { label: 'Error', icon: 'error', color: 'rgb(185 28 28)' },
  }[state]
  return (
    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: map.color }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{map.icon}</span>
      {map.label}
    </span>
  )
}

function ModuleHeader({ mod }: { mod: CFModule }) {
  return (
    <header>
      <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
        {mod.numberLabel}
      </p>
      <h2 className="ulp-h3 italic mt-1" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
        {mod.titleEs}
      </h2>
      <p className="ulp-body-sm mt-2" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
        {mod.descriptionEs}
      </p>
    </header>
  )
}

function FooterNav({
  modules,
  activeId,
  onSelect,
  progress,
  onSubmit,
  submitting,
  locked,
}: {
  modules: CFModule[]
  activeId: string
  onSelect: (id: string) => void
  progress: ReturnType<typeof calculateProgress>
  onSubmit: () => void
  submitting: boolean
  locked: boolean
}) {
  const idx = modules.findIndex((m) => m.id === activeId)
  const prev = idx > 0 ? modules[idx - 1] : null
  const next = idx < modules.length - 1 ? modules[idx + 1] : null
  const isLast = !next
  const canSubmit = progress.pct >= 100 && !locked

  return (
    <footer
      className="flex-shrink-0 px-5 sm:px-8 py-3 flex items-center justify-between gap-3 border-t"
      style={{
        borderColor: 'var(--color-ulp-outline-variant)',
        background: 'var(--color-ulp-surface-container-lowest)',
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
      }}
    >
      <button
        type="button"
        disabled={!prev}
        onClick={() => prev && onSelect(prev.id)}
        className="px-4 py-2 rounded-full text-sm font-bold disabled:opacity-30"
        style={{
          background: 'var(--color-ulp-surface-container)',
          color: 'var(--color-ulp-on-surface)',
        }}
      >
        ← {prev?.shortTitleEs ?? 'Anterior'}
      </button>
      <span className="text-[11px] tabular-nums hidden sm:inline" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
        {idx + 1} de {modules.length}
      </span>
      {isLast ? (
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={onSubmit}
          className="px-4 py-2 rounded-full text-sm font-bold disabled:opacity-50"
          style={{
            background: 'var(--color-ulp-primary-container)',
            color: 'var(--color-ulp-on-primary-container)',
          }}
        >
          {submitting ? 'Enviando…' : 'Enviar a mi equipo'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => next && onSelect(next.id)}
          className="px-4 py-2 rounded-full text-sm font-bold"
          style={{
            background: 'var(--color-ulp-primary-container)',
            color: 'var(--color-ulp-on-primary-container)',
          }}
        >
          {next?.shortTitleEs ?? 'Siguiente'} →
        </button>
      )}
    </footer>
  )
}

// ──────────────────────────────────────────────────────────────────
// Renderers por tipo de pregunta
// ──────────────────────────────────────────────────────────────────

function QuestionRenderer({
  question,
  value,
  answers,
  countryOptions,
  onChange,
  disabled,
}: {
  question: CFQuestion
  value: CFAnswerValue
  answers: CFAnswers
  countryOptions: CFOption[]
  onChange: (v: CFAnswerValue) => void
  disabled: boolean
}) {
  const labelBlock = (
    <div>
      <label
        htmlFor={question.semanticKey}
        className="ulp-label block mb-1"
        style={{ color: 'var(--color-ulp-on-surface)' }}
      >
        {question.labelEs}
        {question.required && <span style={{ color: 'rgb(185 28 28)' }}> *</span>}
      </label>
      {question.helpEs && (
        <p className="text-[12px] mb-2" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          {question.helpEs}
        </p>
      )}
    </div>
  )

  const inputStyle = {
    background: 'var(--color-ulp-surface-container-low)',
    borderColor: 'var(--color-ulp-outline-variant)',
    color: 'var(--color-ulp-on-surface)',
  }

  switch (question.type) {
    case 'text':
    case 'date':
      return (
        <div>
          {labelBlock}
          <input
            id={question.semanticKey}
            type={question.type === 'date' ? 'date' : 'text'}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={question.placeholderEs}
            maxLength={question.maxLength}
            className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2"
            style={inputStyle}
          />
        </div>
      )

    case 'textarea':
      return (
        <div>
          {labelBlock}
          <textarea
            id={question.semanticKey}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={question.placeholderEs}
            maxLength={question.maxLength}
            rows={5}
            className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2"
            style={inputStyle}
          />
          {question.maxLength && (
            <p className="text-[11px] mt-1 text-right" style={{ color: 'var(--color-ulp-outline)' }}>
              {typeof value === 'string' ? value.length : 0} / {question.maxLength}
            </p>
          )}
        </div>
      )

    case 'radio_yes_no':
      return (
        <div>
          {labelBlock}
          <div className="flex gap-2">
            {(question.options ?? []).map((opt) => {
              const selected = value === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange(opt.value)}
                  disabled={disabled}
                  className="flex-1 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors"
                  style={{
                    background: selected ? 'var(--color-ulp-primary-container)' : 'var(--color-ulp-surface-container-low)',
                    borderColor: selected ? 'var(--color-ulp-primary)' : 'var(--color-ulp-outline-variant)',
                    color: selected ? 'var(--color-ulp-on-primary-container)' : 'var(--color-ulp-on-surface)',
                  }}
                >
                  {opt.labelEs}
                </button>
              )
            })}
          </div>
        </div>
      )

    case 'select':
      return (
        <div>
          {labelBlock}
          <select
            id={question.semanticKey}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2"
            style={inputStyle}
          >
            <option value="">— Selecciona —</option>
            {(question.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.labelEs}
              </option>
            ))}
          </select>
        </div>
      )

    case 'multi_checkbox': {
      const isCountryUrls = question.semanticKey === 'm9_prefilled_country_urls'
      const opts = isCountryUrls ? countryOptions : (question.options ?? [])
      const selected = Array.isArray(value) ? (value as string[]) : []
      return (
        <div>
          {labelBlock}
          {opts.length === 0 ? (
            <p className="text-xs italic" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
              {isCountryUrls
                ? 'No tenemos fuentes pre-cargadas para tu país. Usa el siguiente campo para agregar las tuyas.'
                : 'Sin opciones disponibles.'}
            </p>
          ) : (
            <div className="space-y-2">
              {opts.map((opt) => {
                const isOn = selected.includes(opt.value)
                return (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors"
                    style={{
                      background: isOn ? 'var(--color-ulp-primary-container)' : 'var(--color-ulp-surface-container-low)',
                      borderColor: isOn ? 'var(--color-ulp-primary)' : 'var(--color-ulp-outline-variant)',
                      color: isOn ? 'var(--color-ulp-on-primary-container)' : 'var(--color-ulp-on-surface)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isOn}
                      disabled={disabled}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selected, opt.value]
                          : selected.filter((v) => v !== opt.value)
                        onChange(next)
                      }}
                      className="mt-1 w-4 h-4 flex-shrink-0"
                    />
                    <span className="flex-1">
                      <span className="text-sm font-semibold block">{opt.labelEs}</span>
                      {opt.helpEs && (
                        <span className="text-[11px] mt-0.5 opacity-80 block">{opt.helpEs}</span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    case 'approximate_date': {
      const v = (value as CFApproximateDate | null | undefined) ?? { date: '', isApproximate: false }
      return (
        <div>
          {labelBlock}
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <input
              id={question.semanticKey}
              type="date"
              value={v.date ?? ''}
              onChange={(e) => onChange({ date: e.target.value, isApproximate: v.isApproximate ?? false })}
              disabled={disabled}
              className="px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2"
              style={inputStyle}
            />
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
              <input
                type="checkbox"
                checked={Boolean(v.isApproximate)}
                disabled={disabled}
                onChange={(e) => onChange({ date: v.date ?? '', isApproximate: e.target.checked })}
                className="w-4 h-4"
              />
              No recuerdo el día exacto — esto es aproximado
            </label>
          </div>
        </div>
      )
    }

    case 'incident_block': {
      const incident = (value as CFIncidentValue | null | undefined) ?? {}
      return (
        <fieldset
          className="rounded-2xl border p-4 space-y-4"
          style={{
            background: 'var(--color-ulp-surface-container-lowest)',
            borderColor: 'var(--color-ulp-outline-variant)',
          }}
        >
          <legend className="px-2 ulp-label" style={{ color: 'var(--color-ulp-on-surface)' }}>
            {question.labelEs}
            {question.required && <span style={{ color: 'rgb(185 28 28)' }}> *</span>}
          </legend>
          {question.helpEs && (
            <p className="text-[12px]" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
              {question.helpEs}
            </p>
          )}
          <IncidentFields
            value={incident}
            onChange={onChange}
            subFields={question.subFields ?? []}
            answers={answers}
            disabled={disabled}
          />
        </fieldset>
      )
    }

    case 'incident_list': {
      const list = Array.isArray(value) ? (value as CFIncidentValue[]) : []
      const max = question.maxItems ?? 15
      return (
        <div>
          {labelBlock}
          <div className="space-y-4">
            {list.map((inc, i) => (
              <fieldset
                key={i}
                className="rounded-2xl border p-4 space-y-4 relative"
                style={{
                  background: 'var(--color-ulp-surface-container-lowest)',
                  borderColor: 'var(--color-ulp-outline-variant)',
                }}
              >
                <legend className="px-2 ulp-label" style={{ color: 'var(--color-ulp-on-surface)' }}>
                  Incidente #{i + 1}
                </legend>
                <button
                  type="button"
                  onClick={() => {
                    const next = list.filter((_, j) => j !== i)
                    onChange(next)
                  }}
                  disabled={disabled}
                  className="absolute top-3 right-3 text-xs underline"
                  style={{ color: 'rgb(185 28 28)' }}
                >
                  Quitar
                </button>
                <IncidentFields
                  value={inc}
                  onChange={(v) => {
                    const next = [...list]
                    next[i] = v as CFIncidentValue
                    onChange(next)
                  }}
                  subFields={question.subFields ?? []}
                  answers={answers}
                  disabled={disabled}
                />
              </fieldset>
            ))}
            {list.length < max && (
              <button
                type="button"
                onClick={() => onChange([...list, {}])}
                disabled={disabled}
                className="px-4 py-2 rounded-full text-sm font-bold border-2 border-dashed"
                style={{
                  borderColor: 'var(--color-ulp-outline)',
                  color: 'var(--color-ulp-primary)',
                }}
              >
                + Agregar incidente
              </button>
            )}
          </div>
        </div>
      )
    }

    case 'witness_list':
      return (
        <div>
          {labelBlock}
          <WitnessListEditor
            value={Array.isArray(value) ? (value as CFWitnessValue[]) : []}
            onChange={onChange}
            disabled={disabled}
            maxItems={question.maxItems ?? 20}
          />
        </div>
      )

    case 'url_list':
      return (
        <div>
          {labelBlock}
          <UrlListEditor
            value={Array.isArray(value) ? (value as CFUrlValue[]) : []}
            onChange={onChange}
            disabled={disabled}
            maxItems={question.maxItems ?? 20}
          />
        </div>
      )

    default:
      return null
  }
}

function IncidentFields({
  value,
  onChange,
  subFields,
  answers,
  disabled,
}: {
  value: CFIncidentValue
  onChange: (v: CFAnswerValue) => void
  subFields: CFQuestion[]
  answers: CFAnswers
  disabled: boolean
}) {
  // Mapeo del semanticKey global del subField al key plano dentro del incident.
  // Los semanticKeys en subFields llevan prefijo (m4_1_first_date, ...). El
  // mapeo a las propiedades de CFIncidentValue es por el sufijo del key.
  const keyToProp = (semanticKey: string): keyof CFIncidentValue | null => {
    if (semanticKey.endsWith('_date')) return 'date'
    if (semanticKey.endsWith('_location')) return 'location'
    if (semanticKey.endsWith('_what_happened')) return 'whatHappened'
    if (semanticKey.endsWith('_who')) return 'who'
    if (semanticKey.endsWith('_why_target')) return 'whyTarget'
    if (semanticKey.endsWith('_effect')) return 'effect'
    if (semanticKey.endsWith('_witnesses_present')) return 'witnesses'
    return null
  }
  return (
    <div className="space-y-4">
      {subFields.map((sf) => {
        const prop = keyToProp(sf.semanticKey)
        if (!prop) return null
        const v = value[prop]
        const setProp = (next: CFAnswerValue) => {
          if (prop === 'date') {
            if (typeof next === 'object' && next && 'date' in next) {
              const ad = next as CFApproximateDate
              onChange({ ...value, date: ad.date, isApproximateDate: ad.isApproximate })
              return
            }
          }
          onChange({ ...value, [prop]: next as string })
        }
        // Para el campo date dentro del incidente convertimos a CFApproximateDate
        const renderValue: CFAnswerValue =
          prop === 'date'
            ? ({ date: value.date ?? '', isApproximate: Boolean(value.isApproximateDate) } as CFApproximateDate)
            : (v as CFAnswerValue)
        return (
          <QuestionRenderer
            key={sf.semanticKey}
            question={sf}
            value={renderValue}
            answers={answers}
            countryOptions={[]}
            onChange={setProp}
            disabled={disabled}
          />
        )
      })}
    </div>
  )
}

function WitnessListEditor({
  value,
  onChange,
  disabled,
  maxItems,
}: {
  value: CFWitnessValue[]
  onChange: (v: CFAnswerValue) => void
  disabled: boolean
  maxItems: number
}) {
  const inputStyle = {
    background: 'var(--color-ulp-surface-container-low)',
    borderColor: 'var(--color-ulp-outline-variant)',
    color: 'var(--color-ulp-on-surface)',
  }
  return (
    <div className="space-y-3">
      {value.map((w, i) => (
        <fieldset
          key={i}
          className="rounded-2xl border p-4 space-y-2 relative"
          style={{
            background: 'var(--color-ulp-surface-container-lowest)',
            borderColor: 'var(--color-ulp-outline-variant)',
          }}
        >
          <legend className="px-2 ulp-label" style={{ color: 'var(--color-ulp-on-surface)' }}>
            Testigo #{i + 1}
          </legend>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            disabled={disabled}
            className="absolute top-3 right-3 text-xs underline"
            style={{ color: 'rgb(185 28 28)' }}
          >
            Quitar
          </button>
          <input
            type="text"
            placeholder="Nombre completo"
            value={w.name ?? ''}
            disabled={disabled}
            onChange={(e) => {
              const next = [...value]
              next[i] = { ...next[i], name: e.target.value }
              onChange(next)
            }}
            className="w-full px-3 py-2 rounded-xl border text-sm"
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Relación contigo (familiar, vecino, colega)"
            value={w.relationship ?? ''}
            disabled={disabled}
            onChange={(e) => {
              const next = [...value]
              next[i] = { ...next[i], relationship: e.target.value }
              onChange(next)
            }}
            className="w-full px-3 py-2 rounded-xl border text-sm"
            style={inputStyle}
          />
          <textarea
            placeholder="¿Qué presenció o sabe sobre tu caso?"
            value={w.whatTheyKnow ?? ''}
            disabled={disabled}
            rows={3}
            onChange={(e) => {
              const next = [...value]
              next[i] = { ...next[i], whatTheyKnow: e.target.value }
              onChange(next)
            }}
            className="w-full px-3 py-2 rounded-xl border text-sm"
            style={inputStyle}
          />
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            <input
              type="checkbox"
              checked={Boolean(w.availableForAffidavit)}
              disabled={disabled}
              onChange={(e) => {
                const next = [...value]
                next[i] = { ...next[i], availableForAffidavit: e.target.checked }
                onChange(next)
              }}
              className="w-4 h-4"
            />
            Está dispuesto(a) a firmar una declaración jurada
          </label>
          <input
            type="text"
            placeholder="Cómo contactarlo (opcional, teléfono o email)"
            value={w.contactInfo ?? ''}
            disabled={disabled}
            onChange={(e) => {
              const next = [...value]
              next[i] = { ...next[i], contactInfo: e.target.value }
              onChange(next)
            }}
            className="w-full px-3 py-2 rounded-xl border text-sm"
            style={inputStyle}
          />
        </fieldset>
      ))}
      {value.length < maxItems && (
        <button
          type="button"
          onClick={() => onChange([...value, {}])}
          disabled={disabled}
          className="px-4 py-2 rounded-full text-sm font-bold border-2 border-dashed"
          style={{
            borderColor: 'var(--color-ulp-outline)',
            color: 'var(--color-ulp-primary)',
          }}
        >
          + Agregar testigo
        </button>
      )}
    </div>
  )
}

function UrlListEditor({
  value,
  onChange,
  disabled,
  maxItems,
}: {
  value: CFUrlValue[]
  onChange: (v: CFAnswerValue) => void
  disabled: boolean
  maxItems: number
}) {
  const inputStyle = {
    background: 'var(--color-ulp-surface-container-low)',
    borderColor: 'var(--color-ulp-outline-variant)',
    color: 'var(--color-ulp-on-surface)',
  }
  const updateAt = (i: number, patch: Partial<CFUrlValue>) => {
    const next = [...value]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  return (
    <div className="space-y-3">
      {value.map((u, i) => (
        <div
          key={i}
          className="rounded-2xl border p-3 space-y-2 relative"
          style={{
            background: 'var(--color-ulp-surface-container-lowest)',
            borderColor: 'var(--color-ulp-outline-variant)',
          }}
        >
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            disabled={disabled}
            className="absolute top-2 right-3 text-xs underline"
            style={{ color: 'rgb(185 28 28)' }}
          >
            Quitar
          </button>
          <input
            type="url"
            placeholder="https://..."
            value={u.url ?? ''}
            disabled={disabled}
            onChange={(e) => updateAt(i, { url: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border text-sm"
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Título o medio (ej. BBC, The New York Times)"
            value={u.title ?? ''}
            disabled={disabled}
            onChange={(e) => updateAt(i, { title: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border text-sm"
            style={inputStyle}
          />
          <select
            value={u.category ?? 'other'}
            disabled={disabled}
            onChange={(e) => updateAt(i, { category: e.target.value as CFUrlValue['category'] })}
            className="w-full px-3 py-2 rounded-xl border text-sm"
            style={inputStyle}
          >
            <option value="international_press">Prensa internacional</option>
            <option value="local_press">Prensa local</option>
            <option value="official_report">Reporte oficial (HRW, Amnesty, etc.)</option>
            <option value="social_media">Redes sociales</option>
            <option value="other">Otro</option>
          </select>
        </div>
      ))}
      {value.length < maxItems && (
        <button
          type="button"
          onClick={() => onChange([...value, { url: '', category: 'international_press' }])}
          disabled={disabled}
          className="px-4 py-2 rounded-full text-sm font-bold border-2 border-dashed"
          style={{
            borderColor: 'var(--color-ulp-outline)',
            color: 'var(--color-ulp-primary)',
          }}
        >
          + Agregar enlace
        </button>
      )}
    </div>
  )
}

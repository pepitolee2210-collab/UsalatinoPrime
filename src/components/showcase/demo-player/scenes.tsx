'use client'

import 'material-symbols/outlined.css'
import { CitaFrame } from './cita-frame'
import { AdminFrame } from './admin-frame'
import type { DemoScene } from './types'

interface SceneProps {
  scene: DemoScene
  /** Progreso 0-1 del paso actual */
  stepProgress: number
}

export function Scene({ scene, stepProgress }: SceneProps) {
  switch (scene.kind) {
    case 'intro':
      return <IntroScene scene={scene} />
    case 'client-register':
      return <ClientRegisterScene scene={scene} stepProgress={stepProgress} />
    case 'client-portal':
      return <ClientPortalScene scene={scene} />
    case 'form-fill':
      return <FormFillScene scene={scene} stepProgress={stepProgress} />
    case 'document-upload':
      return <DocumentUploadScene scene={scene} stepProgress={stepProgress} />
    case 'ai-generate':
      return <AIGenerateScene scene={scene} stepProgress={stepProgress} />
    case 'admin-review':
      return <AdminReviewScene scene={scene} stepProgress={stepProgress} />
    case 'phase-advance':
      return <PhaseAdvanceScene scene={scene} />
    case 'success':
      return <SuccessScene scene={scene} />
  }
}

// ────────────────────────────────────────────────────────────────────
// Helper: typewriter effect
// ────────────────────────────────────────────────────────────────────
function typewriter(text: string, progress: number) {
  const chars = Math.ceil(text.length * Math.min(1, progress * 1.5))
  return text.slice(0, chars)
}

// ────────────────────────────────────────────────────────────────────
// IntroScene — branding del demo
// ────────────────────────────────────────────────────────────────────
function IntroScene({ scene }: { scene: Extract<DemoScene, { kind: 'intro' }> }) {
  return (
    <div className="ulp-portal-root flex flex-col items-center justify-center text-center py-20 space-y-5">
      <div
        className="inline-flex items-center justify-center w-20 h-20 rounded-3xl shadow-xl"
        style={{ background: 'var(--color-ulp-primary-container)' }}
      >
        <span className="material-symbols-outlined" data-fill="1" style={{ fontSize: 44, color: 'var(--color-ulp-on-primary-container)' }}>
          play_circle
        </span>
      </div>
      <h2
        className="italic"
        style={{
          fontFamily: 'var(--font-ulp-display)',
          fontSize: 44,
          lineHeight: 1.1,
          color: 'var(--color-ulp-on-secondary-fixed)',
        }}
      >
        {scene.title}
      </h2>
      {scene.subtitle && (
        <p className="text-base max-w-md" style={{ color: 'var(--color-ulp-on-surface-variant)', fontFamily: 'var(--font-ulp-body)' }}>
          {scene.subtitle}
        </p>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// ClientRegisterScene — landing pública previa al portal
// ────────────────────────────────────────────────────────────────────
function ClientRegisterScene({ scene, stepProgress }: { scene: Extract<DemoScene, { kind: 'client-register' }>; stepProgress: number }) {
  const name = typewriter(scene.clientName, stepProgress)
  const phone = typewriter(scene.phone, Math.max(0, stepProgress - 0.3))
  const service = stepProgress > 0.7 ? scene.service : ''

  return (
    <div className="ulp-portal-root">
      <div className="mx-auto rounded-3xl border border-gray-200 bg-white shadow-xl p-8 space-y-6" style={{ maxWidth: 480 }}>
        <div className="text-center">
          <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
            Nuevo cliente
          </p>
          <h3
            className="italic mt-1"
            style={{
              fontFamily: 'var(--font-ulp-display)',
              fontSize: 32,
              lineHeight: 1.1,
              color: 'var(--color-ulp-on-secondary-fixed)',
            }}
          >
            Empezando tu proceso
          </h3>
        </div>
        <CitaField label="Nombre completo" value={name} cursor={stepProgress < 0.3} />
        <CitaField label="Teléfono" value={phone} cursor={stepProgress >= 0.3 && stepProgress < 0.6} />
        <div className="space-y-1.5">
          <label className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
            Servicio que necesita
          </label>
          <div
            className="rounded-xl border px-4 py-3 text-sm transition-colors"
            style={{
              background: service ? 'var(--color-ulp-primary-container)' : 'var(--color-ulp-surface-container-low)',
              borderColor: service ? 'var(--color-ulp-primary)' : 'var(--color-ulp-outline-variant)',
              color: service ? 'var(--color-ulp-on-primary-container)' : 'var(--color-ulp-outline)',
              fontWeight: service ? 700 : 400,
              fontFamily: 'var(--font-ulp-body)',
            }}
          >
            {service || 'Selecciona un servicio…'}
          </div>
        </div>
      </div>
    </div>
  )
}

function CitaField({ label, value, cursor }: { label: string; value: string; cursor?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
        {label}
      </label>
      <div
        className="rounded-xl border px-4 py-3 text-sm min-h-[44px]"
        style={{
          background: 'var(--color-ulp-surface-container-lowest)',
          borderColor: 'var(--color-ulp-outline-variant)',
          color: 'var(--color-ulp-on-surface)',
          fontFamily: 'var(--font-ulp-body)',
        }}
      >
        {value}
        {cursor && (
          <span
            className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse"
            style={{ background: 'var(--color-ulp-primary)' }}
          />
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// ClientPortalScene — saludo + timeline real del cliente
// ────────────────────────────────────────────────────────────────────
function ClientPortalScene({ scene }: { scene: Extract<DemoScene, { kind: 'client-portal' }> }) {
  const firstName = scene.clientName.split(' ')[0] || 'Cliente'
  return (
    <CitaFrame clientName={scene.clientName} activeScreen="inicio">
      <div className="px-6 py-6 space-y-7 max-w-2xl mx-auto">
        <header>
          <h1
            className="italic"
            style={{
              fontFamily: 'var(--font-ulp-display)',
              fontSize: 40,
              lineHeight: 1.1,
              color: 'var(--color-ulp-on-secondary-fixed)',
            }}
          >
            Hola, {firstName} <span aria-hidden>👋</span>
          </h1>
          <p
            className="mt-2"
            style={{
              fontSize: 16,
              lineHeight: 1.5,
              color: 'var(--color-ulp-on-surface-variant)',
              fontFamily: 'var(--font-ulp-body)',
            }}
          >
            Tu proceso migratorio está en marcha. <span style={{ color: 'var(--color-ulp-outline)' }}>({scene.serviceName})</span>
          </p>
        </header>

        <section
          className="aspect-video w-full rounded-2xl border flex flex-col items-center justify-center gap-3 p-6 text-center"
          style={{
            background: 'var(--color-ulp-surface-container-low)',
            borderColor: 'var(--color-ulp-outline-variant)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--color-ulp-outline)' }}>
            movie
          </span>
          <p className="text-sm" style={{ color: 'var(--color-ulp-on-surface-variant)', fontFamily: 'var(--font-ulp-body)' }}>
            Video introductorio de tu fase actual
          </p>
        </section>

        <section>
          <h2
            className="mb-4"
            style={{
              fontFamily: 'var(--font-ulp-display)',
              fontSize: 24,
              lineHeight: 1.2,
              color: 'var(--color-ulp-on-surface)',
            }}
          >
            Tu progreso
          </h2>
          <PhaseTimelineMini />
        </section>
      </div>
    </CitaFrame>
  )
}

function PhaseTimelineMini() {
  const phases = [
    { num: 'Fase 01', title: 'Custodia', desc: 'Obtener orden de custodia con hallazgos SIJS', state: 'active' as const },
    { num: 'Fase 02', title: 'I-360', desc: 'Petición ante USCIS', state: 'pending' as const },
    { num: 'Fase 03', title: 'I-485', desc: 'Ajuste de estatus', state: 'pending' as const },
  ]
  return (
    <ol className="relative space-y-4 pl-8">
      <span
        aria-hidden
        className="absolute left-[15px] top-2 bottom-2 w-px"
        style={{ background: 'var(--color-ulp-outline-variant)' }}
      />
      {phases.map((p) => {
        const isActive = p.state === 'active'
        const bg = isActive ? 'var(--color-ulp-phase-active)' : 'var(--color-ulp-phase-inactive)'
        const textColor = isActive ? '#ffffff' : 'var(--color-ulp-on-surface-variant)'
        const opacity = isActive ? 1 : 0.6
        const icon = isActive ? 'play_arrow' : 'lock'
        return (
          <li key={p.title} className="relative">
            <span
              aria-hidden
              className="absolute -left-8 top-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: bg }}
            >
              <span className="material-symbols-outlined" data-fill="1" style={{ fontSize: 18, color: textColor }}>
                {icon}
              </span>
            </span>
            <div style={{ opacity }}>
              <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>{p.num}</p>
              <p className="font-semibold mt-0.5" style={{ fontSize: 16, color: 'var(--color-ulp-on-surface)', fontFamily: 'var(--font-ulp-body)' }}>
                {p.title}
              </p>
              <p className="mt-1" style={{ fontSize: 14, color: 'var(--color-ulp-on-surface-variant)', fontFamily: 'var(--font-ulp-body)' }}>
                {p.desc}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ────────────────────────────────────────────────────────────────────
// FormFillScene — wizard del cliente con typewriter
// ────────────────────────────────────────────────────────────────────
function FormFillScene({ scene, stepProgress }: { scene: Extract<DemoScene, { kind: 'form-fill' }>; stepProgress: number }) {
  const fieldsCount = scene.fields.length
  const activeIdx = Math.min(fieldsCount - 1, Math.floor(stepProgress * fieldsCount))
  return (
    <CitaFrame clientName="Cliente" activeScreen="fases">
      <div className="px-6 py-6 space-y-5 max-w-2xl mx-auto">
        <header>
          <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
            {scene.section}
          </p>
          <h1
            className="italic mt-1"
            style={{
              fontFamily: 'var(--font-ulp-display)',
              fontSize: 30,
              lineHeight: 1.1,
              color: 'var(--color-ulp-on-secondary-fixed)',
            }}
          >
            {scene.title}
          </h1>
        </header>

        <div className="space-y-4">
          {scene.fields.map((f, idx) => {
            const fieldProgress = Math.max(0, Math.min(1, stepProgress * fieldsCount - idx))
            const value = typewriter(f.value, fieldProgress)
            return <CitaField key={f.label} label={f.label} value={value} cursor={idx === activeIdx && fieldProgress < 1} />
          })}
        </div>

        <div
          className="flex items-center gap-2 text-xs pt-3 border-t"
          style={{ color: 'var(--color-ulp-on-surface-variant)', borderColor: 'var(--color-ulp-outline-variant)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-ulp-status-approved)' }}>
            cloud_done
          </span>
          Autoguardado en tiempo real
        </div>
      </div>
    </CitaFrame>
  )
}

// ────────────────────────────────────────────────────────────────────
// DocumentUploadScene — donut + cards de documentos
// ────────────────────────────────────────────────────────────────────
function DocumentUploadScene({ scene, stepProgress }: { scene: Extract<DemoScene, { kind: 'document-upload' }>; stepProgress: number }) {
  const visibleCount = Math.ceil(scene.docs.length * stepProgress)
  const completionPct = Math.round((visibleCount / scene.docs.length) * 100)

  return (
    <CitaFrame clientName="Cliente" activeScreen="documentos">
      <div className="px-6 py-6 space-y-5 max-w-2xl mx-auto">
        <header className="flex items-end justify-between">
          <div>
            <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
              Tus documentos
            </p>
            <h1
              className="italic mt-1"
              style={{
                fontFamily: 'var(--font-ulp-display)',
                fontSize: 30,
                lineHeight: 1.1,
                color: 'var(--color-ulp-on-secondary-fixed)',
              }}
            >
              Mis Documentos
            </h1>
          </div>
          <DonutMini pct={completionPct} />
        </header>

        <div className="space-y-2">
          {scene.docs.map((doc, idx) => {
            const visible = idx < visibleCount
            return (
              <div
                key={doc.label}
                className="flex items-center gap-3 rounded-2xl border p-3.5 transition-all duration-700 ease-out"
                style={{
                  background: visible ? 'var(--color-ulp-surface-container-lowest)' : 'var(--color-ulp-surface-container-low)',
                  borderColor: visible ? 'var(--color-ulp-status-approved)' : 'var(--color-ulp-outline-variant)',
                  opacity: visible ? 1 : 0.35,
                  animation: visible ? `ulp-doc-stamp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both` : 'none',
                  animationDelay: visible ? `${idx * 80}ms` : '0ms',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: visible ? 'rgba(16, 185, 129, 0.12)' : 'var(--color-ulp-surface-container)',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    data-fill={visible ? '1' : '0'}
                    style={{ fontSize: 22, color: visible ? 'var(--color-ulp-status-approved)' : 'var(--color-ulp-outline)' }}
                  >
                    {visible ? 'check_circle' : 'description'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate" style={{ fontSize: 14, color: 'var(--color-ulp-on-surface)', fontFamily: 'var(--font-ulp-body)' }}>
                    {doc.label}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-ulp-on-surface-variant)', fontFamily: 'var(--font-ulp-body)' }}>
                    {doc.type}
                  </p>
                </div>
                {visible && (
                  <span
                    className="ulp-label px-2 py-1 rounded-full"
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--color-ulp-status-approved)',
                    }}
                  >
                    Listo
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </CitaFrame>
  )
}

function DonutMini({ pct }: { pct: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="relative w-14 h-14">
      <svg width="56" height="56" viewBox="0 0 56 56" className="rotate-[-90deg]">
        <circle cx="28" cy="28" r={r} strokeWidth="5" fill="none" stroke="var(--color-ulp-surface-container)" />
        <circle
          cx="28"
          cy="28"
          r={r}
          strokeWidth="5"
          fill="none"
          stroke="var(--color-ulp-primary)"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 400ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color: 'var(--color-ulp-on-surface)' }}>{pct}%</span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// AIGenerateScene — admin: spinner orbit + IA → preview del documento
// ────────────────────────────────────────────────────────────────────
function AIGenerateScene({ scene, stepProgress }: { scene: Extract<DemoScene, { kind: 'ai-generate' }>; stepProgress: number }) {
  const engineLabels = { gemini: 'Gemini 2.5', claude: 'Claude Opus 4.5', openai: 'GPT-4' } as const
  const engineColors = {
    gemini: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    claude: 'linear-gradient(135deg, #ea580c, #ec4899)',
    openai: 'linear-gradient(135deg, #10b981, #14b8a6)',
  } as const
  const showOutput = stepProgress > 0.5
  const lines = scene.previewLines ?? []
  const visibleLineCount = Math.ceil(lines.length * Math.max(0, (stepProgress - 0.5) * 2))

  return (
    <AdminFrame module="Generador IA" caseLabel={scene.title}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl shadow-md relative overflow-hidden"
            style={{ background: engineColors[scene.engine] }}
          >
            <span className="material-symbols-outlined text-white relative z-10" data-fill="1" style={{ fontSize: 24 }}>
              auto_awesome
            </span>
            {!showOutput && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4), transparent 60%)',
                  animation: 'ulp-engine-pulse 1.8s ease-in-out infinite',
                }}
              />
            )}
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-gray-500">Generador</p>
            <h3 className="text-base font-bold text-gray-900 mt-0.5">{scene.title}</h3>
            <p className="text-[11px] text-gray-500">{engineLabels[scene.engine]}</p>
          </div>
        </div>

        <div
          className="rounded-xl border p-6 transition-colors duration-700 relative overflow-hidden"
          style={{
            background: showOutput ? 'rgba(16,185,129,0.04)' : 'rgba(2,6,23,0.02)',
            borderColor: showOutput ? '#a7f3d0' : '#e2e8f0',
          }}
        >
          {!showOutput ? (
            <div className="flex flex-col items-center gap-5 py-6">
              <OrbitSpinner />
              <div className="text-center space-y-1">
                <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-gray-600">
                  Procesando · IA
                </p>
                <p className="text-sm text-gray-800 font-medium">
                  {stepProgress < 0.15 ? 'Cargando contexto del caso…'
                    : stepProgress < 0.3 ? 'Analizando información del cliente…'
                    : stepProgress < 0.45 ? 'Aplicando playbook legal…'
                    : 'Estructurando documento…'}
                </p>
              </div>
              <div className="w-56 h-[2px] bg-gray-100 overflow-hidden">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${Math.min(100, stepProgress * 200)}%`,
                    background: engineColors[scene.engine],
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full"
                  style={{
                    background: '#10b981',
                    animation: 'ulp-stamp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
                  }}
                >
                  <span className="material-symbols-outlined text-white" data-fill="1" style={{ fontSize: 16 }}>
                    check
                  </span>
                </span>
                <p className="text-sm font-bold text-gray-900">{scene.output}</p>
              </div>
              {lines.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-64 overflow-hidden relative">
                  <span aria-hidden className="absolute top-2 right-2 text-[9px] uppercase tracking-[0.3em] font-bold text-gray-300">
                    Borrador
                  </span>
                  <div className="space-y-0.5">
                    {lines.slice(0, visibleLineCount).map((line, idx) => (
                      <p
                        key={idx}
                        className="text-[11px] text-gray-700 font-mono leading-[1.6]"
                        style={{ animation: 'ulp-line-in 0.3s ease-out both' }}
                      >
                        {line || ' '}
                      </p>
                    ))}
                    {visibleLineCount < lines.length && (
                      <span
                        className="inline-block w-1.5 h-3 mt-1 align-middle"
                        style={{
                          background: '#1E1E1E',
                          animation: 'ulp-caret 1s steps(2) infinite',
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminFrame>
  )
}

function OrbitSpinner() {
  return (
    <div
      className="relative"
      style={{
        width: 56,
        height: 56,
        animation: 'ulp-orbit-rotate 1.6s linear infinite',
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: 12,
            height: 12,
            background: 'linear-gradient(135deg, #7C2D12, #b45309)',
            top: i === 0 ? 0 : 'auto',
            bottom: i !== 0 ? 0 : 'auto',
            left: i === 1 ? 0 : i === 0 ? '50%' : 'auto',
            right: i === 2 ? 0 : 'auto',
            transform: i === 0 ? 'translateX(-50%)' : 'none',
            opacity: i === 0 ? 1 : i === 1 ? 0.55 : 0.3,
            animation: `ulp-orbit-pulse 1.6s ease-in-out infinite`,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// AdminReviewScene — admin checklist con estados
// ────────────────────────────────────────────────────────────────────
function AdminReviewScene({ scene, stepProgress }: { scene: Extract<DemoScene, { kind: 'admin-review' }>; stepProgress: number }) {
  const itemsCount = scene.items.length
  const processedCount = Math.ceil(itemsCount * stepProgress)
  return (
    <AdminFrame module="Revisión Interna" caseLabel={scene.title}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#002855]" style={{ fontSize: 22 }}>fact_check</span>
          <div>
            <h3 className="text-base font-bold text-gray-900">{scene.title}</h3>
            <p className="text-xs text-gray-500">Henry revisa cada entrega del cliente</p>
          </div>
        </div>
        <div className="space-y-2">
          {scene.items.map((item, idx) => {
            const isProcessed = idx < processedCount
            const status = isProcessed ? item.status : 'pendiente'
            const styles = {
              pendiente: { bg: 'bg-gray-50', text: 'text-gray-500', icon: 'schedule', iconColor: 'text-gray-400' },
              aprobado: { bg: 'bg-emerald-50', text: 'text-emerald-800', icon: 'check_circle', iconColor: 'text-emerald-600' },
              rechazado: { bg: 'bg-red-50', text: 'text-red-800', icon: 'cancel', iconColor: 'text-red-600' },
            }[status]
            return (
              <div key={item.label} className={`flex items-center gap-3 rounded-xl ${styles.bg} px-4 py-3 transition-colors duration-300`}>
                <span className={`material-symbols-outlined ${styles.iconColor}`} data-fill="1" style={{ fontSize: 20 }}>
                  {styles.icon}
                </span>
                <span className={`text-sm flex-1 ${styles.text}`}>{item.label}</span>
                <span className={`text-[10px] uppercase tracking-wider font-bold ${styles.text}`}>{status}</span>
              </div>
            )
          })}
        </div>
      </div>
    </AdminFrame>
  )
}

// ────────────────────────────────────────────────────────────────────
// PhaseAdvanceScene — transición cinematográfica entre fases
// ────────────────────────────────────────────────────────────────────
function PhaseAdvanceScene({ scene }: { scene: Extract<DemoScene, { kind: 'phase-advance' }> }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 space-y-8 relative">
      <p
        className="text-[10px] uppercase tracking-[0.4em] font-bold"
        style={{ color: '#7C2D12', animation: 'ulp-fade-in 0.4s ease-out both' }}
      >
        ✦ Avance de fase ✦
      </p>

      <div className="flex items-center justify-center gap-6 flex-wrap">
        {/* Fase completada — sello */}
        <div
          className="relative flex flex-col items-center"
          style={{ animation: 'ulp-stamp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both' }}
        >
          <div
            className="relative w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              border: '2px solid #10b981',
              background: 'rgba(16,185,129,0.06)',
            }}
          >
            <span
              className="absolute inset-2 rounded-full border-dashed"
              style={{ borderWidth: 1, borderColor: '#10b981', opacity: 0.5 }}
            />
            <span className="material-symbols-outlined relative z-10" data-fill="1" style={{ fontSize: 32, color: '#10b981' }}>
              check
            </span>
          </div>
          <p
            className="mt-3 italic"
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontSize: 18,
              color: '#10b981',
            }}
          >
            {scene.from}
          </p>
        </div>

        {/* Línea conectora que se "dibuja" */}
        <div className="relative flex items-center" style={{ width: 80 }}>
          <span
            className="absolute h-px bg-current opacity-30"
            style={{ width: '100%', left: 0, background: '#1E1E1E' }}
          />
          <span
            className="absolute h-px"
            style={{
              left: 0,
              background: '#7C2D12',
              animation: 'ulp-line-draw 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both',
            }}
          />
          <span
            className="absolute right-0 -translate-y-1/2 top-1/2"
            style={{
              color: '#7C2D12',
              fontSize: 18,
              animation: 'ulp-arrow-slide 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.7s both',
            }}
          >
            →
          </span>
        </div>

        {/* Fase activa nueva — emerge con pulse */}
        <div
          className="relative flex flex-col items-center"
          style={{ animation: 'ulp-emerge 0.8s cubic-bezier(0.22, 1, 0.36, 1) 1s both' }}
        >
          <div
            className="relative w-28 h-28 rounded-full flex items-center justify-center shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #1E1E1E, #3a3a3a)',
              boxShadow: '0 20px 40px rgba(30,30,30,0.25)',
            }}
          >
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(124,45,18,0.4), transparent 70%)',
                animation: 'ulp-engine-pulse 2s ease-in-out infinite',
              }}
            />
            <span className="material-symbols-outlined relative z-10" data-fill="1" style={{ fontSize: 38, color: '#FAF8F4' }}>
              radio_button_checked
            </span>
          </div>
          <p
            className="mt-3 italic font-semibold"
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontSize: 22,
              color: '#1E1E1E',
              letterSpacing: '-0.01em',
            }}
          >
            {scene.to}
          </p>
        </div>
      </div>

      <p
        className="max-w-md text-[15px] leading-[1.7] italic"
        style={{
          fontFamily: 'var(--font-cormorant)',
          color: '#3F3A35',
          animation: 'ulp-fade-in 0.6s ease-out 1.4s both',
        }}
      >
        {scene.toDescription}
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// SuccessScene — pantalla de cierre celebratoria
// ────────────────────────────────────────────────────────────────────
function SuccessScene({ scene }: { scene: Extract<DemoScene, { kind: 'success' }> }) {
  return (
    <div className="ulp-portal-root flex flex-col items-center justify-center text-center py-12 space-y-6">
      <div
        className="inline-flex items-center justify-center w-24 h-24 rounded-3xl shadow-xl"
        style={{
          background: 'linear-gradient(135deg, #34d399, #10b981)',
        }}
      >
        <span className="material-symbols-outlined text-white" data-fill="1" style={{ fontSize: 56 }}>
          verified
        </span>
      </div>
      <div>
        <h2
          className="italic"
          style={{
            fontFamily: 'var(--font-ulp-display)',
            fontSize: 36,
            lineHeight: 1.1,
            color: 'var(--color-ulp-on-secondary-fixed)',
          }}
        >
          {scene.title}
        </h2>
        <p
          className="mt-2 max-w-md mx-auto"
          style={{ fontSize: 16, color: 'var(--color-ulp-on-surface-variant)', fontFamily: 'var(--font-ulp-body)' }}
        >
          {scene.subtitle}
        </p>
      </div>
      <div
        className="rounded-2xl border p-5 max-w-md w-full text-left"
        style={{
          background: 'var(--color-ulp-surface-container-lowest)',
          borderColor: 'var(--color-ulp-status-approved)',
        }}
      >
        <p className="ulp-label mb-3" style={{ color: 'var(--color-ulp-status-approved)' }}>
          Entregables
        </p>
        <ul className="space-y-2">
          {scene.deliverables.map((d, idx) => (
            <li
              key={d}
              className="flex items-start gap-2"
              style={{
                fontFamily: 'var(--font-ulp-body)',
                animation: `ulp-list-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both`,
                animationDelay: `${idx * 90 + 600}ms`,
              }}
            >
              <span className="material-symbols-outlined mt-0.5" data-fill="1" style={{ fontSize: 18, color: 'var(--color-ulp-status-approved)' }}>
                check
              </span>
              <span style={{ fontSize: 14, color: 'var(--color-ulp-on-surface)' }}>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Keyframes globales — inyectados una sola vez
// ────────────────────────────────────────────────────────────────────
export function SceneKeyframes() {
  return (
    <style>{`
      @keyframes ulp-fade-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes ulp-stamp {
        0% { opacity: 0; transform: scale(0.4) rotate(-12deg); }
        60% { opacity: 1; transform: scale(1.08) rotate(2deg); }
        100% { opacity: 1; transform: scale(1) rotate(0); }
      }
      @keyframes ulp-emerge {
        0% { opacity: 0; transform: scale(0.8); }
        70% { opacity: 1; transform: scale(1.04); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes ulp-line-draw {
        from { width: 0%; }
        to { width: 100%; }
      }
      @keyframes ulp-arrow-slide {
        from { opacity: 0; transform: translateX(-12px) translateY(-50%); }
        to { opacity: 1; transform: translateX(0) translateY(-50%); }
      }
      @keyframes ulp-orbit-rotate {
        from { transform: rotate(0); }
        to { transform: rotate(360deg); }
      }
      @keyframes ulp-orbit-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.3); }
      }
      @keyframes ulp-engine-pulse {
        0%, 100% { opacity: 0.4; transform: scale(0.95); }
        50% { opacity: 1; transform: scale(1.05); }
      }
      @keyframes ulp-line-in {
        from { opacity: 0; transform: translateX(-4px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes ulp-caret {
        50% { opacity: 0; }
      }
      @keyframes ulp-list-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes ulp-doc-stamp {
        0% { opacity: 0; transform: translateY(8px) rotate(-2deg) scale(0.95); }
        100% { opacity: 1; transform: translateY(0) rotate(0) scale(1); }
      }
    `}</style>
  )
}

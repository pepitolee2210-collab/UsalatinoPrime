'use client'

import type { CasePhase } from '@/types/database'

export interface QuickContact {
  id: number
  name: string
  role: string
  phone_e164: string | null
  whatsapp_e164: string | null
  avatar_url: string | null
  is_online?: boolean
}

export interface PhaseAsset {
  phase: CasePhase
  welcome_video_url: string | null
  welcome_video_poster: string | null
  description_es: string | null
}

interface InicioScreenProps {
  clientName: string
  currentPhase: CasePhase | null
  serviceName: string
  phaseAsset: PhaseAsset | null
  quickContacts: QuickContact[]
}

const PHASE_LABELS: Record<CasePhase, { number: string; title: string; description: string }> = {
  custodia: {
    number: 'Fase 01',
    title: 'Custodia',
    description: 'Obtener la orden de custodia con los hallazgos SIJS de la corte estatal.',
  },
  i360: {
    number: 'Fase 02',
    title: 'I-360',
    description: 'Petición ante USCIS para clasificación de Special Immigrant Juvenile.',
  },
  i485: {
    number: 'Fase 03',
    title: 'I-485',
    description: 'Ajuste de estatus para obtener la Green Card.',
  },
  completado: {
    number: 'Completado',
    title: 'Proceso completado',
    description: '¡Felicitaciones! Tu caso ha sido aprobado.',
  },
}

const PHASE_ORDER: CasePhase[] = ['custodia', 'i360', 'i485']

export function InicioScreen({
  clientName,
  currentPhase,
  serviceName,
  phaseAsset,
  quickContacts,
}: InicioScreenProps) {
  const firstName = clientName.split(' ')[0] || 'Cliente'
  const currentIdx = currentPhase ? PHASE_ORDER.indexOf(currentPhase) : -1

  return (
    <div className="ulp-screen px-6 py-6 space-y-8 max-w-2xl mx-auto">
      {/* ─── Saludo ─── */}
      <header>
        <h1 className="ulp-h1 italic" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
          Hola, {firstName} <span aria-hidden>👋</span>
        </h1>
        <p
          className="ulp-body-lg mt-2"
          style={{ color: 'var(--color-ulp-on-surface-variant)' }}
        >
          Tu proceso migratorio está en marcha. {serviceName && `(${serviceName})`}
        </p>
      </header>

      {/* ─── Card video introductorio ─── */}
      <section aria-labelledby="video-title">
        <h2 className="sr-only" id="video-title">Video introductorio</h2>
        <VideoCard asset={phaseAsset} phaseTitle={currentPhase ? PHASE_LABELS[currentPhase].title : 'Tu caso'} />
      </section>

      {/* ─── Timeline 3 fases ─── */}
      {currentPhase && currentPhase !== 'completado' && (
        <section aria-labelledby="progress-title">
          <h2
            id="progress-title"
            className="ulp-h3 mb-4"
            style={{ color: 'var(--color-ulp-on-surface)' }}
          >
            Tu progreso
          </h2>
          <PhaseTimeline currentIdx={currentIdx} />
        </section>
      )}

      {/* ─── Contactos rápidos ─── */}
      {quickContacts.length > 0 && (
        <section aria-labelledby="contacts-title">
          <h2
            id="contacts-title"
            className="ulp-h3 mb-4"
            style={{ color: 'var(--color-ulp-on-surface)' }}
          >
            ¿Necesitas ayuda?
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 snap-x">
            {quickContacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Sub-componentes internos
// ──────────────────────────────────────────────────────────────────

function VideoCard({ asset, phaseTitle }: { asset: PhaseAsset | null; phaseTitle: string }) {
  if (!asset?.welcome_video_url) {
    return (
      <div
        className="aspect-video w-full rounded-2xl border flex flex-col items-center justify-center gap-3 p-6 text-center"
        style={{
          background: 'var(--color-ulp-surface-container-low)',
          borderColor: 'var(--color-ulp-outline-variant)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--color-ulp-outline)' }}>
          movie
        </span>
        <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          Tu equipo está preparando un video introductorio sobre la fase de {phaseTitle.toLowerCase()}.
        </p>
      </div>
    )
  }

  return (
    <div
      className="aspect-video w-full rounded-2xl overflow-hidden border relative group"
      style={{ borderColor: 'var(--color-ulp-outline-variant)' }}
    >
      <video
        src={asset.welcome_video_url}
        poster={asset.welcome_video_poster ?? undefined}
        controls
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
      />
    </div>
  )
}

function PhaseTimeline({ currentIdx }: { currentIdx: number }) {
  return (
    <ol className="relative space-y-4 pl-8">
      <span
        aria-hidden
        className="absolute left-[15px] top-2 bottom-2 w-px"
        style={{ background: 'var(--color-ulp-outline-variant)' }}
      />
      {PHASE_ORDER.map((p, idx) => {
        const def = PHASE_LABELS[p]
        const isActive = idx === currentIdx
        const isPast = idx < currentIdx
        const isFuture = idx > currentIdx

        let bg = 'var(--color-ulp-phase-inactive)'
        let textColor = 'var(--color-ulp-on-surface-variant)'
        let opacity = 0.6
        let icon: string = 'lock'

        if (isActive) {
          bg = 'var(--color-ulp-phase-active)'
          textColor = '#ffffff'
          opacity = 1
          icon = 'play_arrow'
        } else if (isPast) {
          bg = 'var(--color-ulp-status-approved)'
          textColor = '#ffffff'
          opacity = 1
          icon = 'check'
        }

        return (
          <li key={p} className="relative">
            <span
              aria-hidden
              className="absolute -left-8 top-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: bg }}
            >
              <span
                className="material-symbols-outlined"
                data-fill="1"
                style={{ fontSize: 18, color: textColor }}
              >
                {icon}
              </span>
            </span>
            <div style={{ opacity }}>
              <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
                {def.number}
              </p>
              <p className="ulp-body-md font-semibold" style={{ color: 'var(--color-ulp-on-surface)' }}>
                {def.title}
              </p>
              <p className="ulp-body-sm mt-1" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
                {def.description}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ContactCard({ contact }: { contact: QuickContact }) {
  const initials = contact.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  const href = contact.whatsapp_e164
    ? `https://wa.me/${contact.whatsapp_e164.replace(/\D/g, '')}`
    : contact.phone_e164
      ? `tel:${contact.phone_e164}`
      : undefined

  return (
    <a
      href={href}
      target={contact.whatsapp_e164 ? '_blank' : undefined}
      rel={contact.whatsapp_e164 ? 'noopener noreferrer' : undefined}
      className="snap-start flex-shrink-0 w-[140px] flex flex-col items-center gap-2 p-4 rounded-2xl border transition-shadow hover:shadow-md"
      style={{
        background: 'var(--color-ulp-surface-container-lowest)',
        borderColor: 'var(--color-ulp-outline-variant)',
      }}
    >
      <div className="relative">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden"
          style={{
            background: 'var(--color-ulp-primary-container)',
            color: 'var(--color-ulp-on-primary-container)',
          }}
        >
          {contact.avatar_url ? (
            <img src={contact.avatar_url} alt={contact.name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold text-lg">{initials}</span>
          )}
        </div>
        {contact.is_online && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
            style={{ background: 'var(--color-ulp-online-indicator)' }}
            aria-label="En línea"
          />
        )}
      </div>
      <p className="ulp-body-sm font-bold text-center" style={{ color: 'var(--color-ulp-on-surface)' }}>
        {contact.name}
      </p>
      <p className="text-[10px] text-center" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
        {contact.role}
      </p>
    </a>
  )
}

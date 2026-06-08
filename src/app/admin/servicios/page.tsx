import Link from 'next/link'
import { Inter_Tight, JetBrains_Mono } from 'next/font/google'
import 'material-symbols/outlined.css'
import { SHOWCASE_SERVICES, getShowcaseTotals, type ShowcaseService } from '@/lib/services/showcase'
import { WallpaperHero } from './_components/wallpaper-hero'

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-tight',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono-tech',
  display: 'swap',
})

export default function ServiciosPage() {
  const services = SHOWCASE_SERVICES
  const totals = getShowcaseTotals()

  return (
    <div
      className={`${interTight.variable} ${mono.variable} -m-6 min-h-[calc(100vh-3rem)] relative overflow-hidden`}
      style={{
        background: 'var(--admin-bg-deep)',
        fontFamily: 'var(--font-tight), -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        color: 'var(--admin-fg)',
      }}
    >
      <WallpaperHero />
      <Aurora />
      <DotGrid />
      <ScanLines />

      <div className="relative px-8 pt-24 pb-32 max-w-[1200px] mx-auto">
        {/* ─── Hero ─── */}
        <header className="text-center mb-24 space-y-7">
          <SystemBadge />
          <h1
            style={{
              fontSize: 'clamp(56px, 8vw, 112px)',
              fontWeight: 500,
              letterSpacing: '-0.045em',
              lineHeight: 0.95,
              animation: 'tech-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both',
            }}
          >
            <span
              style={{
                background: 'linear-gradient(180deg, var(--admin-fg) 0%, var(--admin-fg-muted) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Servicios
            </span>
            <GlowDot />
          </h1>
          <p
            className="max-w-xl mx-auto"
            style={{
              fontSize: 'clamp(17px, 1.4vw, 21px)',
              fontWeight: 400,
              lineHeight: 1.5,
              color: 'var(--admin-fg-muted)',
              letterSpacing: '-0.012em',
              animation: 'tech-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both',
            }}
          >
            Nueve procesos legales y fiscales automatizados.
            <br className="hidden sm:block" />
            De la primera petición hasta la Green Card — todo en una plataforma.
          </p>

          <div
            className="inline-flex items-center gap-6 px-6 py-3 rounded-full"
            style={{
              background: 'var(--admin-accent-soft)',
              border: '0.5px solid var(--admin-border-strong)',
              backdropFilter: 'blur(20px)',
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 11,
              animation: 'tech-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both',
            }}
          >
            <Telemetry label="EXPEDIENTES" value={totals.servicios.toString().padStart(2, '0')} />
            <Divider />
            <Telemetry label="FASES" value={totals.fases.toString().padStart(2, '0')} />
            <Divider />
            <Telemetry label="MÓDULOS IA" value={totals.modulosIA.toString().padStart(2, '0')} />
            <Divider />
            <Telemetry label="STATUS" value="ACTIVE" pulse />
          </div>
        </header>

        {/* ─── Cards grid ─── */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, idx) => (
            <ServiceCard key={service.slug} service={service} idx={idx} />
          ))}
        </section>

        {/* ─── Marquee ─── */}
        <div className="mt-24 overflow-hidden relative" style={{ borderTop: '0.5px solid var(--admin-border)', borderBottom: '0.5px solid var(--admin-border)' }}>
          <div
            data-tech-marquee
            className="flex gap-12 py-6 whitespace-nowrap"
            style={{
              animation: 'tech-marquee 38s linear infinite',
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.15em',
              color: 'var(--admin-fg-subtle)',
            }}
          >
            {Array.from({ length: 2 }).map((_, dupIdx) => (
              <div key={dupIdx} className="flex gap-12 shrink-0">
                {['EXPEDIENTE · ACTIVO', 'DEMO · EN VIVO', 'IA · GENERATIVA', 'FORMULARIOS · USCIS', 'DOCUMENTOS · FIRMADOS', 'PROCESO · AUTOMATIZADO', 'CORTE · EOIR', 'STATUS · OPERATIONAL'].map((t, i) => (
                  <span key={`${dupIdx}-${i}`} className="inline-flex items-center gap-3">
                    <span style={{ color: 'var(--admin-fg)' }}>◆</span>
                    {t}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <footer className="mt-12 text-center">
          <p style={{ fontSize: 13, color: 'var(--admin-fg-subtle)', fontFamily: 'var(--font-mono-tech)', letterSpacing: '0.1em' }}>
            ULP · SHOWCASE · v1.0 · 2026
          </p>
        </footer>
      </div>

      <Keyframes />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Hero pieces
// ────────────────────────────────────────────────────────────────────
function SystemBadge() {
  return (
    <div
      className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full"
      style={{
        background: 'var(--admin-accent-soft)',
        border: '0.5px solid var(--admin-border-strong)',
        animation: 'tech-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      <span className="relative flex items-center justify-center" style={{ width: 8, height: 8 }}>
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: 'var(--admin-bg-elev)', animation: 'tech-ping 2s ease-in-out infinite' }}
        />
        <span
          className="relative rounded-full"
          style={{ width: 8, height: 8, background: 'var(--admin-bg-elev)', boxShadow: '0 0 12px var(--admin-accent)' }}
        />
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.15em',
          color: 'var(--admin-fg)',
        }}
      >
        BIENVENIDO · HENRY · ORELLANA
      </span>
    </div>
  )
}

function GlowDot() {
  return (
    <span
      className="inline-block align-baseline ml-1"
      style={{
        width: '0.55em',
        height: '0.55em',
        borderRadius: '50%',
        background: 'var(--admin-bg-elev)',
        boxShadow: '0 0 24px var(--admin-accent-glow), 0 0 48px var(--admin-accent-glow)',
        animation: 'tech-glow-pulse 2.5s ease-in-out infinite',
      }}
    />
  )
}

function Telemetry({ label, value, pulse }: { label: string; value: string; pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span style={{ color: 'var(--admin-fg-subtle)', letterSpacing: '0.12em' }}>{label}</span>
      <span style={{ color: 'var(--admin-fg)', fontWeight: 700, letterSpacing: '0.02em' }}>{value}</span>
      {pulse && (
        <span
          className="inline-block rounded-full"
          style={{
            width: 6,
            height: 6,
            background: 'var(--admin-bg-elev)',
            boxShadow: '0 0 12px var(--admin-accent-glow)',
            animation: 'tech-glow-pulse 1.4s ease-in-out infinite',
          }}
        />
      )}
    </span>
  )
}

function Divider() {
  return <span style={{ color: 'var(--admin-fg-subtle)' }}>·</span>
}

// ────────────────────────────────────────────────────────────────────
// Background layers — monochrome
// ────────────────────────────────────────────────────────────────────
function Aurora() {
  return (
    <>
      <div
        aria-hidden
        data-tech-aurora
        className="absolute pointer-events-none"
        style={{
          top: '-20%',
          left: '-10%',
          width: '60%',
          height: '70%',
          background: 'radial-gradient(circle, var(--admin-accent-soft) 0%, transparent 60%)',
          filter: 'blur(80px)',
          animation: 'tech-aurora-a 24s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden
        data-tech-aurora
        className="absolute pointer-events-none"
        style={{
          top: '10%',
          right: '-15%',
          width: '55%',
          height: '60%',
          background: 'radial-gradient(circle, var(--admin-border) 0%, transparent 60%)',
          filter: 'blur(80px)',
          animation: 'tech-aurora-b 28s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden
        data-tech-aurora
        className="absolute pointer-events-none"
        style={{
          bottom: '5%',
          left: '30%',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(circle, var(--admin-accent-soft) 0%, transparent 70%)',
          filter: 'blur(90px)',
          animation: 'tech-aurora-c 32s ease-in-out infinite',
        }}
      />
    </>
  )
}

function DotGrid() {
  return (
    <div
      aria-hidden
      data-tech-dotgrid
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          'radial-gradient(circle, var(--admin-border) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
      }}
    />
  )
}

function ScanLines() {
  return (
    <div
      aria-hidden
      data-tech-scanlines
      className="absolute inset-0 pointer-events-none opacity-[0.4]"
      style={{
        backgroundImage:
          'linear-gradient(0deg, transparent 0%, transparent 50%, var(--admin-accent-soft) 50%, var(--admin-accent-soft) 51%, transparent 51%)',
        backgroundSize: '100% 3px',
      }}
    />
  )
}

// ────────────────────────────────────────────────────────────────────
// Service Card — monochrome with all effects
// ────────────────────────────────────────────────────────────────────
interface CardProps {
  service: ShowcaseService
  idx: number
}

function ServiceCard({ service, idx }: CardProps) {
  return (
    <Link
      href={`/admin/servicios/${service.slug}`}
      className="group relative block"
      style={{
        animation: `tech-card-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both`,
        animationDelay: `${idx * 90 + 400}ms`,
      }}
    >
      {/* LED border — borde nítido iluminado rojo → dorado (aparece en hover) */}
      <div
        aria-hidden
        data-tech-led
        className="absolute -inset-px rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, var(--admin-red) 0%, var(--admin-gold) 50%, var(--admin-red) 100%)',
          padding: '1.5px',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      {/* LED glow — resplandor difuso del mismo rojo/dorado, efecto led */}
      <div
        aria-hidden
        data-tech-led-glow
        className="absolute -inset-px rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
        style={{
          boxShadow:
            '0 0 22px color-mix(in srgb, var(--admin-red) 45%, transparent), 0 0 38px color-mix(in srgb, var(--admin-gold) 38%, transparent)',
        }}
      />

      <article
        className="relative h-full rounded-[24px] p-7 flex flex-col overflow-hidden transition-all duration-500 ease-out group-hover:-translate-y-1"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border-strong)',
          backdropFilter: 'blur(20px)',
          minHeight: 360,
        }}
      >
        {/* Inner glow on hover */}
        <span
          aria-hidden
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 0%, var(--admin-accent-soft), transparent 60%)',
            filter: 'blur(40px)',
          }}
        />

        {/* Top row: icon + codename */}
        <div className="flex items-start justify-between mb-7 relative">
          <div
            className="relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110"
            style={{
              background: 'linear-gradient(135deg, var(--admin-border-strong), var(--admin-accent-soft))',
              border: '0.5px solid var(--admin-border-strong)',
            }}
          >
            <span
              className="material-symbols-outlined"
              data-fill="1"
              style={{ fontSize: 24, color: 'var(--admin-fg)' }}
            >
              {service.icon}
            </span>
            <span
              aria-hidden
              className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              style={{ boxShadow: '0 0 32px var(--admin-accent-glow), inset 0 0 16px var(--admin-border)' }}
            />
          </div>

          <span
            style={{
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.18em',
              color: 'var(--admin-fg-subtle)',
              paddingTop: 6,
            }}
          >
            {service.codename}
          </span>
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            color: 'var(--admin-fg)',
            marginBottom: 12,
          }}
        >
          {service.shortName}
        </h2>

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: 'var(--admin-fg-muted)',
            letterSpacing: '-0.005em',
            flex: 1,
          }}
        >
          {service.description}
        </p>

        {/* Stats row mono */}
        <div className="flex items-center gap-2 mt-7 pt-5" style={{ borderTop: '0.5px solid var(--admin-accent-soft)' }}>
          <StatMono value={service.fases.toString().padStart(2, '0')} label="FASES" />
          <Sep />
          <StatMono value={service.formularios.toString().padStart(2, '0')} label="FORMS" />
          <Sep />
          <StatMono value={service.documentos.toString().padStart(2, '0')} label="DOCS" />
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between mt-5">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined" data-fill="1" style={{ fontSize: 14, color: 'var(--admin-fg)' }}>
              auto_awesome
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--admin-fg)',
                letterSpacing: '0.08em',
              }}
            >
              {service.generadoresIA}× IA
            </span>
          </div>

          <span
            className="inline-flex items-center gap-1.5 transition-all duration-500 group-hover:gap-2.5"
            style={{
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: 'var(--admin-fg)',
            }}
          >
            ABRIR
            <span className="transition-transform duration-500 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </article>
    </Link>
  )
}

function StatMono({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5" style={{ fontFamily: 'var(--font-mono-tech)' }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--admin-fg)', letterSpacing: '-0.02em' }}>{value}</span>
      <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--admin-fg-subtle)', letterSpacing: '0.18em' }}>{label}</span>
    </div>
  )
}

function Sep() {
  return <span style={{ color: 'var(--admin-fg-subtle)', fontSize: 12 }}>·</span>
}

// ────────────────────────────────────────────────────────────────────
// Keyframes
// ────────────────────────────────────────────────────────────────────
function Keyframes() {
  return (
    <style>{`
      @keyframes tech-rise {
        from { opacity: 0; transform: translateY(24px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes tech-card-rise {
        from { opacity: 0; transform: translateY(28px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes tech-aurora-a {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(40px, 60px) scale(1.1); }
        66% { transform: translate(-30px, 30px) scale(0.95); }
      }
      @keyframes tech-aurora-b {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(-60px, 50px) scale(1.15); }
      }
      @keyframes tech-aurora-c {
        0%, 100% { transform: translate(0, 0); }
        50% { transform: translate(80px, -40px); }
      }
      @keyframes tech-glow-pulse {
        0%, 100% { opacity: 0.5; transform: scale(0.9); }
        50% { opacity: 1; transform: scale(1.1); }
      }
      @keyframes tech-ping {
        0% { transform: scale(1); opacity: 0.8; }
        100% { transform: scale(2.5); opacity: 0; }
      }
      @keyframes tech-marquee {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }

      /* ════════════════════════════════════════════════════════════════
         MOBILE PERFORMANCE — desactiva los efectos GPU más caros.
         Aurora con filter:blur(80px) × 3 capas tira los FPS a 15–20 en
         mobile mid-range. El marquee infinito suma más carga. Aquí los
         reducimos al mínimo manteniendo la estética dark techno.
         ════════════════════════════════════════════════════════════════ */
      @media (max-width: 768px) {
        /* DotGrid → bajar opacidad para reducir repaints visibles */
        [data-tech-dotgrid] { opacity: 0.3; }
        /* ScanLines → desactivar (overlay caro) */
        [data-tech-scanlines] { display: none; }
        /* Aurora → desactivar las 3 capas con blur(80px) que matan FPS */
        [data-tech-aurora] { display: none; }
        /* Marquee infinito → pausar para no consumir batería */
        [data-tech-marquee] { animation-play-state: paused; }
      }
      @media (prefers-reduced-motion: reduce) {
        [data-tech-aurora], [data-tech-marquee] {
          animation: none !important;
        }
      }
    `}</style>
  )
}

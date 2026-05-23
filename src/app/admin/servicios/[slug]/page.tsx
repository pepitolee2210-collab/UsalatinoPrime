import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Inter_Tight, JetBrains_Mono, Cormorant_Garamond, Manrope } from 'next/font/google'
import 'material-symbols/outlined.css'
import '@/app/cita/[token]/_components/tokens.css'
import { SERVICE_REGISTRY } from '@/lib/services/registry'
import { getDemoScript } from '@/components/showcase/demo-player/scripts'
import { DemoPlayer } from '@/components/showcase/demo-player/demo-player'

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

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
})

interface PageProps {
  params: Promise<{ slug: string }>
}

const SERVICE_INFO: Record<string, { shortName: string; codename: string }> = {
  'visa-juvenil':    { shortName: 'Visa Juvenil',     codename: 'SIJS-001' },
  'asilo-politico':  { shortName: 'Asilo Político',   codename: 'I-589 · 02' },
  'reforzar-asilo':  { shortName: 'Reforzar Asilo',   codename: 'I-589 R · 03' },
  'apelacion':       { shortName: 'Apelación BIA',    codename: 'EOIR-26 · 04' },
  'cambio-de-corte': { shortName: 'Cambio de Corte',  codename: 'EOIR-33 · 05' },
}

export default async function ServicioDetallePage({ params }: PageProps) {
  const { slug } = await params
  const service = SERVICE_REGISTRY[slug]
  if (!service) return notFound()

  const script = getDemoScript(slug)
  const realPhases = service.phases.filter((p) => !p.isCompletion)
  const info = SERVICE_INFO[slug] ?? { shortName: service.name, codename: slug.toUpperCase() }

  return (
    <div
      className={`${interTight.variable} ${mono.variable} ${cormorant.variable} ${manrope.variable} -m-6 min-h-[calc(100vh-3rem)] relative overflow-hidden`}
      style={{
        background: '#000000',
        fontFamily: 'var(--font-tight), -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        color: '#FAFAFA',
      }}
    >
      {/* Monochrome aurora */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: '-20%',
          left: '-10%',
          width: '60%',
          height: '60%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 60%)',
          filter: 'blur(80px)',
          animation: 'tech-aurora-a 28s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: '20%',
          right: '-15%',
          width: '55%',
          height: '60%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 60%)',
          filter: 'blur(80px)',
          animation: 'tech-aurora-b 32s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }}
      />

      <div className="relative px-8 pt-12 pb-32 max-w-[1100px] mx-auto">
        {/* Back nav */}
        <Link
          href="/admin/servicios"
          className="inline-flex items-center gap-2 mb-16 transition-opacity hover:opacity-80"
          style={{
            fontFamily: 'var(--font-mono-tech)',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.18em',
            color: '#A1A1A1',
          }}
        >
          <span style={{ color: '#FFFFFF' }}>←</span>
          INDEX · SERVICIOS
        </Link>

        {/* Hero */}
        <header className="text-center mb-20 space-y-7">
          <div
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '0.5px solid rgba(255,255,255,0.15)',
              animation: 'tech-rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            <span className="relative flex items-center justify-center" style={{ width: 6, height: 6 }}>
              <span
                className="absolute inset-0 rounded-full"
                style={{ background: '#FFFFFF', animation: 'tech-ping 2s ease-in-out infinite' }}
              />
              <span
                className="relative rounded-full"
                style={{ width: 6, height: 6, background: '#FFFFFF', boxShadow: '0 0 8px rgba(255,255,255,0.7)' }}
              />
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.18em',
                color: '#FAFAFA',
              }}
            >
              EXPEDIENTE · {info.codename}
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(48px, 6.5vw, 88px)',
              fontWeight: 500,
              letterSpacing: '-0.045em',
              lineHeight: 0.98,
              animation: 'tech-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both',
            }}
          >
            <span
              style={{
                background: 'linear-gradient(180deg, #FFFFFF 30%, #525252 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {info.shortName}
            </span>
            <span
              className="inline-block align-baseline ml-1"
              style={{
                width: '0.5em',
                height: '0.5em',
                borderRadius: '50%',
                background: '#FFFFFF',
                boxShadow: '0 0 24px rgba(255,255,255,0.8), 0 0 48px rgba(255,255,255,0.4)',
                animation: 'tech-glow-pulse 2.5s ease-in-out infinite',
              }}
            />
          </h1>

          <p
            className="max-w-xl mx-auto"
            style={{
              fontSize: 'clamp(16px, 1.3vw, 19px)',
              fontWeight: 400,
              lineHeight: 1.5,
              color: '#A1A1A1',
              letterSpacing: '-0.012em',
              animation: 'tech-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both',
            }}
          >
            Presiona reproducir y observa el flujo completo del sistema.
            <br className="hidden sm:block" /> Tú narras. El demo actúa.
          </p>
        </header>

        {/* DemoPlayer */}
        <div style={{ animation: 'tech-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both' }}>
          {script ? (
            <DemoPlayer script={script} />
          ) : (
            <div
              className="rounded-[24px] p-16 text-center space-y-3"
              style={{
                background: 'linear-gradient(180deg, rgba(20,20,20,0.92), rgba(8,8,8,0.92))',
                border: '0.5px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.2em',
                  color: '#525252',
                }}
              >
                EN CONSTRUCCIÓN
              </p>
              <p style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.022em', color: '#FFFFFF' }}>
                El guion de demo aún no está listo.
              </p>
            </div>
          )}
        </div>

        {/* Fases */}
        <section className="mt-28">
          <div className="text-center mb-14 space-y-3">
            <p
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.2em',
                color: '#FFFFFF',
              }}
            >
              ESTRUCTURA · {realPhases.length.toString().padStart(2, '0')} FASES
            </p>
            <h2
              style={{
                fontSize: 'clamp(34px, 4.5vw, 52px)',
                fontWeight: 500,
                letterSpacing: '-0.04em',
                lineHeight: 1.05,
              }}
            >
              <span
                style={{
                  background: 'linear-gradient(180deg, #FFFFFF 30%, #525252 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Cómo funciona
              </span>
            </h2>
          </div>

          <div className="space-y-3 relative">
            <span
              aria-hidden
              className="absolute left-[39px] top-10 bottom-10 w-px hidden md:block"
              style={{
                background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.3) 30%, rgba(255,255,255,0.3) 70%, transparent)',
              }}
            />

            {realPhases.map((phase, idx) => (
              <div
                key={phase.code}
                className="relative rounded-[20px] p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start transition-all duration-500 hover:translate-x-1"
                style={{
                  background: 'linear-gradient(180deg, rgba(20,20,20,0.7), rgba(8,8,8,0.7))',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(20px)',
                  animation: `tech-card-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both`,
                  animationDelay: `${idx * 100 + 500}ms`,
                }}
              >
                <div className="flex items-center gap-4 md:flex-col md:items-start shrink-0" style={{ minWidth: 80 }}>
                  <div
                    className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
                      border: '0.5px solid rgba(255,255,255,0.18)',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      data-fill="1"
                      style={{ fontSize: 26, color: '#FFFFFF' }}
                    >
                      {phase.icon}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: '0.2em',
                      color: '#525252',
                    }}
                  >
                    {(idx + 1).toString().padStart(2, '0')}/{realPhases.length.toString().padStart(2, '0')}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    style={{
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: '0.2em',
                      color: '#A1A1A1',
                      marginBottom: 6,
                    }}
                  >
                    {phase.number.toUpperCase()}
                  </p>
                  <h3
                    style={{
                      fontSize: 24,
                      fontWeight: 500,
                      letterSpacing: '-0.025em',
                      lineHeight: 1.15,
                      color: '#FFFFFF',
                    }}
                  >
                    {phase.label.replace(/^Fase \d+ — /, '')}
                  </h3>
                  <p
                    className="mt-2"
                    style={{
                      fontSize: 15,
                      lineHeight: 1.55,
                      color: '#A1A1A1',
                      letterSpacing: '-0.005em',
                      maxWidth: '60ch',
                    }}
                  >
                    {phase.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

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
        @keyframes tech-glow-pulse {
          0%, 100% { opacity: 0.6; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes tech-ping {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

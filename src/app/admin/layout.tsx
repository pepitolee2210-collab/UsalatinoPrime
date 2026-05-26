'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import 'material-symbols/outlined.css'
import { Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  FileText, Users, CreditCard, LogOut, Menu,
  MessageSquare, PenLine, CalendarClock, ClipboardList, PhoneCall, Briefcase, Bot, Scale,
  MessageCircle, FileCheck, Crown, Languages, BookOpenText, Sparkles, ChevronDown,
} from 'lucide-react'
import { ClientSearch } from '@/components/admin/ClientSearch'
import { ErrorBoundary } from '@/components/error-boundary'
import { ChatWidgetAutoMount } from '@/components/employee/chat-widget-mount'
import { AdminThemeSwitcher } from './_components/admin-theme-switcher'

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

type BadgeKey = 'citasToday' | 'formsPending' | 'agendaPending' | 'employeePending' | 'prospectosPending' | 'whatsappActive' | 'internalDocsPending'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>
  badgeKey: BadgeKey | null
  isNew?: boolean
}

interface NavGroup {
  heading: string | null
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    heading: 'Showcase',
    items: [
      { href: '/admin/servicios', label: 'Servicios', icon: Sparkles, badgeKey: null, isNew: true },
      { href: '/admin/ceo', label: 'Vista CEO', icon: Crown, badgeKey: null },
    ],
  },
  {
    heading: 'Operación',
    items: [
      { href: '/admin/citas', label: 'Citas', icon: CalendarClock, badgeKey: 'citasToday' },
      { href: '/admin/prospectos-citas', label: 'Prospectos IA', icon: Bot, badgeKey: 'prospectosPending' },
      { href: '/admin/cases', label: 'Casos', icon: FileText, badgeKey: null },
      { href: '/admin/clients', label: 'Clientes', icon: Users, badgeKey: null },
      { href: '/admin/payments', label: 'Pagos', icon: CreditCard, badgeKey: null },
    ],
  },
  {
    heading: 'Documentos',
    items: [
      { href: '/admin/formularios', label: 'Formularios', icon: ClipboardList, badgeKey: 'formsPending' },
      { href: '/admin/contratos', label: 'Contratos', icon: PenLine, badgeKey: null },
      { href: '/admin/revision-interna', label: 'Revisión Interna', icon: FileCheck, badgeKey: 'internalDocsPending' },
      { href: '/admin/traducciones', label: 'Traducciones', icon: Languages, badgeKey: null },
      { href: '/admin/traduccion-libre', label: 'Traducción Libre', icon: BookOpenText, badgeKey: null },
    ],
  },
  {
    heading: 'Comunicación',
    items: [
      { href: '/admin/agenda', label: 'Agenda', icon: PhoneCall, badgeKey: 'agendaPending' },
      { href: '/admin/llamadas', label: 'Llamadas IA', icon: Bot, badgeKey: null },
      { href: '/admin/whatsapp', label: 'WhatsApp SIJS', icon: MessageCircle, badgeKey: 'whatsappActive' },
    ],
  },
  {
    heading: 'Sistema',
    items: [
      { href: '/admin/revisor-ia', label: 'LEX · Sistema Legal', icon: Scale, badgeKey: null },
      { href: '/admin/empleados', label: 'Empleados', icon: Briefcase, badgeKey: 'employeePending' },
      { href: '/admin/comunidad', label: 'Comunidad', icon: MessageSquare, badgeKey: null },
    ],
  },
]

type BadgeCounts = { citasToday: number; formsPending: number; agendaPending: number; employeePending: number; prospectosPending: number; whatsappActive: number; internalDocsPending: number }

const COLLAPSED_STORAGE_KEY = 'ulp-admin-collapsed-groups'

interface PulseEvent {
  x: number
  y: number
  key: number
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [counts, setCounts] = useState<BadgeCounts>({ citasToday: 0, formsPending: 0, agendaPending: 0, employeePending: 0, prospectosPending: 0, whatsappActive: 0, internalDocsPending: 0 })
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [pulse, setPulse] = useState<PulseEvent | null>(null)
  const pulseCounterRef = useRef(0)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY)
        if (stored) setCollapsedGroups(JSON.parse(stored))
      } catch {}
    }
  }, [])

  useEffect(() => {
    // Fetch al montar + refresh cada 60s. Antes se disparaba en cada
    // cambio de pathname → cada click bloqueaba la transición con red.
    let cancelled = false
    const load = () => {
      fetch('/api/admin/sidebar-counts')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data && !cancelled) setCounts(data) })
        .catch(() => {})
    }
    load()
    const timer = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  function toggleGroup(heading: string, e?: React.MouseEvent) {
    setCollapsedGroups((prev) => {
      const currentlyCollapsed = prev[heading] ?? true
      const next = { ...prev, [heading]: !currentlyCollapsed }
      try { localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect()
      pulseCounterRef.current += 1
      setPulse({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        key: pulseCounterRef.current,
      })
    }
  }

  // Auto-clear pulse after animation completes
  useEffect(() => {
    if (!pulse) return
    const t = setTimeout(() => setPulse(null), 1450)
    return () => clearTimeout(t)
  }, [pulse])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navContent = (
    <div
      className="flex flex-col h-full relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, var(--admin-bg) 0%, var(--admin-bg-deep) 100%)',
        fontFamily: 'var(--font-tight), -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      {/* Iridescent right edge — funciona tanto en desktop como mobile */}
      <ChromaticEdge />
      {/* Ambient inner glow desde el borde derecho */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: 0,
          bottom: 0,
          right: 0,
          width: 80,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.025) 70%, rgba(239,68,68,0.018) 100%)',
          mixBlendMode: 'screen',
        }}
      />
      {/* Aurora glow top-left */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: '-30%',
          left: '-30%',
          width: '120%',
          height: '60%',
          background: 'radial-gradient(circle, var(--admin-accent-soft) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Header */}
      <div className="relative px-6 pt-6 pb-5">
        <Link href="/admin/dashboard" className="flex items-center gap-2.5 group">
          <span className="relative flex items-center justify-center" style={{ width: 10, height: 10 }}>
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: '#FFFFFF', animation: 'admin-ping 2s ease-in-out infinite' }}
            />
            <span
              className="relative rounded-full"
              style={{ width: 10, height: 10, background: '#FFFFFF', boxShadow: '0 0 12px rgba(255,255,255,0.7)' }}
            />
          </span>
          <div className="flex flex-col">
            <p
              style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              UsaLatinoPrime
            </p>
            <MorphMetallicText prefix="ADMIN" suffix="PANEL" />
          </div>
        </Link>
      </div>

      {/* Search */}
      <div className="relative px-4 pb-4">
        <ClientSearch />
      </div>

      {/* Divider */}
      <span className="relative block h-px mx-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }} />

      {/* Nav */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-4 admin-scroll">
        {navGroups.map((group, groupIdx) => {
          // Showcase nunca se colapsa — es el highlight permanente
          const canCollapse = group.heading !== 'Showcase' && group.heading !== null
          const isCollapsed = canCollapse && (collapsedGroups[group.heading!] ?? true)
          // Calcular badge total del grupo cuando colapsado
          const groupBadgeTotal = group.items.reduce((acc, it) => acc + (it.badgeKey ? counts[it.badgeKey] : 0), 0)
          return (
            <div key={group.heading ?? groupIdx} className="space-y-0.5">
              {group.heading && (
                canCollapse ? (
                  <button
                    type="button"
                    onClick={(e) => toggleGroup(group.heading!, e)}
                    className="apple-heading-btn w-full flex items-center justify-between px-3 pb-2 pt-1 rounded-lg"
                  >
                    <NeonHeadingText label={group.heading.toUpperCase()} />
                    <span className="flex items-center gap-2">
                      {isCollapsed && groupBadgeTotal > 0 && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono-tech)',
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 8,
                            background: 'rgba(250,204,21,0.08)',
                            color: 'rgba(253, 224, 71, 0.85)',
                            border: '0.5px solid rgba(250,204,21,0.22)',
                            minWidth: 16,
                            display: 'inline-flex',
                            justifyContent: 'center',
                          }}
                        >
                          {groupBadgeTotal}
                        </span>
                      )}
                      <ChevronDown
                        className="w-3 h-3"
                        style={{
                          color: 'rgba(253, 224, 71, 0.6)',
                          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), color 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
                        }}
                      />
                    </span>
                  </button>
                ) : (
                  <h3 className="px-3 pb-2 pt-1">
                    <NeonHeadingText label={group.heading.toUpperCase()} />
                  </h3>
                )
              )}

              {/* Items — anim collapse */}
              <div
                className="overflow-hidden transition-all duration-500"
                style={{
                  maxHeight: isCollapsed ? 0 : `${group.items.length * 44 + 8}px`,
                  opacity: isCollapsed ? 0 : 1,
                  transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
                }}
              >
                {group.items.map((item, itemIdx) => {
                  const badgeCount = item.badgeKey ? counts[item.badgeKey] : 0
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${!isCollapsed ? 'nav-item-stagger' : ''}`}
                      style={{
                        background: isActive ? 'var(--admin-border)' : 'transparent',
                        color: isActive ? '#FFFFFF' : 'var(--admin-fg-muted)',
                        animationDelay: !isCollapsed ? `${itemIdx * 0.045}s` : '0s',
                      }}
                    >
                      {isActive && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full"
                          style={{
                            background: '#FFFFFF',
                            boxShadow: '0 0 8px rgba(255,255,255,0.6)',
                          }}
                        />
                      )}
                      <item.icon className="w-[18px] h-[18px] shrink-0" style={{ strokeWidth: isActive ? 2.2 : 1.7 }} />
                      <span
                        className="flex-1"
                        style={{
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 500,
                          letterSpacing: '-0.005em',
                        }}
                      >
                        {item.label}
                      </span>
                      {item.isNew && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono-tech)',
                            fontSize: 8,
                            fontWeight: 700,
                            letterSpacing: '0.15em',
                            padding: '2px 5px',
                            borderRadius: 3,
                            background: '#FFFFFF',
                            color: 'var(--admin-bg-deep)',
                          }}
                        >
                          NEW
                        </span>
                      )}
                      {badgeCount > 0 && (
                        <span
                          className="inline-flex items-center justify-center"
                          style={{
                            fontFamily: 'var(--font-mono-tech)',
                            fontSize: 10,
                            fontWeight: 700,
                            minWidth: 18,
                            height: 18,
                            padding: '0 5px',
                            borderRadius: 9,
                            background: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.12)',
                            color: isActive ? 'var(--admin-bg-deep)' : '#FFFFFF',
                            border: isActive ? 'none' : '0.5px solid rgba(255,255,255,0.15)',
                          }}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="relative">
        <span className="block h-px mx-4" style={{ background: 'linear-gradient(90deg, transparent, var(--admin-border-strong), transparent)' }} />
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center gap-2.5 px-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--admin-accent-soft), var(--admin-border))',
                border: '0.5px solid var(--admin-border-strong)',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-fg)' }}>HO</span>
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>
                Henry
              </p>
              <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, color: 'var(--admin-fg-subtle)', letterSpacing: '0.18em' }}>
                ADMIN · ONLINE
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: 'var(--admin-fg-muted)', border: '0.5px solid var(--admin-border)' }}
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Theme switcher — Henry elige el modo visual */}
          <div className="flex items-center justify-between px-2">
            <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, color: 'var(--admin-fg-subtle)', letterSpacing: '0.18em' }}>
              MODO
            </p>
            <AdminThemeSwitcher />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes admin-ping {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .apple-heading-text {
          transition: color 0.45s cubic-bezier(0.32, 0.72, 0, 1),
                      text-shadow 0.45s cubic-bezier(0.32, 0.72, 0, 1);
        }
        .apple-heading-btn {
          transition: background-color 0.45s cubic-bezier(0.32, 0.72, 0, 1);
        }
        .apple-heading-btn:hover {
          background-color: rgba(250, 204, 21, 0.04);
        }
        .apple-heading-btn:hover .apple-heading-text {
          color: rgba(253, 224, 71, 1) !important;
          text-shadow: 0 0 14px rgba(250, 204, 21, 0.35);
        }
        .admin-scroll::-webkit-scrollbar { width: 4px; }
        .admin-scroll::-webkit-scrollbar-track { background: transparent; }
        .admin-scroll::-webkit-scrollbar-thumb { background: var(--admin-border); border-radius: 2px; }
        .admin-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
      `}</style>
    </div>
  )

  return (
    <div
      data-admin-theme="dark"
      className={`${interTight.variable} ${mono.variable} min-h-screen relative overflow-hidden`}
      style={{
        background: 'var(--admin-bg-deep)',
        fontFamily: 'var(--font-tight), -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        color: 'var(--admin-fg)',
      }}
    >
      {/* Global aurora */}
      <div
        aria-hidden
        className="fixed pointer-events-none"
        style={{
          top: '-20%',
          right: '-10%',
          width: '50%',
          height: '60%',
          background: 'radial-gradient(circle, var(--admin-accent-soft) 0%, transparent 60%)',
          filter: 'blur(80px)',
          animation: 'admin-aurora 30s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden
        className="fixed pointer-events-none"
        style={{
          bottom: '-10%',
          left: '20%',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(circle, var(--admin-accent-soft) 0%, transparent 70%)',
          filter: 'blur(90px)',
          animation: 'admin-aurora-b 36s ease-in-out infinite',
        }}
      />

      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-[260px] md:flex-col z-30">
        {navContent}
      </aside>

      {/* Mobile top bar */}
      <div
        className="sticky top-0 z-40 flex items-center gap-4 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden relative"
        style={{
          background: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: 'var(--admin-fg)', border: '0.5px solid var(--admin-border-strong)' }}
            >
              <Menu className="w-4 h-4" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[260px] border-r-0 border-l-0" style={{ background: 'var(--admin-bg-deep)' }}>
            {navContent}
          </SheetContent>
        </Sheet>
        <h1 style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
          UsaLatinoPrime <span style={{ color: 'var(--admin-fg-subtle)' }}>· Admin</span>
        </h1>

        {/* Mobile chromatic bottom edge — versión horizontal del iridescent del sidebar */}
        <span
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            bottom: 0,
            left: 0,
            right: 0,
            height: 1.5,
            background:
              'linear-gradient(90deg, ' +
              'rgba(59,130,246,0.7) 0%, ' +
              'rgba(96,165,250,0.5) 12%, ' +
              'rgba(167,139,250,0.55) 28%, ' +
              'rgba(253,224,71,0.6) 45%, ' +
              'rgba(250,204,21,0.55) 55%, ' +
              'rgba(248,113,113,0.55) 72%, ' +
              'rgba(239,68,68,0.7) 88%, ' +
              'rgba(59,130,246,0.7) 100%)',
            backgroundSize: '400% 100%',
            animation: 'chromatic-mobile-flow 22s linear infinite, chromatic-edge-breathe 7s ease-in-out infinite',
            boxShadow: '0 1px 14px rgba(59,130,246,0.15), 0 1px 18px rgba(239,68,68,0.1)',
          }}
        />
        {/* Highlight metálico sutil */}
        <span
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            bottom: 0.5,
            left: 0,
            right: 0,
            height: 0.5,
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.4) 50%, transparent)',
            opacity: 0.55,
          }}
        />
      </div>

      <main className="relative md:ml-[260px] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>

      <ChatWidgetAutoMount />

      {/* Scan sweep — barrido horizontal Awwwards al click de un heading */}
      {pulse && <ScanSweep key={pulse.key} y={pulse.y} />}

      <style>{`
        @keyframes admin-aurora {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-40px, 30px) scale(1.1); }
        }
        @keyframes admin-aurora-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(50px, -20px) scale(1.05); }
        }
        /* Stagger glow continuo en cada letra del heading — wave sutil */
        @keyframes neon-letter-wave {
          0%, 100% {
            color: rgba(253, 224, 71, 0.68);
            text-shadow: 0 0 4px rgba(250, 204, 21, 0.14);
          }
          50% {
            color: rgba(253, 224, 71, 1);
            text-shadow: 0 0 10px rgba(250, 204, 21, 0.5), 0 0 22px rgba(250, 204, 21, 0.18);
          }
        }
        .neon-letter {
          display: inline-block;
          animation: neon-letter-wave 5.5s ease-in-out infinite;
          transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
        }
        .neon-heading-wrap:hover .neon-letter {
          animation-duration: 1.6s;
          transform: translateY(-1px);
        }
        /* Scan sweep — haz horizontal cruzando el viewport */
        @keyframes scan-sweep {
          0% { transform: translateX(-30%) scaleX(0.7); opacity: 0; }
          12% { opacity: 1; transform: translateX(-20%) scaleX(1); }
          88% { opacity: 1; }
          100% { transform: translateX(110%) scaleX(0.85); opacity: 0; }
        }
        @keyframes scan-trail-fade {
          0% { opacity: 0; transform: scaleY(0); }
          20% { opacity: 0.35; transform: scaleY(1); }
          100% { opacity: 0; transform: scaleY(1); }
        }
        @keyframes scan-side-pulse {
          0% { opacity: 0; transform: translateX(0); }
          15% { opacity: 1; transform: translateX(6px); }
          100% { opacity: 0; transform: translateX(40px); }
        }
        /* Items entrance stagger al expandir */
        @keyframes nav-item-fade-in {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .nav-item-stagger {
          animation: nav-item-fade-in 0.5s cubic-bezier(0.32, 0.72, 0, 1) both;
        }
        /* Chromatic edge — gradient azul/rojo/amarillo respirando verticalmente */
        @keyframes chromatic-edge-flow {
          0% { background-position: 0% 0%; }
          100% { background-position: 0% 400%; }
        }
        /* Variante horizontal para el mobile top bar */
        @keyframes chromatic-mobile-flow {
          0% { background-position: 0% 0%; }
          100% { background-position: 400% 0%; }
        }
        /* Morph swap — ADMIN rojo / PANEL azul → hold 4s → swap → hold 4s.
           Total 9s loop: 0–44% color A (4s), 44–50% transición (0.5s),
           50–94% color B (4s), 94–100% transición (0.5s). */
        @keyframes morph-color-redblue {
          0%, 44% {
            color: rgba(248, 113, 113, 0.95);
            text-shadow: 0 0 6px rgba(239, 68, 68, 0.55), 0 0 12px rgba(239, 68, 68, 0.22);
          }
          50%, 94% {
            color: rgba(96, 165, 250, 0.95);
            text-shadow: 0 0 6px rgba(59, 130, 246, 0.55), 0 0 12px rgba(59, 130, 246, 0.22);
          }
          100% {
            color: rgba(248, 113, 113, 0.95);
            text-shadow: 0 0 6px rgba(239, 68, 68, 0.55), 0 0 12px rgba(239, 68, 68, 0.22);
          }
        }
        @keyframes morph-color-bluered {
          0%, 44% {
            color: rgba(96, 165, 250, 0.95);
            text-shadow: 0 0 6px rgba(59, 130, 246, 0.55), 0 0 12px rgba(59, 130, 246, 0.22);
          }
          50%, 94% {
            color: rgba(248, 113, 113, 0.95);
            text-shadow: 0 0 6px rgba(239, 68, 68, 0.55), 0 0 12px rgba(239, 68, 68, 0.22);
          }
          100% {
            color: rgba(96, 165, 250, 0.95);
            text-shadow: 0 0 6px rgba(59, 130, 246, 0.55), 0 0 12px rgba(59, 130, 246, 0.22);
          }
        }
        .morph-word-admin {
          display: inline-block;
          animation: morph-color-redblue 9s ease-in-out infinite;
          will-change: color, text-shadow;
        }
        .morph-word-panel {
          display: inline-block;
          animation: morph-color-bluered 9s ease-in-out infinite;
          will-change: color, text-shadow;
        }
        /* Highlight bar metálica detrás de las palabras (sutil background sweep) */
        @keyframes morph-bg-flow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes chromatic-edge-breathe {
          0%, 100% { opacity: 0.55; filter: blur(0.2px); }
          50% { opacity: 0.85; filter: blur(0.4px); }
        }
        @keyframes chromatic-bloom-blue {
          0%, 100% { opacity: 0.18; transform: translateY(0); }
          50% { opacity: 0.32; transform: translateY(8%); }
        }
        @keyframes chromatic-bloom-red {
          0%, 100% { opacity: 0.16; transform: translateY(0); }
          50% { opacity: 0.28; transform: translateY(-8%); }
        }

        /* ════════════════════════════════════════════════════════════
           MOBILE PERFORMANCE DEGRADATION
           Desactiva los efectos más caros en mobile (≤ 768px). En GPUs
           mobile el blur, mix-blend-mode y filter consumen ~70% del
           presupuesto de frame. La estética se mantiene con animaciones
           más simples; el resultado se ve casi igual a 60fps.
           ════════════════════════════════════════════════════════════ */
        @media (max-width: 768px) {
          /* MorphMetallicText — quita will-change continuo y alarga duración */
          .morph-word-admin, .morph-word-panel {
            will-change: auto;
            animation-duration: 12s;
          }
          /* Neon letter wave — duración más larga, menos repaints */
          .neon-letter { animation-duration: 8s; }
          .neon-heading-wrap:hover .neon-letter {
            animation-duration: 2.4s;
            transform: none;
          }
          /* nav-item-stagger — desactiva animación de entrada por item */
          .nav-item-stagger { animation: none; }
        }
        /* Respeta la preferencia del sistema "reducir movimiento" */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01s !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.05s !important;
          }
        }
      `}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// ChromaticEdge — borde iridiscente azul/rojo/amarillo del sidebar
// ════════════════════════════════════════════════════════════════════

function ChromaticEdge() {
  return (
    <>
      {/* Bloom azul — flota verticalmente en la parte superior del edge (dentro del sidebar) */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: '-10%',
          right: 0,
          width: 60,
          height: '70%',
          background:
            'radial-gradient(ellipse at right, rgba(59,130,246,0.5) 0%, rgba(96,165,250,0.2) 40%, transparent 75%)',
          filter: 'blur(24px)',
          animation: 'chromatic-bloom-blue 14s ease-in-out infinite',
        }}
      />

      {/* Bloom rojo — flota verticalmente en la parte inferior del edge */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: '-10%',
          right: 0,
          width: 60,
          height: '60%',
          background:
            'radial-gradient(ellipse at right, rgba(239,68,68,0.42) 0%, rgba(248,113,113,0.16) 40%, transparent 75%)',
          filter: 'blur(28px)',
          animation: 'chromatic-bloom-red 16s ease-in-out infinite',
        }}
      />

      {/* Línea base — borde sutil que se ve siempre como fundamento */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: 0,
          bottom: 0,
          right: 0,
          width: 1,
          background: 'var(--admin-border)',
        }}
      />

      {/* Línea cromática principal — el corazón del efecto */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: 0,
          bottom: 0,
          right: 0,
          width: 1.5,
          background:
            'linear-gradient(180deg, ' +
            'rgba(59,130,246,0.85) 0%, ' +
            'rgba(96,165,250,0.6) 10%, ' +
            'rgba(167,139,250,0.55) 22%, ' +
            'rgba(250,204,21,0.45) 35%, ' +
            'rgba(253,224,71,0.65) 45%, ' +
            'rgba(248,113,113,0.5) 60%, ' +
            'rgba(239,68,68,0.85) 75%, ' +
            'rgba(167,139,250,0.55) 88%, ' +
            'rgba(59,130,246,0.85) 100%)',
          backgroundSize: '100% 400%',
          animation: 'chromatic-edge-flow 18s linear infinite, chromatic-edge-breathe 7s ease-in-out infinite',
          boxShadow:
            '-2px 0 18px rgba(59,130,246,0.18), ' +
            '-2px 0 24px rgba(239,68,68,0.12), ' +
            '-1px 0 8px rgba(250,204,21,0.1)',
        }}
      />

      {/* Highlight thin — línea ultra-fina blanca encima para look metálico */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: 0,
          bottom: 0,
          right: 0,
          width: 0.5,
          background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.35) 50%, transparent)',
          opacity: 0.6,
        }}
      />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════
// MorphMetallicText — ADMIN rojo · PANEL azul → swap cada 4s
// ════════════════════════════════════════════════════════════════════

function MorphMetallicText({ prefix, suffix }: { prefix: string; suffix: string }) {
  return (
    <p
      className="relative inline-block"
      style={{
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.18em',
        marginTop: 1,
      }}
    >
      {/* Background bar metálico animado detrás de las palabras */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          left: -4,
          right: -4,
          top: -2,
          bottom: -2,
          background:
            'linear-gradient(90deg, ' +
            'rgba(239, 68, 68, 0.08) 0%, ' +
            'rgba(139, 92, 246, 0.05) 50%, ' +
            'rgba(59, 130, 246, 0.08) 100%)',
          backgroundSize: '200% 100%',
          animation: 'morph-bg-flow 9s ease-in-out infinite',
          borderRadius: 4,
          filter: 'blur(6px)',
        }}
      />
      <span className="relative">
        <span className="morph-word-admin">{prefix}</span>
        <span
          aria-hidden
          style={{
            color: 'rgba(255,255,255,0.28)',
            display: 'inline-block',
            margin: '0 4px',
          }}
        >
          ·
        </span>
        <span className="morph-word-panel">{suffix}</span>
      </span>
    </p>
  )
}

// ════════════════════════════════════════════════════════════════════
// NeonHeadingText — cada letra anima individualmente con stagger
// ════════════════════════════════════════════════════════════════════

function NeonHeadingText({ label }: { label: string }) {
  return (
    <span
      className="neon-heading-wrap"
      aria-label={label}
      style={{
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '0.22em',
      }}
    >
      {label.split('').map((char, i) => (
        <span
          key={i}
          className="neon-letter"
          aria-hidden
          style={{
            animationDelay: `${i * 0.085}s`,
          }}
        >
          {char === ' ' ? ' ' : char}
        </span>
      ))}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════════
// ScanSweep — haz horizontal Awwwards que cruza el viewport al click
// ════════════════════════════════════════════════════════════════════

function ScanSweep({ y }: { y: number }) {
  return (
    <div
      aria-hidden
      className="fixed pointer-events-none"
      style={{
        left: 0,
        right: 0,
        top: y - 14,
        height: 28,
        zIndex: 60,
        overflow: 'visible',
      }}
    >
      {/* Side pulse — micro-impulso en el punto de origen (sidebar) */}
      <div
        className="absolute left-0 top-1/2"
        style={{
          width: 60,
          height: 1.5,
          transform: 'translateY(-50%)',
          background: 'linear-gradient(90deg, rgba(250,204,21,0.95), transparent)',
          filter: 'blur(0.5px)',
          animation: 'scan-side-pulse 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      />

      {/* Trail — banda vertical sutil que el haz deja por un instante */}
      <div
        className="absolute left-0 right-0 top-0 bottom-0"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(250,204,21,0.04), transparent)',
          transformOrigin: 'center',
          animation: 'scan-trail-fade 1.1s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        }}
      />

      {/* Main scan beam */}
      <div
        className="absolute top-1/2"
        style={{
          left: 0,
          right: 0,
          height: 1.5,
          transform: 'translateY(-50%)',
          transformOrigin: 'left center',
          background: 'linear-gradient(90deg, transparent 0%, rgba(250,204,21,0.0) 5%, rgba(250,204,21,0.7) 35%, rgba(253,224,71,1) 50%, rgba(250,204,21,0.7) 65%, rgba(250,204,21,0.0) 95%, transparent 100%)',
          boxShadow: '0 0 14px rgba(250,204,21,0.55), 0 0 32px rgba(250,204,21,0.25)',
          filter: 'blur(0.4px)',
          animation: 'scan-sweep 1.2s cubic-bezier(0.65, 0, 0.35, 1) forwards',
          width: '70%',
        }}
      />

      {/* Secondary thin beam — paralela arriba, más sutil */}
      <div
        className="absolute"
        style={{
          left: 0,
          right: 0,
          top: 'calc(50% - 6px)',
          height: 0.5,
          transformOrigin: 'left center',
          background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.0) 10%, rgba(253,224,71,0.6) 50%, rgba(250,204,21,0.0) 90%, transparent)',
          animation: 'scan-sweep 1.35s cubic-bezier(0.65, 0, 0.35, 1) 0.08s forwards',
          width: '60%',
        }}
      />

      {/* Tertiary thin beam — paralela abajo */}
      <div
        className="absolute"
        style={{
          left: 0,
          right: 0,
          top: 'calc(50% + 6px)',
          height: 0.5,
          transformOrigin: 'left center',
          background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.0) 10%, rgba(253,224,71,0.6) 50%, rgba(250,204,21,0.0) 90%, transparent)',
          animation: 'scan-sweep 1.3s cubic-bezier(0.65, 0, 0.35, 1) 0.04s forwards',
          width: '60%',
        }}
      />
    </div>
  )
}

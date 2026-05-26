'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import 'material-symbols/outlined.css'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import {
  LogOut, Menu, Briefcase, CalendarClock, Users, Scale,
  PhoneCall, CalendarDays, FileSignature, BarChart3, MessageCircle, FileCheck, Languages, BookOpenText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CommandK } from '@/components/employee/command-k'
import { ChatWidgetAutoMount } from '@/components/employee/chat-widget-mount'
import { AdminThemeSwitcher } from '@/app/admin/_components/admin-theme-switcher'
import { useAdminTheme } from '@/app/admin/_components/use-admin-theme'

type EmployeeType = 'paralegal' | 'senior_consultant' | 'contracts_manager' | null

type BadgeKey = 'whatsappActive' | 'chatUnread'
type BadgeCounts = Record<BadgeKey, number>

const navConfig: Array<{
  href: string
  label: string
  icon: typeof Briefcase
  show: (t: EmployeeType) => boolean
  badgeKey?: BadgeKey
}> = [
  { href: '/employee/dashboard', label: 'Mis Tareas', icon: Briefcase, show: () => true },
  // El chat interno está disponible siempre via widget flotante,
  // no como ítem del nav.
  // Casos (acceso directo a Radicación · PDFs y demás secciones) — exclusivo paralegal,
  // así no depende de que Henry asigne caso por caso para poder avanzar.
  { href: '/employee/casos', label: 'Casos', icon: Briefcase, show: (t) => t === 'paralegal' },
  // Prospectos IA — exclusivo consultora senior
  { href: '/employee/prospectos', label: 'Prospectos IA', icon: PhoneCall, show: (t) => t === 'senior_consultant' },
  // WhatsApp SIJS — exclusivo consultora senior
  { href: '/employee/whatsapp', label: 'WhatsApp SIJS', icon: MessageCircle, show: (t) => t === 'senior_consultant', badgeKey: 'whatsappActive' },
  // Agenda — exclusivo consultora senior
  { href: '/employee/agenda', label: 'Mi Agenda', icon: CalendarDays, show: (t) => t === 'senior_consultant' },
  // Contratos — exclusivo contracts_manager
  { href: '/employee/contratos', label: 'Contratos', icon: FileSignature, show: (t) => t === 'contracts_manager' },
  // Métricas — exclusivo contracts_manager
  { href: '/employee/metricas', label: 'Métricas', icon: BarChart3, show: (t) => t === 'contracts_manager' },
  // Generales (todos)
  { href: '/employee/citas', label: 'Citas', icon: CalendarClock, show: () => true },
  { href: '/employee/clientes', label: 'Clientes', icon: Users, show: () => true },
  { href: '/employee/revision-interna', label: 'Revisión Interna', icon: FileCheck, show: () => true },
  { href: '/employee/traducciones', label: 'Traducciones', icon: Languages, show: () => true },
  { href: '/employee/traduccion-libre', label: 'Traducción Libre', icon: BookOpenText, show: () => true },
  { href: '/employee/lex', label: 'LEX · Sistema Legal', icon: Scale, show: (t) => t !== 'contracts_manager' },
]

const ROLE_LABEL: Record<NonNullable<EmployeeType> | 'default', string> = {
  paralegal: 'Paralegal',
  senior_consultant: 'Consultora Senior',
  contracts_manager: 'Contratos · Logística',
  default: 'Panel de Empleado',
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [employeeType, setEmployeeType] = useState<EmployeeType>(null)
  const [counts, setCounts] = useState<BadgeCounts>({ whatsappActive: 0, chatUnread: 0 })
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  // Diana / Vanessa / Andrium tienen el mismo switcher dark/institucional/
  // light que Henry. Persistencia compartida vía localStorage `ulp-admin-theme`.
  useAdminTheme()

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name, employee_type')
          .eq('id', user.id)
          .single()
        if (data) {
          setUserName(`${data.first_name} ${data.last_name}`)
          setEmployeeType((data.employee_type as EmployeeType) ?? null)
        }
      }
    }
    fetchProfile()
    // `supabase` viene de createClient() en el body — agregarlo a las deps
    // causaría loop porque cada render produce nueva instancia. Solo mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!userId) return
    function loadCounts() {
      fetch('/api/employee/sidebar-counts')
        .then(r => (r.ok ? r.json() : null))
        .then(data => { if (data) setCounts(data) })
        .catch(() => {})
    }
    loadCounts()
    // Refrescar al cambiar de ruta + cada 30s para mantener badges al día
    const interval = setInterval(loadCounts, 30000)
    return () => clearInterval(interval)
  }, [pathname, userId])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleNavItems = navConfig.filter((item) => item.show(employeeType))
  const roleLabel = ROLE_LABEL[employeeType ?? 'default']

  const navContent = (
    <div
      className="admin-sidebar flex flex-col h-full"
      style={{
        background: 'linear-gradient(180deg, var(--admin-bg) 0%, var(--admin-bg-deep) 100%)',
      }}
    >
      <div className="p-6">
        <div className="flex items-center gap-2">
          <Briefcase className="w-6 h-6" style={{ color: 'var(--admin-accent)' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--admin-fg)' }}>UsaLatino Prime</h2>
        </div>
        <p className="text-sm" style={{ color: 'var(--admin-fg-subtle)' }}>{roleLabel}</p>
      </div>
      <Separator style={{ backgroundColor: 'var(--admin-border)' }} />
      <nav className="flex-1 p-4 space-y-1">
        {visibleNavItems.map((item) => {
          const badgeCount = item.badgeKey ? counts[item.badgeKey] : 0
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors'
              )}
              style={{
                background: isActive ? 'var(--admin-accent-soft)' : 'transparent',
                color: isActive ? 'var(--admin-fg)' : 'var(--admin-fg-muted)',
                boxShadow: isActive ? 'var(--admin-shadow-gold, 0 4px 12px var(--admin-accent-glow))' : 'none',
              }}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full"
                  style={{ background: 'var(--admin-accent)', boxShadow: '0 0 8px var(--admin-accent-glow)' }}
                />
              )}
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <Badge
                  className="text-xs px-1.5 py-0 min-w-[20px] h-5 flex items-center justify-center"
                  style={{
                    background: 'var(--admin-accent)',
                    color: 'var(--admin-bg)',
                    border: 'none',
                  }}
                >
                  {badgeCount}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>
      <Separator style={{ backgroundColor: 'var(--admin-border)' }} />
      <div className="p-4 space-y-3">
        <p className="text-sm" style={{ color: 'var(--admin-fg)' }}>{userName || 'Empleado'}</p>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleLogout}
          style={{
            background: 'transparent',
            color: 'var(--admin-fg-muted)',
            border: '0.5px solid var(--admin-border-strong)',
          }}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar Sesi&oacute;n
        </Button>
        {/* Theme switcher — Diana/Vanessa/Andrium también eligen modo visual */}
        <div className="flex items-center justify-between">
          <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 9, color: 'var(--admin-fg-subtle)', letterSpacing: '0.18em' }}>
            MODO
          </p>
          <AdminThemeSwitcher />
        </div>
      </div>
    </div>
  )

  return (
    <div
      data-admin-theme="dark"
      className="min-h-screen"
      style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}
    >
      <aside
        className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col"
        style={{ borderRight: '1px solid var(--admin-border)' }}
      >
        {navContent}
      </aside>
      <div
        className="sticky top-0 z-40 flex items-center gap-4 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden"
        style={{
          background: 'var(--admin-bg)',
          borderBottom: '1px solid var(--admin-border)',
        }}
      >
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" style={{ color: 'var(--admin-fg)' }}><Menu className="w-5 h-5" /></Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="admin-sidebar p-0 w-64"
            style={{ background: 'var(--admin-bg)' }}
          >
            {navContent}
          </SheetContent>
        </Sheet>
        <h1 className="font-semibold" style={{ color: 'var(--admin-fg)' }}>UsaLatino Prime</h1>
      </div>
      {/* Topbar desktop con buscador global Cmd+K */}
      <div
        className="hidden md:flex md:ml-64 sticky top-0 z-30 items-center justify-end gap-2 backdrop-blur-md px-6 h-12"
        style={{
          background: 'color-mix(in srgb, var(--admin-bg) 70%, transparent)',
          borderBottom: '1px solid var(--admin-border)',
        }}
      >
        <CommandK />
      </div>
      <main className="md:ml-64 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</main>
      {/* Widget flotante de chat — todo ocurre embebido, sin redirects */}
      <ChatWidgetAutoMount />
    </div>
  )
}

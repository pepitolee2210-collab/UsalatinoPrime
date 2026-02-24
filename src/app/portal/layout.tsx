'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { OnboardingTour } from '@/components/portal/OnboardingTour'
import {
  Home, FileText, CreditCard, Bell, LogOut, Menu, User, Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/portal/dashboard', label: 'Inicio', icon: Home },
  { href: '/portal/services', label: 'Servicios', icon: FileText },
  { href: '/portal/payments', label: 'Pagos', icon: CreditCard },
  { href: '/portal/notifications', label: 'Notificaciones', icon: Bell },
  { href: '/comunidad', label: 'Comunidad', icon: Users },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tourStep, setTourStep] = useState<number | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleTourStepChange = useCallback((step: number | null) => {
    setTourStep(step)
  }, [])

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single()
        if (profile) setUserName(`${profile.first_name} ${profile.last_name}`)
      }
    }
    loadUser()
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#002855]">
            <span className="text-[#F2A900] text-sm font-black">U</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#002855] leading-tight">
              Usa<span className="text-[#F2A900]">Latino</span>Prime
            </h2>
            <p className="text-[10px] text-[#002855]/40 font-medium tracking-wider uppercase leading-none">
              Su camino, nuestro compromiso
            </p>
          </div>
        </div>
      </div>
      <Separator />
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item, index) => {
          const isHighlighted = tourStep === index

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300',
                isHighlighted
                  ? 'bg-[#F2A900]/15 text-[#002855] ring-2 ring-[#F2A900]/40 scale-[1.02] shadow-sm'
                  : pathname.startsWith(item.href)
                  ? 'bg-[#002855]/10 text-[#002855]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('w-5 h-5', isHighlighted && 'text-[#F2A900]')} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <Separator />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-700">{userName}</span>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar Sesion
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col border-r bg-white z-40">
        <NavContent />
      </aside>

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex items-center gap-4 bg-white border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <NavContent />
          </SheetContent>
        </Sheet>
        <h1 className="font-bold text-[#002855]">
          Usa<span className="text-[#F2A900]">Latino</span>Prime
        </h1>
      </div>

      {/* Main content */}
      <main className="md:ml-64 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Onboarding tour - on any portal page, after userId is loaded */}
      {userId && (
        <OnboardingTour userId={userId} onStepChange={handleTourStepChange} />
      )}
    </div>
  )
}

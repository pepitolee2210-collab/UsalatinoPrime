'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Home, Play, FileText, Menu, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/comunidad', label: 'Inicio', icon: Home, exact: true },
  { href: '/comunidad/videos', label: 'Videos', icon: Play },
  { href: '/portal/services', label: 'Servicios', icon: FileText },
]

export default function ComunidadLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profile, setProfile] = useState<{ first_name: string; avatar_url: string | null } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, avatar_url')
          .eq('id', user.id)
          .single()
        if (data) setProfile(data)
      }
    }
    loadProfile()
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      {/* Mobile header */}
      <div className="sticky top-0 z-40 bg-white border-b pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#002855]">
              <span className="text-[#F2A900] text-sm font-black">U</span>
            </div>
            <h1 className="font-bold text-[#002855]">
              Usa<span className="text-[#F2A900]">Latino</span>Prime
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Avatar button - goes to profile */}
            <Link href="/comunidad/perfil" className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-[#002855] flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#F2A900] text-xs font-bold">
                    {profile?.first_name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                )}
              </div>
            </Link>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 p-0">
                <div className="p-6">
                  <h2 className="font-bold text-lg text-[#002855] mb-4">Menú</h2>
                  <nav className="space-y-2">
                    {tabs.map(tab => (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors',
                          (tab.exact ? pathname === tab.href : pathname.startsWith(tab.href))
                            ? 'bg-[#002855]/10 text-[#002855]'
                            : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        <tab.icon className="w-5 h-5" />
                        {tab.label}
                      </Link>
                    ))}
                  </nav>
                  <Separator className="my-4" />
                  <nav className="space-y-2">
                    <Link
                      href="/comunidad/perfil"
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors',
                        pathname === '/comunidad/perfil'
                          ? 'bg-[#002855]/10 text-[#002855]'
                          : 'text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      <User className="w-5 h-5" />
                      Mi Perfil
                    </Link>
                    <button
                      onClick={() => { setMobileOpen(false); handleLogout() }}
                      className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <LogOut className="w-5 h-5" />
                      Cerrar Sesión
                    </button>
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Tab bar */}
        <nav className="flex border-t">
          {tabs.map(tab => {
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href)

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2',
                  isActive
                    ? 'border-[#F2A900] text-[#002855]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  )
}

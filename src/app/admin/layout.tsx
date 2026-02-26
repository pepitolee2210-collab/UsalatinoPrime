'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard, FileText, Users, CreditCard, LogOut, Menu, Shield, Baby, MessageSquare, PenLine, ArrowRightLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/contratos', label: 'Contratos', icon: PenLine },
  { href: '/admin/cases', label: 'Casos', icon: FileText },
  { href: '/admin/clients', label: 'Clientes', icon: Users },
  { href: '/admin/payments', label: 'Pagos', icon: CreditCard },
  { href: '/admin/visa-juvenil', label: 'Visa Juvenil', icon: Baby },
  { href: '/admin/asilo', label: 'Asilo I-589', icon: FileText },
  { href: '/admin/ajuste-estatus', label: 'Ajuste de Estatus', icon: FileText },
  { href: '/admin/renuncia', label: 'Renuncia Custodia', icon: FileText },
  { href: '/admin/cambio-corte', label: 'Cambio de Corte', icon: ArrowRightLeft },
  { href: '/admin/comunidad', label: 'Comunidad', icon: MessageSquare },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#002855]" />
          <h2 className="text-xl font-bold text-gray-900">UsaLatinoPrime</h2>
        </div>
        <p className="text-sm text-gray-500">Panel de Administraci&oacute;n</p>
      </div>
      <Separator />
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-[#002855]/10 text-[#002855]'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </Link>
        ))}
      </nav>
      <Separator />
      <div className="p-4">
        <p className="text-sm text-gray-700 mb-3">Henry (Admin)</p>
        <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar Sesi&oacute;n
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col border-r bg-white">
        <NavContent />
      </aside>
      <div className="sticky top-0 z-40 flex items-center gap-4 bg-white border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="w-5 h-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64"><NavContent /></SheetContent>
        </Sheet>
        <h1 className="font-semibold">UsaLatinoPrime Admin</h1>
      </div>
      <main className="md:ml-64 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</main>
    </div>
  )
}

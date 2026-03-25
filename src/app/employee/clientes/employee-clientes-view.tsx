'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Phone, Mail, Search, User } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Client {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  created_at: string
  case_count: number
  services: string[]
}

export function EmployeeClientesView({ clients }: { clients: Client[] }) {
  const [search, setSearch] = useState('')

  const filtered = clients.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
  })

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono..."
          className="pl-10 h-11" />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">No se encontraron clientes.</p>
        )}
        {filtered.map(c => (
          <div key={c.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#002855] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {c.first_name[0]}{c.last_name[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{c.first_name} {c.last_name}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
                    {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                  </div>
                  {c.services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.services.map(s => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-400">{c.case_count} caso{c.case_count !== 1 ? 's' : ''}</p>
                <p className="text-[10px] text-gray-400">
                  {format(new Date(c.created_at), "d MMM yyyy", { locale: es })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, Loader2, Image, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

type ZellePayment = {
  id: string
  amount: number
  screenshot_url: string
  status: string
  notes: string | null
  created_at: string
  user: { first_name: string; last_name: string; email: string } | null
}

export default function AdminZellePage() {
  const [payments, setPayments] = useState<ZellePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')

  const supabase = createClient()

  const loadPayments = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('zelle_payments')
      .select(`
        id, amount, screenshot_url, status, notes, created_at,
        user:profiles!zelle_payments_user_id_profiles_fkey(first_name, last_name, email)
      `)
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query.limit(50)

    setPayments((data || []).map(p => ({
      ...p,
      user: Array.isArray(p.user) ? p.user[0] : p.user,
    })))
    setLoading(false)
  }, [supabase, filter])

  useEffect(() => { loadPayments() }, [loadPayments])

  async function handleReview(zelleId: string, action: 'approved' | 'rejected') {
    setProcessing(zelleId)

    const notes = action === 'rejected'
      ? prompt('Motivo del rechazo (opcional):') || ''
      : ''

    const res = await fetch('/api/community/zelle-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zelle_id: zelleId, action, notes }),
    })

    if (res.ok) {
      toast.success(action === 'approved' ? 'Pago aprobado' : 'Pago rechazado')
      loadPayments()
    } else {
      toast.error('Error al procesar')
    }
    setProcessing(null)
  }

  const pendingCount = payments.filter(p => p.status === 'pending').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pagos Zelle</h1>
        {pendingCount > 0 && (
          <Badge className="bg-[#F2A900] text-white">
            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {([
          { key: 'pending', label: 'Pendientes', icon: Clock },
          { key: 'approved', label: 'Aprobados', icon: CheckCircle },
          { key: 'rejected', label: 'Rechazados', icon: XCircle },
          { key: 'all', label: 'Todos', icon: null },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-[#002855] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : payments.length === 0 ? (
        <p className="text-center text-gray-400 py-12">No hay pagos {filter === 'pending' ? 'pendientes' : ''}</p>
      ) : (
        <div className="space-y-3">
          {payments.map(payment => (
            <Card key={payment.id}>
              <CardContent className="pt-5">
                <div className="flex items-start gap-4">
                  {/* Screenshot thumbnail */}
                  <a
                    href={payment.screenshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-20 h-20 rounded-lg bg-gray-100 border flex items-center justify-center flex-shrink-0 overflow-hidden hover:opacity-80 transition-opacity"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={payment.screenshot_url}
                      alt="Comprobante"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                        ;(e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-gray-400 text-xs">Ver</span>'
                      }}
                    />
                  </a>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">
                        {payment.user?.first_name} {payment.user?.last_name}
                      </p>
                      <Badge
                        variant={payment.status === 'approved' ? 'default' : payment.status === 'rejected' ? 'destructive' : 'secondary'}
                        className={payment.status === 'approved' ? 'bg-green-100 text-green-700' : ''}
                      >
                        {payment.status === 'pending' && '⏳ Pendiente'}
                        {payment.status === 'approved' && '✅ Aprobado'}
                        {payment.status === 'rejected' && '❌ Rechazado'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">{payment.user?.email}</p>
                    <p className="text-sm font-medium text-[#002855]">${payment.amount}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(payment.created_at).toLocaleDateString('es-US', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                    {payment.notes && (
                      <p className="text-xs text-red-500 mt-1">Nota: {payment.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {payment.status === 'pending' && (
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleReview(payment.id, 'approved')}
                        disabled={processing === payment.id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {processing === payment.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Aprobar
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReview(payment.id, 'rejected')}
                        disabled={processing === payment.id}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

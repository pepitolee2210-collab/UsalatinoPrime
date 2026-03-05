'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CambioCorteForm } from '../nuevo/page'
import type { CambioCorteInitialData } from '../nuevo/page'
import { Loader2 } from 'lucide-react'

export default function EditarCambioCortePage() {
  const params = useParams()
  const id = params.id as string
  const [data, setData] = useState<CambioCorteInitialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: row, error: err } = await supabase
        .from('cambio_corte_submissions')
        .select('*')
        .eq('id', id)
        .single()

      if (err || !row) {
        setError('No se encontró el formulario')
      } else {
        setData(row)
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 text-gray-500">
        {error || 'Formulario no encontrado'}
      </div>
    )
  }

  return <CambioCorteForm initialData={{ ...data, id }} mode="edit" />
}

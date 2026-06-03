'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Badge } from '@/components/ui/badge'
import { Download, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { generateCredibleFearPDF, type CredibleFearPDFInput } from '@/lib/pdf/generate-credible-fear-pdf'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface CredibleFearCardProps {
  submission: {
    id: string
    created_at: string
    full_name: string
    country_of_origin: string
    date_of_birth: string
    entry_date: string
    entry_method: string
    reason_for_leaving: string
    who_harmed: string
    what_happened: string
    when_happened: string
    where_happened: string
    had_witnesses: boolean
    witnesses_detail: string | null
    has_evidence: boolean
    evidence_detail: string | null
    went_to_police: boolean
    why_not_police: string | null
    police_response: string | null
    fear_if_return: string
    who_would_look: string
    still_receiving_threats: boolean
    threats_detail: string | null
    status: string
  }
}

export function CredibleFearCard({ submission }: CredibleFearCardProps) {
  const [marking, setMarking] = useState(false)
  const [isReviewed, setIsReviewed] = useState(submission.status === 'reviewed')

  function handleDownloadPDF() {
    const pdfInput: CredibleFearPDFInput = {
      full_name: submission.full_name,
      date_of_birth: submission.date_of_birth,
      country_of_origin: submission.country_of_origin,
      entry_date: submission.entry_date,
      entry_method: submission.entry_method,
      reason_for_leaving: submission.reason_for_leaving,
      who_harmed: submission.who_harmed,
      what_happened: submission.what_happened,
      when_happened: submission.when_happened,
      where_happened: submission.where_happened,
      had_witnesses: submission.had_witnesses,
      witnesses_detail: submission.witnesses_detail || '',
      has_evidence: submission.has_evidence,
      evidence_detail: submission.evidence_detail || '',
      went_to_police: submission.went_to_police,
      why_not_police: submission.why_not_police || '',
      police_response: submission.police_response || '',
      fear_if_return: submission.fear_if_return,
      who_would_look: submission.who_would_look,
      still_receiving_threats: submission.still_receiving_threats,
      threats_detail: submission.threats_detail || '',
      created_at: submission.created_at,
    }

    const doc = generateCredibleFearPDF(pdfInput)
    const safeName = submission.full_name.replace(/[^a-zA-Z0-9]/g, '_')
    doc.save(`miedo_creible_${safeName}.pdf`)
    toast.success('PDF descargado')
  }

  async function handleMarkReviewed() {
    setMarking(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { error } = await supabase
        .from('credible_fear_submissions')
        .update({ status: 'reviewed' })
        .eq('id', submission.id)

      if (error) {
        toast.error('Error al actualizar')
        return
      }

      setIsReviewed(true)
      toast.success('Marcado como revisado')
    } catch {
      toast.error('Error de conexion')
    } finally {
      setMarking(false)
    }
  }

  if (isReviewed) return null

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-amber-100 bg-amber-50/50 hover:bg-amber-50 transition-colors">
      <div>
        <p className="font-medium text-sm" style={{ color: 'var(--admin-fg)' }}>{submission.full_name}</p>
        <p className="text-xs" style={{ color: 'var(--admin-fg-muted)' }}>
          {submission.country_of_origin} &mdash; {format(new Date(submission.created_at), 'd MMM yyyy', { locale: es })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="bg-amber-100 text-amber-800">Pendiente</Badge>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#002855] text-white rounded-lg hover:bg-[#001d3d] transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          PDF
        </button>
        <button
          onClick={handleMarkReviewed}
          disabled={marking}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {marking ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle className="w-3.5 h-3.5" />
          )}
          Revisado
        </button>
      </div>
    </div>
  )
}

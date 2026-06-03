'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Download, CheckCircle, Archive, ChevronDown, ChevronUp,
  Loader2, User, MapPin, Calendar, AlertTriangle, ShieldAlert, MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { generateCredibleFearPDF, type CredibleFearPDFInput } from '@/lib/pdf/generate-credible-fear-pdf'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Submission {
  id: string
  created_at: string
  full_name: string
  date_of_birth: string
  country_of_origin: string
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
  admin_notes: string | null
}

const statusConfig: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pendiente', class: 'bg-amber-100 text-amber-800' },
  reviewed: { label: 'Revisado', class: 'bg-green-100 text-green-800' },
  archived: { label: 'Archivado', class: 'bg-gray-100 text-gray-600' },
}

export function CredibleFearRow({ submission }: { submission: Submission }) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(submission.status)
  const [updating, setUpdating] = useState(false)
  const [notes, setNotes] = useState(submission.admin_notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  const statusInfo = statusConfig[status] || statusConfig.pending

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

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('credible_fear_submissions')
        .update({ status: newStatus })
        .eq('id', submission.id)

      if (error) {
        toast.error('Error al actualizar')
        return
      }
      setStatus(newStatus)
      toast.success(`Marcado como ${statusConfig[newStatus]?.label || newStatus}`)
    } catch {
      toast.error('Error de conexion')
    } finally {
      setUpdating(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('credible_fear_submissions')
        .update({ admin_notes: notes })
        .eq('id', submission.id)

      if (error) {
        toast.error('Error al guardar notas')
        return
      }
      toast.success('Notas guardadas')
    } catch {
      toast.error('Error de conexion')
    } finally {
      setSavingNotes(false)
    }
  }

  return (
    <Card className={status === 'pending' ? 'border-amber-200' : ''}>
      <CardContent className="p-0">
        {/* Header row - always visible */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#002855]/10 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-[#002855]" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate" style={{ color: 'var(--admin-fg)' }}>{submission.full_name}</p>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--admin-fg-muted)' }}>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {submission.country_of_origin}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(submission.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                </span>
                {submission.still_receiving_threats && (
                  <span className="flex items-center gap-1 text-red-600 font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    Amenazas activas
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={statusInfo.class}>{statusInfo.label}</Badge>
            {expanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--admin-fg-subtle)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--admin-fg-subtle)' }} />}
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t px-4 pb-4">
            {/* Action buttons */}
            <div className="flex items-center gap-2 py-3 border-b mb-4">
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#002855] text-white rounded-lg hover:bg-[#001d3d] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar PDF
              </button>
              {status !== 'reviewed' && (
                <button
                  onClick={() => updateStatus('reviewed')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Marcar Revisado
                </button>
              )}
              {status !== 'archived' && (
                <button
                  onClick={() => updateStatus('archived')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                  Archivar
                </button>
              )}
              {status !== 'pending' && (
                <button
                  onClick={() => updateStatus('pending')}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Volver a Pendiente
                </button>
              )}
            </div>

            {/* 5 sections of info */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Section 1: Info Personal */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Informacion Personal
                </h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Nombre" value={submission.full_name} />
                  <InfoField label="Fecha de nacimiento" value={formatDate(submission.date_of_birth)} />
                  <InfoField label="Pais de origen" value={submission.country_of_origin} />
                  <InfoField label="Fecha de entrada" value={formatDate(submission.entry_date)} />
                  <InfoField label="Metodo de entrada" value={submission.entry_method} />
                </dl>
              </div>

              {/* Section 2: Motivo de Salida */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  Motivo de Salida
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{submission.reason_for_leaving}</p>
              </div>

              {/* Section 3: Persecucion */}
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Eventos de Persecucion
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <dl className="space-y-2 text-sm">
                      <InfoField label="Quien le hizo dano" value={submission.who_harmed} />
                      <InfoField label="Cuando paso" value={submission.when_happened} />
                      <InfoField label="Donde paso" value={submission.where_happened} />
                      <InfoField label="Testigos" value={submission.had_witnesses ? `Si — ${submission.witnesses_detail || ''}` : 'No'} />
                      <InfoField label="Evidencia" value={submission.has_evidence ? `Si — ${submission.evidence_detail || ''}` : 'No'} />
                    </dl>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Que paso exactamente:</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border">{submission.what_happened}</p>
                  </div>
                </div>
              </div>

              {/* Section 4: Proteccion */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#002855] mb-3">Proteccion en su Pais</h3>
                <dl className="space-y-2 text-sm">
                  <InfoField label="Fue a la policia" value={submission.went_to_police ? 'Si' : 'No'} />
                  {!submission.went_to_police && submission.why_not_police && (
                    <InfoField label="Por que no" value={submission.why_not_police} />
                  )}
                  {submission.went_to_police && submission.police_response && (
                    <InfoField label="Respuesta policial" value={submission.police_response} />
                  )}
                </dl>
              </div>

              {/* Section 5: Temor Actual */}
              <div className={`bg-gray-50 rounded-lg p-4 ${submission.still_receiving_threats ? 'ring-1 ring-red-200' : ''}`}>
                <h3 className="text-sm font-semibold text-[#002855] mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Temor Actual
                </h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Que pasaria si regresa:</p>
                    <p className="text-sm text-gray-700 mt-0.5">{submission.fear_if_return}</p>
                  </div>
                  <InfoField label="Quien lo buscaria" value={submission.who_would_look} />
                  <InfoField
                    label="Amenazas activas"
                    value={submission.still_receiving_threats ? `Si — ${submission.threats_detail || ''}` : 'No'}
                    highlight={submission.still_receiving_threats}
                  />
                </dl>
              </div>
            </div>

            {/* Admin Notes */}
            <div className="mt-4 bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[#002855] mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                Notas del Administrador
              </h3>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Agregar notas sobre este caso..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#002855]/30 focus:border-[#002855] bg-white"
              />
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="mt-2 px-4 py-1.5 text-xs font-medium bg-[#002855] text-white rounded-lg hover:bg-[#001d3d] transition-colors disabled:opacity-50"
              >
                {savingNotes ? 'Guardando...' : 'Guardar Notas'}
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InfoField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className={`text-sm ${highlight ? 'text-red-700 font-medium' : 'text-gray-700'}`}>{value}</dd>
    </div>
  )
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })
  } catch {
    return dateStr
  }
}

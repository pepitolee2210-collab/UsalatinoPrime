'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Loader2, CheckCircle, AlertTriangle, Clock, Shield, Users, Globe, Scale, Pencil, X,
} from 'lucide-react'

interface FormSubmission {
  id: string
  form_type: string
  form_data: Record<string, unknown>
  status: string
  admin_notes?: string
  updated_at: string
}

interface I589ReviewProps {
  caseId: string
  submissions: FormSubmission[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  submitted: { label: 'Pendiente de revisión', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Aprobado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  needs_correction: { label: 'Correcciones solicitadas', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  draft: { label: 'Borrador (no enviado)', color: 'bg-gray-100 text-gray-600', icon: Clock },
}

const ASYLUM_REASON_LABELS: Record<string, string> = {
  raza: 'Raza',
  religion: 'Religión',
  nacionalidad: 'Nacionalidad',
  opinion_politica: 'Opinión política',
  grupo_social: 'Grupo social determinado',
  tortura: 'Convención contra la Tortura',
}

export function I589Review({ caseId, submissions }: I589ReviewProps) {
  const [subs, setSubs] = useState(submissions)
  const [loading, setLoading] = useState(false)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const b1 = subs.find(s => s.form_type === 'i589_part_b1')
  const b2 = subs.find(s => s.form_type === 'i589_part_b2')
  const c1 = subs.find(s => s.form_type === 'i589_part_c1')
  const c2 = subs.find(s => s.form_type === 'i589_part_c2')

  const hasAny = b1 || b2 || c1 || c2
  const allApproved = [b1, b2, c1, c2].filter(Boolean).every(s => s!.status === 'approved')

  async function updateStatus(submissionId: string, newStatus: string, adminNotes?: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/client-story-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, status: newStatus, admin_notes: adminNotes }),
      })
      if (!res.ok) throw new Error('Error al actualizar')
      setSubs(prev => prev.map(s =>
        s.id === submissionId ? { ...s, status: newStatus, admin_notes: adminNotes || s.admin_notes } : s
      ))
      toast.success(newStatus === 'approved' ? 'Aprobado' : 'Correcciones solicitadas')
      setEditingNotes(null)
    } catch {
      toast.error('Error al actualizar estado')
    } finally {
      setLoading(false)
    }
  }

  if (!hasAny) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-gray-400" />
        </div>
        <h4 className="font-semibold text-gray-700 mb-1">Sin formulario I-589</h4>
        <p className="text-sm text-gray-500">El cliente aún no ha llenado las Partes B y C del formulario I-589.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {allApproved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span className="text-sm text-green-700 font-medium">Todo el formulario I-589 ha sido aprobado</span>
        </div>
      )}

      {b1 && (
        <ReviewCard
          title="Parte B.1 — Motivos de Asilo"
          icon={<Shield className="w-4 h-4" />}
          submission={b1}
          loading={loading}
          editingNotes={editingNotes}
          notes={notes}
          onEditNotes={(id) => { setEditingNotes(id); setNotes(b1.admin_notes || '') }}
          onCancelNotes={() => setEditingNotes(null)}
          onNotesChange={setNotes}
          onApprove={(id) => updateStatus(id, 'approved')}
          onRequestCorrections={(id) => updateStatus(id, 'needs_correction', notes)}
        >
          <PartB1Details data={b1.form_data} />
        </ReviewCard>
      )}

      {b2 && (
        <ReviewCard
          title="Parte B.2-4 — Antecedentes"
          icon={<Users className="w-4 h-4" />}
          submission={b2}
          loading={loading}
          editingNotes={editingNotes}
          notes={notes}
          onEditNotes={(id) => { setEditingNotes(id); setNotes(b2.admin_notes || '') }}
          onCancelNotes={() => setEditingNotes(null)}
          onNotesChange={setNotes}
          onApprove={(id) => updateStatus(id, 'approved')}
          onRequestCorrections={(id) => updateStatus(id, 'needs_correction', notes)}
        >
          <PartB2Details data={b2.form_data} />
        </ReviewCard>
      )}

      {c1 && (
        <ReviewCard
          title="Parte C.1-2 — Solicitudes Previas"
          icon={<Globe className="w-4 h-4" />}
          submission={c1}
          loading={loading}
          editingNotes={editingNotes}
          notes={notes}
          onEditNotes={(id) => { setEditingNotes(id); setNotes(c1.admin_notes || '') }}
          onCancelNotes={() => setEditingNotes(null)}
          onNotesChange={setNotes}
          onApprove={(id) => updateStatus(id, 'approved')}
          onRequestCorrections={(id) => updateStatus(id, 'needs_correction', notes)}
        >
          <PartC1Details data={c1.form_data} />
        </ReviewCard>
      )}

      {c2 && (
        <ReviewCard
          title="Parte C.3-6 — Historial"
          icon={<Scale className="w-4 h-4" />}
          submission={c2}
          loading={loading}
          editingNotes={editingNotes}
          notes={notes}
          onEditNotes={(id) => { setEditingNotes(id); setNotes(c2.admin_notes || '') }}
          onCancelNotes={() => setEditingNotes(null)}
          onNotesChange={setNotes}
          onApprove={(id) => updateStatus(id, 'approved')}
          onRequestCorrections={(id) => updateStatus(id, 'needs_correction', notes)}
        >
          <PartC2Details data={c2.form_data} />
        </ReviewCard>
      )}
    </div>
  )
}

// -- Subcomponents --

function ReviewCard({
  title, icon, submission, loading, editingNotes, notes, children,
  onEditNotes, onCancelNotes, onNotesChange, onApprove, onRequestCorrections,
}: {
  title: string; icon: React.ReactNode; submission: FormSubmission
  loading: boolean; editingNotes: string | null; notes: string; children: React.ReactNode
  onEditNotes: (id: string) => void; onCancelNotes: () => void; onNotesChange: (v: string) => void
  onApprove: (id: string) => void; onRequestCorrections: (id: string) => void
}) {
  const config = STATUS_CONFIG[submission.status] || STATUS_CONFIG.draft
  const StatusIcon = config.icon
  const isEditing = editingNotes === submission.id

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">{icon} {title}</CardTitle>
          <Badge className={config.color}>
            <StatusIcon className="w-3 h-3 mr-1" />{config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}

        {submission.admin_notes && !isEditing && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-medium text-amber-700 mb-1">Notas del consultor:</p>
            <p className="text-sm text-amber-800">{submission.admin_notes}</p>
          </div>
        )}

        {submission.status !== 'draft' && (
          <div className="flex items-center gap-2 pt-2 border-t">
            {isEditing ? (
              <div className="flex-1 space-y-2">
                <Textarea value={notes} onChange={e => onNotesChange(e.target.value)} placeholder="Escribe las correcciones necesarias..." rows={3} />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => onRequestCorrections(submission.id)} disabled={loading || !notes.trim()}>
                    {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                    Enviar correcciones
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onCancelNotes}>
                    <X className="w-3 h-3 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {submission.status !== 'approved' && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onApprove(submission.id)} disabled={loading}>
                    {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                    Aprobar
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => onEditNotes(submission.id)} disabled={loading}>
                  <Pencil className="w-3 h-3 mr-1" />
                  {submission.status === 'approved' ? 'Agregar notas' : 'Pedir correcciones'}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function YesNoRow({ label, value, details }: { label: string; value?: string; details?: string }) {
  const display = value === 'yes' ? 'Sí' : value === 'no' ? 'No' : null
  if (!display) return null
  return (
    <div>
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <p className="text-sm text-gray-800 font-medium">{display}</p>
      {value === 'yes' && details && (
        <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1 pl-3 border-l-2 border-gray-200">{details}</p>
      )}
    </div>
  )
}

function PartB1Details({ data }: { data: Record<string, unknown> }) {
  const reasons = (data.asylum_reasons as string[]) || []
  return (
    <div className="grid gap-3">
      <DataRow
        label="Motivos de la solicitud"
        value={reasons.map(r => ASYLUM_REASON_LABELS[r] || r).join(', ') || null}
      />
      <YesNoRow label="¿Ha sufrido daño, maltrato o amenazas?" value={data.has_suffered_harm as string} details={data.harm_details as string} />
      <YesNoRow label="¿Teme regresar a su país?" value={data.fears_return as string} details={data.fear_details as string} />
    </div>
  )
}

function PartB2Details({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid gap-3">
      <YesNoRow label="¿Arrestado/detenido en otro país?" value={data.arrested_abroad as string} details={data.arrested_abroad_details as string} />
      <YesNoRow label="¿Miembro de organizaciones?" value={data.member_organizations as string} details={data.organizations_details as string} />
      <YesNoRow label="¿Sigue participando?" value={data.still_participating as string} details={data.still_participating_details as string} />
      <YesNoRow label="¿Teme tortura?" value={data.fears_torture as string} details={data.torture_details as string} />
    </div>
  )
}

function PartC1Details({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid gap-3">
      <YesNoRow label="¿Ha solicitado asilo antes en EE.UU.?" value={data.applied_before as string} details={data.applied_before_details as string} />
      <YesNoRow label="¿Viajó por otros países?" value={data.traveled_other_countries as string} />
      <YesNoRow label="¿Estatus legal en otro país?" value={data.legal_status_other_country as string} />
      <DataRow label="Detalles de países" value={data.other_countries_details as string} />
    </div>
  )
}

function PartC2Details({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid gap-3">
      <YesNoRow label="¿Ha causado daño a alguien?" value={data.caused_harm as string} details={data.caused_harm_details as string} />
      <YesNoRow label="¿Regresó al país de daño?" value={data.returned_to_country as string} details={data.returned_details as string} />
      <YesNoRow label="¿Solicitud después de 1 año?" value={data.filing_after_one_year as string} details={data.filing_delay_reason as string} />
      <YesNoRow label="¿Delitos en EE.UU.?" value={data.crimes_in_us as string} details={data.crimes_details as string} />
    </div>
  )
}

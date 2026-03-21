'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Loader2, CheckCircle, AlertTriangle, Clock, BookOpen,
  Users, UserX, Pencil, X, ChevronDown, ChevronRight, FileText,
} from 'lucide-react'

interface FormSubmission {
  id: string
  form_type: string
  form_data: Record<string, unknown>
  status: string
  minor_index?: number
  admin_notes?: string
  updated_at: string
}

interface DeclarationDoc {
  id: string
  name: string
  file_size: number
  declaration_number: number
}

interface ClientStoryReviewProps {
  caseId: string
  submissions: FormSubmission[]
  declarationDocs?: DeclarationDoc[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  submitted:        { label: 'Pendiente de revisión',    color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved:         { label: 'Aprobado',                 color: 'bg-green-100 text-green-800',   icon: CheckCircle },
  needs_correction: { label: 'Correcciones solicitadas', color: 'bg-red-100 text-red-800',       icon: AlertTriangle },
  draft:            { label: 'Borrador (no enviado)',    color: 'bg-gray-100 text-gray-600',     icon: Clock },
}

const PARENT_SITUATIONS: Record<string, string> = {
  cooperates:  'Coopera — dispuesto/a a firmar',
  absent:      'Ausente — sin contacto',
  deceased:    'Fallecido/a',
  unknown:     'Desconocido',
  never_known: 'Nunca lo/la conoció',
}

function djLabel(idx: number) {
  if (idx === 0) return 'Primera Declaración Jurada'
  return `Declaración Jurada ${idx + 1}`
}

function djShortLabel(idx: number) {
  if (idx === 0) return 'DJ 1'
  return `DJ ${idx + 1}`
}

function djStatusSummary(story?: FormSubmission, parent?: FormSubmission, witnesses?: FormSubmission) {
  const subs = [story, parent, witnesses].filter(Boolean) as FormSubmission[]
  if (!subs.length) return 'draft'
  if (subs.every(s => s.status === 'approved')) return 'approved'
  if (subs.some(s => s.status === 'needs_correction')) return 'needs_correction'
  if (subs.some(s => s.status === 'submitted')) return 'submitted'
  return 'draft'
}

export function ClientStoryReview({ caseId: _caseId, submissions, declarationDocs = [] }: ClientStoryReviewProps) {
  const [subs, setSubs] = useState(submissions)
  const [loading, setLoading] = useState(false)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [expandedDJs, setExpandedDJs] = useState<Set<number>>(new Set([0]))

  // Extract tutor_guardian submission (separate from DJs)
  const tutorSubmission = subs.find(s => s.form_type === 'tutor_guardian')

  // Group remaining by minor_index
  const djMap = new Map<number, { story?: FormSubmission; parent?: FormSubmission; witnesses?: FormSubmission }>()
  for (const s of subs) {
    if (s.form_type === 'tutor_guardian') continue
    const idx = s.minor_index ?? 0
    if (!djMap.has(idx)) djMap.set(idx, {})
    const g = djMap.get(idx)!
    if (s.form_type === 'client_story')          g.story     = s
    else if (s.form_type === 'client_absent_parent') g.parent = s
    else if (s.form_type === 'client_witnesses') g.witnesses  = s
  }

  const sortedIndices = [...djMap.keys()].sort()
  const isMultiDJ = sortedIndices.length > 1

  if (!sortedIndices.length && !tutorSubmission) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-gray-400" />
        </div>
        <h4 className="font-semibold text-gray-700 mb-1">Sin historia del cliente</h4>
        <p className="text-sm text-gray-500">El cliente aún no ha llenado el formulario de su historia.</p>
      </div>
    )
  }

  const allFullyApproved = sortedIndices.every(idx => {
    const g = djMap.get(idx)!
    return djStatusSummary(g.story, g.parent, g.witnesses) === 'approved'
  })

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

  function toggleDJ(idx: number) {
    setExpandedDJs(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {allFullyApproved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span className="text-sm text-green-700 font-medium">
            Toda la historia del cliente ha sido aprobada
          </span>
        </div>
      )}

      {/* Tutor/Guardian Declaration — 30 questions */}
      {tutorSubmission && (
        <div className="border border-blue-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 bg-blue-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-blue-600" />
              </div>
              <span className="font-semibold text-blue-900 text-sm">Declaración del Tutor / Guardián</span>
            </div>
            <Badge className={STATUS_CONFIG[tutorSubmission.status]?.color || STATUS_CONFIG.draft.color}>
              {STATUS_CONFIG[tutorSubmission.status]?.label || 'Borrador'}
            </Badge>
          </div>
          <div className="p-5">
            <TutorReviewDetails data={tutorSubmission.form_data} />
            {/* Actions */}
            {tutorSubmission.status !== 'draft' && (
              <div className="flex items-center gap-2 pt-3 mt-3 border-t">
                {editingNotes === tutorSubmission.id ? (
                  <div className="flex-1 space-y-2">
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Correcciones..." rows={3} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" disabled={loading || !notes.trim()}
                        onClick={() => updateStatus(tutorSubmission.id, 'needs_correction', notes)}>
                        Enviar correcciones
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNotes(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {tutorSubmission.status !== 'approved' && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={loading}
                        onClick={() => updateStatus(tutorSubmission.id, 'approved')}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Aprobar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={loading}
                      onClick={() => { setEditingNotes(tutorSubmission.id); setNotes(tutorSubmission.admin_notes || '') }}>
                      <Pencil className="w-3 h-3 mr-1" /> {tutorSubmission.status === 'approved' ? 'Agregar notas' : 'Pedir correcciones'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {sortedIndices.map(idx => {
        const g = djMap.get(idx)!
        const overallStatus = djStatusSummary(g.story, g.parent, g.witnesses)
        const config = STATUS_CONFIG[overallStatus] || STATUS_CONFIG.draft
        const StatusIcon = config.icon
        const isExpanded = expandedDJs.has(idx)
        const djDocs = declarationDocs.filter(d => d.declaration_number === idx + 1)

        return (
          <div key={idx} className="border border-gray-200 rounded-2xl overflow-hidden">
            {/* DJ header — collapsible when multiple */}
            <button
              className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              onClick={() => isMultiDJ && toggleDJ(idx)}
            >
              <div className="flex items-center gap-3">
                {isMultiDJ && (
                  isExpanded
                    ? <ChevronDown className="w-4 h-4 text-gray-500" />
                    : <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <span className="font-semibold text-gray-800 text-sm">{djLabel(idx)}</span>
                {isMultiDJ && (
                  <span className="text-xs text-gray-400">{djShortLabel(idx)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {djDocs.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-2 py-1">
                    <FileText className="w-3 h-3" />
                    {djDocs.length} doc{djDocs.length !== 1 ? 's' : ''}
                  </span>
                )}
                <Badge className={config.color}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {config.label}
                </Badge>
              </div>
            </button>

            {/* DJ content */}
            {(!isMultiDJ || isExpanded) && (
              <div className="p-4 space-y-4">
                {/* Declaration docs */}
                {djDocs.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-xs font-semibold text-blue-700 mb-2">
                      Documentos subidos ({djLabel(idx)})
                    </p>
                    <div className="space-y-1">
                      {djDocs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="text-xs text-blue-800 truncate">{doc.name}</span>
                          <span className="text-[10px] text-blue-500 shrink-0">
                            {(doc.file_size / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Story */}
                {g.story && (
                  <ReviewCard
                    title="Historia del Cliente"
                    icon={<BookOpen className="w-4 h-4" />}
                    submission={g.story}
                    loading={loading}
                    editingNotes={editingNotes}
                    notes={notes}
                    onEditNotes={(id) => { setEditingNotes(id); setNotes(g.story!.admin_notes || '') }}
                    onCancelNotes={() => setEditingNotes(null)}
                    onNotesChange={setNotes}
                    onApprove={(id) => updateStatus(id, 'approved')}
                    onRequestCorrections={(id) => updateStatus(id, 'needs_correction', notes)}
                  >
                    <StoryDetails data={g.story.form_data} />
                  </ReviewCard>
                )}

                {/* Parent */}
                {g.parent && (
                  <ReviewCard
                    title="Padre/Madre Ausente"
                    icon={<UserX className="w-4 h-4" />}
                    submission={g.parent}
                    loading={loading}
                    editingNotes={editingNotes}
                    notes={notes}
                    onEditNotes={(id) => { setEditingNotes(id); setNotes(g.parent!.admin_notes || '') }}
                    onCancelNotes={() => setEditingNotes(null)}
                    onNotesChange={setNotes}
                    onApprove={(id) => updateStatus(id, 'approved')}
                    onRequestCorrections={(id) => updateStatus(id, 'needs_correction', notes)}
                  >
                    <ParentDetails data={g.parent.form_data} />
                  </ReviewCard>
                )}

                {/* Witnesses */}
                {g.witnesses && (
                  <ReviewCard
                    title="Testigos"
                    icon={<Users className="w-4 h-4" />}
                    submission={g.witnesses}
                    loading={loading}
                    editingNotes={editingNotes}
                    notes={notes}
                    onEditNotes={(id) => { setEditingNotes(id); setNotes(g.witnesses!.admin_notes || '') }}
                    onCancelNotes={() => setEditingNotes(null)}
                    onNotesChange={setNotes}
                    onApprove={(id) => updateStatus(id, 'approved')}
                    onRequestCorrections={(id) => updateStatus(id, 'needs_correction', notes)}
                  >
                    <WitnessDetails data={g.witnesses.form_data} />
                  </ReviewCard>
                )}

                {/* No submissions yet for this DJ */}
                {!g.story && !g.parent && !g.witnesses && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    El cliente aún no ha llenado esta declaración.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ReviewCard({
  title, icon, submission, loading, editingNotes, notes, children,
  onEditNotes, onCancelNotes, onNotesChange, onApprove, onRequestCorrections,
}: {
  title: string
  icon: React.ReactNode
  submission: FormSubmission
  loading: boolean
  editingNotes: string | null
  notes: string
  children: React.ReactNode
  onEditNotes: (id: string) => void
  onCancelNotes: () => void
  onNotesChange: (v: string) => void
  onApprove: (id: string) => void
  onRequestCorrections: (id: string) => void
}) {
  const config = STATUS_CONFIG[submission.status] || STATUS_CONFIG.draft
  const StatusIcon = config.icon
  const isEditing = editingNotes === submission.id

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {icon} {title}
          </CardTitle>
          <Badge className={config.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {config.label}
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
                <Textarea
                  value={notes}
                  onChange={e => onNotesChange(e.target.value)}
                  placeholder="Escribe las correcciones necesarias..."
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onRequestCorrections(submission.id)}
                    disabled={loading || !notes.trim()}
                  >
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
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => onApprove(submission.id)}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                    Aprobar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEditNotes(submission.id)}
                  disabled={loading}
                >
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

function StoryDetails({ data }: { data: Record<string, unknown> }) {
  const mb = data.minorBasic as Record<string, string> | undefined
  const ma = data.minorAbuse as Record<string, string> | undefined
  const mbi = data.minorBestInterest as Record<string, string> | undefined
  const isNewFormat = !!(mb || ma || mbi)

  // Legacy fields
  const children = data.children as Array<Record<string, string>> | undefined
  const minorInfo = data.minor_info as Record<string, string> | undefined

  if (isNewFormat) {
    return (
      <div className="space-y-3">
        {/* New format: 30 questions in sections */}
        {mb && (
          <ReviewSection title="1. Información Básica del Menor" color="bg-blue-50 border-blue-100">
            <DataRow label="Nombre completo" value={mb.full_name} />
            <DataRow label="Fecha de nacimiento" value={mb.dob} />
            <DataRow label="País" value={mb.country} />
            <DataRow label="Estado civil" value={mb.civil_status} />
            <DataRow label="Dirección actual" value={mb.address} />
            <DataRow label="Vive con" value={mb.lives_with} />
            <DataRow label="Relación" value={mb.lives_with_relationship} />
            <DataRow label="Cómo llegó a EE.UU." value={mb.how_arrived} />
            <DataRow label="Acompañado por" value={mb.accompanied_by} />
            <DataRow label="Detenido por migración" value={mb.detained_by_immigration} />
            <DataRow label="Liberado por ORR" value={mb.released_by_orr} />
            {mb.orr_sponsor && <DataRow label="Patrocinador ORR" value={mb.orr_sponsor} />}
          </ReviewSection>
        )}
        {ma && (
          <ReviewSection title="2. Hechos de Maltrato" color="bg-red-50 border-red-100">
            <DataRow label="Vida en país de origen" value={ma.life_in_country} />
            <DataRow label="Abuso por parte del padre" value={ma.abuse_by_father} />
            <DataRow label="Abuso por parte de la madre" value={ma.abuse_by_mother} />
            <DataRow label="Abuso físico" value={ma.physical_abuse} />
            <DataRow label="Abuso emocional" value={ma.emotional_abuse} />
            <DataRow label="Negligencia" value={ma.negligence} />
            <DataRow label="Abandono" value={ma.abandonment} />
            <DataRow label="Sustancias/actividades ilegales del padre" value={ma.parent_substance_abuse} />
          </ReviewSection>
        )}
        {mbi && (
          <ReviewSection title="3. Mejor Interés y Situación" color="bg-amber-50 border-amber-100">
            <DataRow label="Reportó a autoridades" value={mbi.reported_to_authorities} />
            {mbi.report_details && <DataRow label="Detalle de reporte" value={mbi.report_details} />}
            <DataRow label="Cicatrices/marcas" value={mbi.physical_scars} />
            <DataRow label="Recibió terapia" value={mbi.therapy_received} />
            {mbi.therapy_details && <DataRow label="Detalle terapia" value={mbi.therapy_details} />}
            <DataRow label="Miedo de regresar" value={mbi.fear_of_return} />
            <DataRow label="Amenazas de pandillas" value={mbi.gang_threats} />
            <DataRow label="Cuidador en país de origen" value={mbi.caretaker_in_country} />
            <DataRow label="Vida actual en EE.UU." value={mbi.current_life_us} />
            <DataRow label="Asiste a la escuela" value={mbi.attends_school} />
            <DataRow label="Hogar seguro" value={mbi.safe_home} />
            <DataRow label="Problemas legales" value={mbi.legal_problems} />
            <DataRow label="Desea quedarse en EE.UU." value={mbi.wants_to_stay} />
            {mbi.why_stay && <DataRow label="Por qué desea quedarse" value={mbi.why_stay} />}
          </ReviewSection>
        )}
      </div>
    )
  }

  // Legacy format
  return (
    <div className="grid gap-3">
      {children && children.length > 0 && (
        <div>
          <span className="text-xs font-medium text-gray-500">
            {children.length === 1 ? 'Menor' : `Menores (${children.length})`}
          </span>
          <div className="mt-1 space-y-1">
            {children.filter(c => c.name).map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-800">
                <span className="font-medium">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!children && minorInfo?.name && <DataRow label="Menor" value={minorInfo.name} />}
      <DataRow label="Año de llegada"                  value={data.arrival_year as string} />
      <DataRow label="Quién lo/la trajo"               value={data.who_brought as string} />
      <DataRow label="Vive con"                        value={data.current_guardian as string} />
      <DataRow label="Cómo fue el abandono"            value={(data.how_was_abandonment || data.abandonment_description) as string} />
      <DataRow label="Apoyo económico del padre"       value={data.father_economic_support as string} />
      <DataRow label="Contacto del padre con el menor" value={data.father_contact_with_child as string} />
      <DataRow label="Quién cuidó al menor"            value={data.who_took_care as string} />
      <DataRow label="Por qué no hubo reunificación"   value={data.why_no_reunification as string} />
      <DataRow label="Detalles adicionales"            value={data.additional_details as string} />
    </div>
  )
}

function ParentDetails({ data }: { data: Record<string, unknown> }) {
  const situation = data.situation as string
  return (
    <div className="grid gap-3">
      <DataRow label="Relación"  value={data.parent_relationship === 'padre' ? 'Padre' : 'Madre'} />
      <DataRow label="Situación" value={PARENT_SITUATIONS[situation] || situation} />
      <DataRow label="Nombre"    value={data.parent_name as string} />
      {situation === 'cooperates' && (
        <>
          <DataRow label="Teléfono"           value={data.parent_phone as string} />
          <DataRow label="Email"              value={data.parent_email as string} />
          <DataRow label="Dispuesto a firmar" value={data.willing_to_sign as string} />
        </>
      )}
      {situation === 'absent' && (
        <>
          <DataRow label="Último contacto"          value={data.last_contact_date as string} />
          <DataRow label="Descripción último contacto" value={data.last_contact_description as string} />
          <DataRow label="Razón de ausencia"        value={data.reason_absent as string} />
          <DataRow label="Intentos de localizar"    value={data.efforts_to_find as string} />
        </>
      )}
      {situation === 'deceased' && (
        <>
          <DataRow label="Fecha de fallecimiento"   value={data.death_date as string} />
          <DataRow label="Lugar"                    value={data.death_place as string} />
          <DataRow label="Certificado de defunción" value={data.has_death_certificate as string} />
        </>
      )}
      {(situation === 'unknown' || situation === 'never_known') && (
        <DataRow label="Información conocida" value={data.what_is_known as string} />
      )}
    </div>
  )
}

function WitnessDetails({ data }: { data: Record<string, unknown> }) {
  const witnesses = (data.witnesses as Array<Record<string, string>>) || []
  return (
    <div className="space-y-3">
      {witnesses.filter(w => w.name).map((w, i) => (
        <div key={i} className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-800">{w.name}</span>
            <Badge variant="secondary" className="text-[10px]">{w.relationship}</Badge>
          </div>
          {w.phone && <p className="text-xs text-gray-500">Tel: {w.phone}</p>}
          {w.address && <p className="text-xs text-gray-500">Dir: {w.address}</p>}
          <p className="text-sm text-gray-700 mt-1">{w.can_testify}</p>
        </div>
      ))}
    </div>
  )
}

// ── Tutor Review (30 legal questions) ─────────────────────────────

function ReviewSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`p-3 rounded-xl border ${color}`}>
      <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">{title}</p>
      <div className="grid gap-2">{children}</div>
    </div>
  )
}

function TutorReviewDetails({ data }: { data: Record<string, unknown> }) {
  const d = data as Record<string, string>
  const witnesses = (data.witnesses as unknown as Array<Record<string, string>>) || []

  return (
    <div className="space-y-3">
      {/* Sección 1: Información Básica */}
      <ReviewSection title="1. Información Básica del Declarante" color="bg-blue-50 border-blue-100">
        <DataRow label="Nombre completo" value={d.full_name} />
        <DataRow label="Relación con el menor" value={d.relationship_to_minor} />
        <DataRow label="Dirección" value={d.full_address} />
        <DataRow label="Tiempo en este estado" value={d.time_in_state} />
      </ReviewSection>

      {/* Sección 2: Sobre el Menor */}
      <ReviewSection title="2. Información del Menor" color="bg-indigo-50 border-indigo-100">
        <DataRow label="Nombre del menor" value={d.minor_full_name} />
        <DataRow label="Fecha de nacimiento" value={d.minor_dob} />
        <DataRow label="País de nacimiento" value={d.minor_country} />
        <DataRow label="Estado civil" value={d.minor_civil_status} />
        <DataRow label="Ubicación actual" value={d.minor_location} />
        <DataRow label="Vive con" value={d.minor_lives_with} />
        <DataRow label="Vive con esta persona desde" value={d.minor_lives_with_since} />
      </ReviewSection>

      {/* Sección 3: Hechos de Maltrato */}
      <ReviewSection title="3. Hechos de Maltrato" color="bg-red-50 border-red-100">
        <DataRow label="Por qué no puede reunificarse" value={d.why_cannot_reunify} />
        <DataRow label="Descripción del abuso/abandono/negligencia" value={d.abuse_description} />
        <DataRow label="Quién perpetró" value={d.who_perpetrated} />
        <DataRow label="Cuándo ocurrió" value={d.when_occurred} />
        <DataRow label="Dónde ocurrió" value={d.where_occurred} />
        <DataRow label="Evidencia disponible" value={d.evidence_exists} />
        {d.evidence_exists === 'Sí' && <DataRow label="Detalle de evidencia" value={d.evidence_description} />}
        <DataRow label="Menor recibió tratamiento" value={d.minor_treatment} />
        {d.minor_treatment === 'Sí' && <DataRow label="Detalle de tratamiento" value={d.treatment_description} />}
      </ReviewSection>

      {/* Sección 4: Mejor Interés */}
      <ReviewSection title="4. Mejor Interés del Menor" color="bg-amber-50 border-amber-100">
        <DataRow label="Riesgo si es devuelto" value={d.risk_if_returned} />
        <DataRow label="Cuidador en país de origen" value={d.caretaker_in_country} />
        <DataRow label="Acceso a servicios en país" value={d.access_to_services} />
        <DataRow label="Amenazas de pandillas" value={d.gang_threats} />
      </ReviewSection>

      {/* Sección 5: Proceso Legal */}
      <ReviewSection title="5. Proceso Legal" color="bg-gray-50 border-gray-200">
        <DataRow label="Guardián con antecedentes penales" value={d.guardian_criminal_record} />
        <DataRow label="Guardián puede proveer" value={d.guardian_can_provide} />
        <DataRow label="Otros miembros del hogar (+18)" value={d.household_members} />
        <DataRow label="Entiende limitaciones SIJS" value={d.understands_sijs} />
      </ReviewSection>

      {/* Testigos */}
      {witnesses.filter(w => w.name).length > 0 && (
        <ReviewSection title={`6. Testigos (${witnesses.filter(w => w.name).length})`} color="bg-purple-50 border-purple-100">
          {witnesses.filter(w => w.name).map((w, i) => (
            <div key={i} className="p-2 bg-white rounded-lg border border-purple-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">{w.name}</span>
                <Badge variant="secondary" className="text-[10px]">{w.relationship}</Badge>
              </div>
              {w.phone && <p className="text-xs text-gray-500">Tel: {w.phone}</p>}
              {w.address && <p className="text-xs text-gray-500">Dir: {w.address}</p>}
              {w.can_testify && <p className="text-xs text-gray-600 mt-1">{w.can_testify}</p>}
            </div>
          ))}
        </ReviewSection>
      )}
    </div>
  )
}

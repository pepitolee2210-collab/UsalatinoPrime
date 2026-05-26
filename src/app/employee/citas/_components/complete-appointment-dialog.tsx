'use client'

// CompleteAppointmentDialog: modal para que Vanessa/Diana marquen una cita
// como completada (con objetivo logrado/no), cancelada o no_show.
// Si marca "completed" y "objetivo no logrado", la próxima cita conserva
// su session_number — la lógica está en /api/employee/appointments/update-status.

import { useState } from 'react'
import { Loader2, X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export type DialogMode = 'complete' | 'cancel' | 'no_show'

interface CompleteAppointmentDialogProps {
  appointmentId: string
  sessionNumber: number
  mode: DialogMode
  onClose: () => void
  onDone: () => void
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono-tech)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.16em',
  color: 'var(--admin-fg-subtle)',
  textTransform: 'uppercase',
}

export function CompleteAppointmentDialog({
  appointmentId,
  sessionNumber,
  mode,
  onClose,
  onDone,
}: CompleteAppointmentDialogProps) {
  const [objectiveCompleted, setObjectiveCompleted] = useState(true)
  const [noteBody, setNoteBody] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [saving, setSaving] = useState(false)

  function tryClose() {
    if ((noteBody.trim() || cancelReason.trim()) && !saving) {
      if (!window.confirm('Tienes cambios sin guardar. ¿Cerrar?')) return
    }
    onClose()
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        appointment_id: appointmentId,
        status: mode === 'complete' ? 'completed' : mode === 'no_show' ? 'no_show' : 'cancelled',
      }
      if (mode === 'complete') {
        body.objective_completed = objectiveCompleted
        if (noteBody.trim()) body.session_note_body = noteBody.trim()
      } else if (mode === 'cancel') {
        if (cancelReason.trim()) body.cancellation_reason = cancelReason.trim()
        if (noteBody.trim()) body.session_note_body = noteBody.trim()
      } else {
        if (noteBody.trim()) body.session_note_body = noteBody.trim()
      }

      const res = await fetch('/api/employee/appointments/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error al actualizar')
      }
      toast.success(
        mode === 'complete'
          ? objectiveCompleted
            ? 'Cita completada · sesión avanza'
            : 'Cita completada · sesión continúa pendiente'
          : mode === 'no_show'
          ? 'Marcado como no-show'
          : 'Cita cancelada',
      )
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const title =
    mode === 'complete'
      ? `Cerrar Cita #${sessionNumber}`
      : mode === 'no_show'
      ? `Marcar cliente como no-show`
      : `Cancelar Cita #${sessionNumber}`

  const icon =
    mode === 'complete' ? (
      <CheckCircle className="w-5 h-5" style={{ color: 'var(--admin-green)' }} />
    ) : mode === 'no_show' ? (
      <AlertTriangle className="w-5 h-5" style={{ color: 'var(--admin-red)' }} />
    ) : (
      <XCircle className="w-5 h-5" style={{ color: 'var(--admin-fg-muted)' }} />
    )

  const confirmStyle: React.CSSProperties =
    mode === 'complete'
      ? {
          background: 'linear-gradient(135deg, var(--admin-green), #16A34A)',
          color: '#FFFFFF',
          boxShadow: '0 12px 28px rgba(21,128,61,0.25)',
        }
      : mode === 'no_show'
        ? {
            background: 'linear-gradient(135deg, var(--admin-red), #DC2626)',
            color: '#FFFFFF',
            boxShadow: '0 12px 28px rgba(185,28,28,0.25)',
          }
        : {
            background: 'linear-gradient(135deg, var(--admin-accent), var(--admin-blue))',
            color: '#FFFFFF',
            boxShadow: '0 12px 28px rgba(30,78,154,0.25)',
          }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={tryClose}
    >
      <div
        className="rounded-2xl max-w-md w-full overflow-hidden"
        style={{
          background: 'var(--admin-bg-elev)',
          border: '0.5px solid var(--admin-border-strong)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.30)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: '0.5px solid var(--admin-border)' }}
        >
          <div className="flex items-center gap-2">
            {icon}
            <p className="font-bold" style={{ color: 'var(--admin-fg)' }}>
              {title}
            </p>
          </div>
          <button
            onClick={tryClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
            style={{
              background: 'var(--admin-bg-elev-2)',
              color: 'var(--admin-fg-muted)',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {mode === 'complete' && (
            <>
              <div
                className="rounded-xl p-3"
                style={{
                  background: 'var(--admin-bg-elev-2)',
                  border: '0.5px solid var(--admin-border)',
                }}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={objectiveCompleted}
                    onChange={(e) => setObjectiveCompleted(e.target.checked)}
                    className="mt-1 w-4 h-4"
                    style={{ accentColor: 'var(--admin-green)' }}
                  />
                  <div className="flex-1">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: 'var(--admin-fg)' }}
                    >
                      Se logro el objetivo de esta sesion
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: 'var(--admin-fg-muted)' }}
                    >
                      {objectiveCompleted ? (
                        <>
                          La proxima cita del caso sera la <strong>sesion #{sessionNumber + 1}</strong>.
                        </>
                      ) : (
                        <>
                          La cita queda registrada como ocurrida, pero la proxima cita seguira siendo
                          la <strong>sesion #{sessionNumber}</strong> (se retoma el objetivo pendiente).
                        </>
                      )}
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block mb-1.5" style={LABEL_STYLE}>
                  Notas de la sesion (opcional, visible a todo staff)
                </label>
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  rows={5}
                  placeholder="¿Qué se cubrió en la cita? ¿Qué quedó pendiente? ¿En qué quedaste con el cliente?"
                  className="text-sm"
                />
                <p
                  className="text-[10px] mt-1"
                  style={{ color: 'var(--admin-fg-subtle)' }}
                >
                  Se guardara como una nota nueva (no sobrescribe notas anteriores).
                </p>
              </div>
            </>
          )}

          {mode === 'cancel' && (
            <>
              <div
                className="rounded-xl p-3 flex items-start gap-2"
                style={{
                  background: 'var(--admin-gold-soft)',
                  border: '0.5px solid var(--admin-gold)',
                }}
              >
                <Info className="w-4 h-4 mt-0.5" style={{ color: 'var(--admin-gold)' }} />
                <p className="text-xs" style={{ color: 'var(--admin-gold)' }}>
                  La sesion <strong>#{sessionNumber}</strong> queda como no realizada.
                  La proxima cita conservara este numero de sesion.
                </p>
              </div>
              <div>
                <label className="block mb-1.5" style={LABEL_STYLE}>
                  Razon de cancelacion
                </label>
                <Textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Cliente pidió reagendar / Problema técnico / etc."
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block mb-1.5" style={LABEL_STYLE}>
                  Nota adicional (opcional)
                </label>
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  rows={3}
                  placeholder="Cualquier contexto extra que quieras dejar..."
                  className="text-sm"
                />
              </div>
            </>
          )}

          {mode === 'no_show' && (
            <>
              <div
                className="rounded-xl p-3 flex items-start gap-2"
                style={{
                  background: 'var(--admin-red-soft)',
                  border: '0.5px solid var(--admin-red)',
                }}
              >
                <Info className="w-4 h-4 mt-0.5" style={{ color: 'var(--admin-red)' }} />
                <p className="text-xs" style={{ color: 'var(--admin-red)' }}>
                  El cliente no se presento. La sesion <strong>#{sessionNumber}</strong>
                  conserva su numero — la proxima cita seguira siendo la misma sesion.
                </p>
              </div>
              <div>
                <label className="block mb-1.5" style={LABEL_STYLE}>
                  Nota (opcional)
                </label>
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  rows={3}
                  placeholder="¿Qué pasó? ¿Avisó? ¿Reagendamos?"
                  className="text-sm"
                />
              </div>
            </>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 p-4"
          style={{
            background: 'var(--admin-bg-deep)',
            borderTop: '0.5px solid var(--admin-border)',
          }}
        >
          <button
            type="button"
            onClick={tryClose}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              background: 'var(--admin-bg-elev)',
              color: 'var(--admin-fg-muted)',
              border: '0.5px solid var(--admin-border-strong)',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={confirmStyle}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

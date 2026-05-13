'use client'

// CompleteAppointmentDialog: modal para que Vanessa/Diana marquen una cita
// como completada (con objetivo logrado/no), cancelada o no_show.
// Si marca "completed" y "objetivo no logrado", la próxima cita conserva
// su session_number — la lógica está en /api/employee/appointments/update-status.

import { useState } from 'react'
import { Loader2, X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export type DialogMode = 'complete' | 'cancel' | 'no_show'

interface CompleteAppointmentDialogProps {
  appointmentId: string
  sessionNumber: number
  mode: DialogMode
  onClose: () => void
  onDone: () => void
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
      <CheckCircle className="w-5 h-5 text-emerald-600" />
    ) : mode === 'no_show' ? (
      <AlertTriangle className="w-5 h-5 text-red-600" />
    ) : (
      <XCircle className="w-5 h-5 text-gray-600" />
    )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={tryClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            {icon}
            <p className="font-bold text-gray-900">{title}</p>
          </div>
          <button onClick={tryClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {mode === 'complete' && (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={objectiveCompleted}
                    onChange={(e) => setObjectiveCompleted(e.target.checked)}
                    className="mt-1 w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      Se logró el objetivo de esta sesión
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {objectiveCompleted ? (
                        <>
                          La próxima cita del caso será la <strong>sesión #{sessionNumber + 1}</strong>.
                        </>
                      ) : (
                        <>
                          La cita queda registrada como ocurrida, pero la próxima cita seguirá siendo
                          la <strong>sesión #{sessionNumber}</strong> (se retoma el objetivo pendiente).
                        </>
                      )}
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5">
                  Notas de la sesión (opcional, visible a todo staff)
                </label>
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  rows={5}
                  placeholder="¿Qué se cubrió en la cita? ¿Qué quedó pendiente? ¿En qué quedaste con el cliente?"
                  className="text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Se guardará como una nota nueva (no sobrescribe notas anteriores).
                </p>
              </div>
            </>
          )}

          {mode === 'cancel' && (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 mt-0.5" />
                <p className="text-xs text-amber-800">
                  La sesión <strong>#{sessionNumber}</strong> queda como no realizada.
                  La próxima cita conservará este número de sesión.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5">
                  Razón de cancelación
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
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5">
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
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-red-700 mt-0.5" />
                <p className="text-xs text-red-800">
                  El cliente no se presentó. La sesión <strong>#{sessionNumber}</strong>
                  conserva su número — la próxima cita seguirá siendo la misma sesión.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5">
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

        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={tryClose}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className={
              mode === 'complete'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : mode === 'no_show'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-700 hover:bg-gray-800 text-white'
            }
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  )
}

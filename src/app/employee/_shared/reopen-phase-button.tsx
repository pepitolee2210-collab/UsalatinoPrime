'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { CasePhase } from '@/types/database'
import { PHASE_TOKENS } from './phase-tokens'

interface ReopenPhaseButtonProps {
  caseId: string
  caseNumber: string
  toPhase: CasePhase
}

export function ReopenPhaseButton({ caseId, caseNumber, toPhase }: ReopenPhaseButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const tokens = PHASE_TOKENS[toPhase]

  async function handleConfirm() {
    if (reason.trim().length < 5) {
      toast.error('Razón obligatoria (mínimo 5 caracteres)')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/advance-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toPhase, reason: reason.trim(), force: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al reabrir fase')
      }
      toast.success(`Fase reabierta: ${tokens.label}`)
      setOpen(false)
      setReason('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="text-[11px] text-gray-500 hover:text-gray-700 h-7 px-2"
      >
        <Undo2 className="w-3 h-3 mr-1" />
        Reabrir
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reabrir {tokens.label} — {caseNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-gray-600">
              Vas a regresar el caso a <strong>{tokens.label}</strong>. Esto cambia la fase actual y vuelve a permitir uploads y formularios de esa fase. La acción queda registrada en el histórico con tu razón.
            </p>
            <div>
              <label className="text-xs font-bold uppercase text-gray-600 mb-1 block">
                Razón (obligatorio)
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ej: Falta subir un documento adicional pedido por la corte estatal."
              />
              <p className="text-[10px] text-gray-400 mt-1 text-right">{reason.length}/500</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={submitting || reason.trim().length < 5}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar reapertura
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

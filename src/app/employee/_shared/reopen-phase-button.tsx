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
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full transition-colors"
        style={{
          background: 'var(--admin-bg-elev)',
          color: 'var(--admin-fg-muted)',
          border: '0.5px solid var(--admin-border-strong)',
          fontFamily: 'var(--font-mono-tech)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--admin-gold-border, var(--admin-gold))'
          e.currentTarget.style.color = 'var(--admin-gold)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--admin-border-strong)'
          e.currentTarget.style.color = 'var(--admin-fg-muted)'
        }}
      >
        <Undo2 className="w-3 h-3" />
        REABRIR
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reabrir {tokens.label} — {caseNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', lineHeight: 1.5 }}>
              Vas a regresar el caso a <strong style={{ color: 'var(--admin-fg)' }}>{tokens.label}</strong>. Esto cambia la fase actual y vuelve a permitir uploads y formularios de esa fase. La acción queda registrada en el histórico con tu razón.
            </p>
            <div>
              <label
                className="block mb-1"
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: 'var(--admin-fg-subtle)',
                  textTransform: 'uppercase',
                }}
              >
                Razón (obligatorio)
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ej: Falta subir un documento adicional pedido por la corte estatal."
              />
              <p
                className="text-right mt-1"
                style={{
                  fontSize: 10,
                  color: 'var(--admin-fg-subtle)',
                  fontFamily: 'var(--font-mono-tech)',
                }}
              >
                {reason.length}/500
              </p>
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

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, ArrowRight, AlertTriangle } from 'lucide-react'
import type { CasePhase } from '@/types/database'

interface PhaseStatusPanelProps {
  caseId: string
  caseNumber: string
  currentPhase: CasePhase | null
  processStart: CasePhase | null
  stateUs: string | null
  flags: {
    parent_deceased: boolean
    in_orr_custody: boolean
    has_criminal_history: boolean
    minor_close_to_21: boolean
  }
  isVisaJuvenil: boolean
}

const PHASE_META: Record<CasePhase, { label: string; bg: string; text: string; description: string }> = {
  custodia: {
    label: 'Fase 1 — Custodia',
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    description: 'Obtener orden de custodia con hallazgos SIJS de la corte estatal',
  },
  i360: {
    label: 'Fase 2 — I-360',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    description: 'Petición SIJS ante USCIS',
  },
  i485: {
    label: 'Fase 3 — I-485',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    description: 'Ajuste de estatus / Green Card',
  },
  completado: {
    label: 'Completado',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    description: 'Proceso SIJS completado',
  },
}

const NEXT_PHASE: Record<CasePhase, CasePhase | null> = {
  custodia: 'i360',
  i360: 'i485',
  i485: 'completado',
  completado: null,
}

export function PhaseStatusPanel({
  caseId,
  caseNumber,
  currentPhase,
  stateUs,
  flags,
  isVisaJuvenil,
}: PhaseStatusPanelProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toPhase, setToPhase] = useState<CasePhase | ''>(currentPhase ? NEXT_PHASE[currentPhase] ?? '' : '')

  if (!isVisaJuvenil) return null

  const meta = currentPhase ? PHASE_META[currentPhase] : null
  const nextPhase = currentPhase ? NEXT_PHASE[currentPhase] : null
  const isRetreat = currentPhase && toPhase && PHASE_ORDER[toPhase] < PHASE_ORDER[currentPhase]

  async function handleAdvance() {
    if (!toPhase || !reason.trim() || reason.trim().length < 5) {
      toast.error('Razón obligatoria (mínimo 5 caracteres)')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/advance-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhase,
          reason: reason.trim(),
          force: !!isRetreat,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al cambiar fase')
      }
      toast.success(`Caso avanzado a ${PHASE_META[toPhase as CasePhase]?.label}`)
      setDialogOpen(false)
      setReason('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  const activeFlags = Object.entries(flags).filter(([, v]) => v).map(([k]) => k)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Estado del caso SIJS</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {meta ? (
              <Badge className={`${meta.bg} ${meta.text} px-3 py-1 text-sm font-bold`}>{meta.label}</Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500">Sin fase asignada</Badge>
            )}
            {stateUs && (
              <Badge variant="outline" className="text-gray-700">Estado: {stateUs}</Badge>
            )}
            {activeFlags.length > 0 && activeFlags.map((f) => (
              <Badge key={f} className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px]">
                {humanizeFlag(f)}
              </Badge>
            ))}
          </div>
          {meta && (
            <p className="text-xs text-gray-500 mt-2 max-w-xl">{meta.description}</p>
          )}
        </div>
        {nextPhase && (
          <Button
            variant="default"
            onClick={() => { setToPhase(nextPhase); setDialogOpen(true) }}
            className="bg-[#002855] hover:bg-[#001a3a]"
          >
            Avanzar a {PHASE_META[nextPhase].label.split(' — ')[1]}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Avanzar de fase — {caseNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-gray-600 mb-1 block">Avanzar a</label>
              <Select value={toPhase} onValueChange={(v) => setToPhase(v as CasePhase)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona fase destino" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custodia">Fase 1 — Custodia</SelectItem>
                  <SelectItem value="i360">Fase 2 — I-360</SelectItem>
                  <SelectItem value="i485">Fase 3 — I-485</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isRetreat && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Estás retrocediendo de fase. Se enviará con `force=true`.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase text-gray-600 mb-1 block">Razón del cambio (obligatorio)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Ej: La corte aprobó la orden de custodia con hallazgos SIJS el 15 de marzo. Procedemos con I-360 ante USCIS."
                maxLength={500}
              />
              <p className="text-[10px] text-gray-400 mt-1 text-right">{reason.length}/500</p>
            </div>

            <div className="text-xs text-gray-500 p-3 rounded-lg bg-gray-50 border border-gray-200">
              ✦ Esto archivará automáticamente los documentos y formularios de la fase actual y le mostrará al cliente los nuevos requeridos para <strong>{toPhase ? PHASE_META[toPhase as CasePhase]?.label.split(' — ')[1] : '...'}</strong>.
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                onClick={handleAdvance}
                disabled={submitting || !toPhase || reason.trim().length < 5}
                className="bg-[#002855] hover:bg-[#001a3a]"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar avance
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const PHASE_ORDER: Record<CasePhase, number> = {
  custodia: 0,
  i360: 1,
  i485: 2,
  completado: 3,
}

function humanizeFlag(flag: string): string {
  const map: Record<string, string> = {
    parent_deceased: 'Padre/madre fallecido',
    in_orr_custody: 'Custodia ORR',
    has_criminal_history: 'Antecedentes criminales',
    minor_close_to_21: 'Próximo a cumplir 21',
  }
  return map[flag] || flag
}

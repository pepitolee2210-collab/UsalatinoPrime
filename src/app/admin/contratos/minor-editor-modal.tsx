'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Save, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface MinorRecord {
  fullName?: string
  dob?: string
  passport?: string
  birthplace?: string
}

interface Props {
  contractId: string
  minors: MinorRecord[]
  onClose: () => void
  onSaved: () => void
}

/**
 * Editor de menores existentes de un contrato firmado.
 *
 * Solo correcciones: cambiar nombre, fecha, passport, lugar de nacimiento.
 * NO permite agregar ni borrar — para añadir un hijo se debe crear un
 * contrato nuevo (regla de integridad legal: la firma del cliente quedó
 * anclada a la lista original).
 */
export function MinorEditorModal({ contractId, minors, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<MinorRecord[]>(() =>
    minors.map((m) => ({
      fullName: m.fullName ?? '',
      dob: m.dob ?? '',
      passport: m.passport ?? '',
      birthplace: m.birthplace ?? '',
    })),
  )
  const [savingIndex, setSavingIndex] = useState<number | null>(null)

  function setField(index: number, key: keyof MinorRecord, value: string) {
    setDraft((d) => d.map((m, i) => (i === index ? { ...m, [key]: value } : m)))
  }

  async function saveOne(index: number) {
    const original = minors[index]
    const current = draft[index]
    const patch: Partial<MinorRecord> = {}
    if ((current.fullName ?? '') !== (original.fullName ?? '')) patch.fullName = current.fullName
    if ((current.dob ?? '') !== (original.dob ?? '')) patch.dob = current.dob
    if ((current.passport ?? '') !== (original.passport ?? '')) patch.passport = current.passport
    if ((current.birthplace ?? '') !== (original.birthplace ?? '')) patch.birthplace = current.birthplace

    if (Object.keys(patch).length === 0) {
      toast.info('No hay cambios para guardar')
      return
    }

    setSavingIndex(index)
    try {
      const res = await fetch(`/api/admin/contracts/${contractId}/minors`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index, patch }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'Error al guardar')
        return
      }
      toast.success(`Menor #${index + 1} actualizado`)
      onSaved()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSavingIndex(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Editar menores del contrato</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Solo correcciones de campos existentes. Para agregar un hijo, crear contrato nuevo.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </header>

        <div className="p-5 space-y-5">
          {draft.length === 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                Este contrato no tiene menores registrados.
              </p>
            </div>
          )}

          {draft.map((m, idx) => (
            <section
              key={idx}
              className="border border-gray-200 rounded-xl p-4 space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Menor #{idx + 1}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`fullName-${idx}`}>Nombre completo</Label>
                  <Input
                    id={`fullName-${idx}`}
                    value={m.fullName ?? ''}
                    onChange={(e) => setField(idx, 'fullName', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`dob-${idx}`}>Fecha de nacimiento</Label>
                  <Input
                    id={`dob-${idx}`}
                    type="date"
                    value={m.dob ?? ''}
                    onChange={(e) => setField(idx, 'dob', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`passport-${idx}`}>Pasaporte / ID</Label>
                  <Input
                    id={`passport-${idx}`}
                    value={m.passport ?? ''}
                    onChange={(e) => setField(idx, 'passport', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`birthplace-${idx}`}>Lugar de nacimiento</Label>
                  <Input
                    id={`birthplace-${idx}`}
                    value={m.birthplace ?? ''}
                    onChange={(e) => setField(idx, 'birthplace', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => saveOne(idx)}
                  disabled={savingIndex === idx}
                  className="bg-[#002855] hover:bg-[#001d3d] text-white"
                >
                  {savingIndex === idx ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1.5" />
                      Guardar cambios
                    </>
                  )}
                </Button>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

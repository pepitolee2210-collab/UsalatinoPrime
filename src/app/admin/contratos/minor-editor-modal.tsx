'use client'

import { useState } from 'react'
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

const DARK_INPUT_CLS =
  'w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors focus:border-white/30 ' +
  'bg-white/[0.04] border border-white/10 text-white placeholder:text-white/30'

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono-tech)',
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.18em',
  color: 'var(--admin-fg-muted)',
}

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
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto admin-scroll rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, rgba(15,15,15,0.98), rgba(8,8,8,0.98))',
          border: '0.5px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        <header
          className="sticky top-0 z-10 flex items-start justify-between px-6 py-4"
          style={{
            background: 'rgba(15,15,15,0.95)',
            backdropFilter: 'blur(20px)',
            borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <div>
            <p
              style={{
                fontFamily: 'var(--font-mono-tech)',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.2em',
                color: 'var(--admin-fg-subtle)',
              }}
            >
              EDICIÓN · CORRECCIONES
            </p>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.018em', marginTop: 2 }}>
              Editar menores del contrato
            </h2>
            <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Solo correcciones de campos existentes. Para agregar un hijo, crear contrato nuevo.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            style={{
              background: 'var(--admin-accent-soft)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              color: 'var(--admin-fg-muted)',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-6 space-y-5">
          {draft.length === 0 && (
            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{
                background: 'rgba(250,204,21,0.06)',
                border: '0.5px solid rgba(250,204,21,0.25)',
              }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#FACC15' }} />
              <p style={{ fontSize: 13, color: '#FDE68A' }}>
                Este contrato no tiene menores registrados.
              </p>
            </div>
          )}

          {draft.map((m, idx) => (
            <section
              key={idx}
              className="rounded-2xl p-5 space-y-4"
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: '0.5px solid rgba(255,255,255,0.08)',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  color: '#FFFFFF',
                }}
              >
                MENOR #{(idx + 1).toString().padStart(2, '0')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor={`fullName-${idx}`} style={LABEL_STYLE}>NOMBRE COMPLETO</label>
                  <input
                    id={`fullName-${idx}`}
                    value={m.fullName ?? ''}
                    onChange={(e) => setField(idx, 'fullName', e.target.value)}
                    className={DARK_INPUT_CLS}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`dob-${idx}`} style={LABEL_STYLE}>FECHA DE NACIMIENTO</label>
                  <input
                    id={`dob-${idx}`}
                    type="date"
                    value={m.dob ?? ''}
                    onChange={(e) => setField(idx, 'dob', e.target.value)}
                    className={DARK_INPUT_CLS}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`passport-${idx}`} style={LABEL_STYLE}>PASAPORTE / ID</label>
                  <input
                    id={`passport-${idx}`}
                    value={m.passport ?? ''}
                    onChange={(e) => setField(idx, 'passport', e.target.value)}
                    className={DARK_INPUT_CLS}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`birthplace-${idx}`} style={LABEL_STYLE}>LUGAR DE NACIMIENTO</label>
                  <input
                    id={`birthplace-${idx}`}
                    value={m.birthplace ?? ''}
                    onChange={(e) => setField(idx, 'birthplace', e.target.value)}
                    className={DARK_INPUT_CLS}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => saveOne(idx)}
                  disabled={savingIndex === idx}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50"
                  style={{
                    background: '#FFFFFF',
                    color: 'var(--admin-bg-deep)',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '-0.005em',
                    boxShadow: '0 4px 18px rgba(255,255,255,0.18), 0 0 0 0.5px rgba(255,255,255,0.4) inset',
                  }}
                >
                  {savingIndex === idx ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</>
                  ) : (
                    <><Save className="w-3.5 h-3.5" /> Guardar cambios</>
                  )}
                </button>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

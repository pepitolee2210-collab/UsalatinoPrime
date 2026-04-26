'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RotateCcw, AlertCircle, Printer, Check, Pencil, ListOrdered } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface FieldSpec {
  semanticKey: string
  pdfFieldName: string | null
  type: 'text' | 'textarea' | 'checkbox' | 'date' | 'phone' | 'state' | 'zip'
  labelEs: string
  helpEs?: string
  page?: number
  required?: boolean
  hardcoded?: string | boolean
  deriveFrom?: string
  groupKey?: string
  options?: { value: string; labelEs: string }[]
  maxLength?: number
}

interface FormSection {
  id: number
  titleEs: string
  descriptionEs: string
  fields: FieldSpec[]
}

interface FormResponse {
  slug: string
  formName: string
  formDescriptionEs: string
  instanceId: string
  status: string
  updatedAt: string
  filledAt: string | null
  filledPdfPath: string | null
  filledPdfGeneratedAt: string | null
  schemaVersion: string
  pdfSha256: string
  schemaSections: FormSection[]
  prefilledValues: Record<string, string | boolean>
  savedValues: Record<string, string | boolean>
  case: { id: string; caseNumber: string; clientId: string }
}

type Values = Record<string, string | boolean>

interface Props {
  caseId: string
  slug: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AutomatedFormModal({ caseId, slug, open, onOpenChange }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<FormResponse | null>(null)
  const [values, setValues] = useState<Values>({})
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set())
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updatedAtRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/case-forms/${encodeURIComponent(slug)}?caseId=${encodeURIComponent(caseId)}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `HTTP ${res.status}`)
        }
        const json = (await res.json()) as FormResponse
        if (cancelled) return
        const merged: Values = { ...json.prefilledValues, ...json.savedValues }
        setData(json)
        setValues(merged)
        updatedAtRef.current = json.updatedAt
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [caseId, slug, open])

  const triggerSave = useCallback((nextValues: Values) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setSavingState('saving')
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/case-forms/${encodeURIComponent(slug)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseId,
            values: nextValues,
            expectedUpdatedAt: updatedAtRef.current,
          }),
        })
        if (res.status === 409) {
          setSavingState('error')
          toast.error('Otra persona modificó este formulario. Recarga para ver cambios.')
          return
        }
        if (!res.ok) {
          setSavingState('error')
          const err = await res.json().catch(() => ({}))
          toast.error(err.error || 'No se pudo guardar')
          return
        }
        const json = await res.json()
        updatedAtRef.current = json.updatedAt
        setSavingState('saved')
        setTimeout(() => setSavingState((s) => (s === 'saved' ? 'idle' : s)), 1500)
      } catch (err) {
        setSavingState('error')
        toast.error(err instanceof Error ? err.message : 'Error al guardar')
      }
    }, 600)
  }, [caseId, slug])

  function setField(key: string, value: string | boolean) {
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      triggerSave(next)
      return next
    })
  }

  function resetField(key: string) {
    if (!data) return
    setValues((prev) => {
      const next = { ...prev }
      const prefill = data.prefilledValues[key]
      if (prefill === undefined) {
        delete next[key]
      } else {
        next[key] = prefill
      }
      triggerSave(next)
      return next
    })
  }

  const missingRequired = useMemo(() => {
    if (!data) return []
    const missing: { semanticKey: string; labelEs: string; sectionId: number }[] = []
    for (const section of data.schemaSections) {
      for (const f of section.fields) {
        if (!f.required) continue
        const v = values[f.semanticKey]
        if (v === undefined || v === null || v === '' || v === false) {
          missing.push({ semanticKey: f.semanticKey, labelEs: f.labelEs, sectionId: section.id })
        }
      }
    }
    return missing
  }, [data, values])

  async function handlePrint() {
    setPrinting(true)
    try {
      const res = await fetch(`/api/admin/case-forms/${encodeURIComponent(slug)}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.message || err.error || 'Error al generar PDF')
        return
      }
      const blob = await res.blob()
      const filename = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `${slug}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF generado y archivado en Documentos del caso')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al imprimir')
    } finally {
      setPrinting(false)
    }
  }

  function toggleSection(id: number) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function jumpToSection(id: number) {
    const el = document.getElementById(`autoform-section-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Pencil className="w-5 h-5 text-violet-600" />
            {data?.formName ?? 'Formulario interactivo'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {data?.formDescriptionEs ?? 'Cargando descripción del formulario…'} Los campos se guardan automáticamente. Al imprimir se rellena el PDF oficial con estos datos y se archiva una copia en Documentos del caso.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex-1 flex items-center justify-center gap-2 p-12 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando formulario y datos del cliente…
          </div>
        )}

        {error && !loading && (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
              <p className="font-medium mb-1">No se pudo cargar el formulario</p>
              <p className="text-xs">{error}</p>
            </div>
          </div>
        )}

        {data && !loading && (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-[200px_1fr] overflow-hidden">
            <aside className="hidden md:block border-r bg-gray-50/50 overflow-y-auto">
              <div className="p-3 sticky top-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1">
                  <ListOrdered className="w-3 h-3" /> Índice
                </p>
                <ol className="space-y-1">
                  {data.schemaSections.map((s) => {
                    const sectionMissing = missingRequired.filter((m) => m.sectionId === s.id).length
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => jumpToSection(s.id)}
                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-violet-50 hover:text-violet-900 text-gray-700 flex items-start gap-1.5 group"
                        >
                          <span className="text-[10px] font-bold text-violet-600 mt-0.5">§{s.id}</span>
                          <span className="flex-1 leading-tight">
                            {s.titleEs.replace(/^\d+\.\s*/, '')}
                          </span>
                          {sectionMissing > 0 && (
                            <span className="bg-red-100 text-red-700 text-[9px] px-1 py-0 rounded font-bold">
                              {sectionMissing}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </aside>

            <div className="overflow-y-auto px-6 py-4 space-y-6">
              {data.schemaSections.map((section) => {
                const collapsed = collapsedSections.has(section.id)
                return (
                  <section key={section.id} id={`autoform-section-${section.id}`} className="rounded-lg border bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-900">{section.titleEs}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{section.descriptionEs}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {collapsed ? 'Mostrar' : 'Ocultar'} ({section.fields.length})
                      </span>
                    </button>

                    {!collapsed && (
                      <div className="border-t px-4 py-4 space-y-3">
                        {section.fields.map((f) => (
                          <FieldRow
                            key={f.semanticKey}
                            field={f}
                            value={values[f.semanticKey]}
                            prefillValue={data.prefilledValues[f.semanticKey]}
                            onChange={(v) => setField(f.semanticKey, v)}
                            onReset={() => resetField(f.semanticKey)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-3 border-t flex-shrink-0 gap-2 sm:gap-2">
          <div className="flex-1 flex items-center gap-2 text-xs">
            {savingState === 'saving' && <><Loader2 className="w-3 h-3 animate-spin text-blue-600" /> <span className="text-gray-600">Guardando…</span></>}
            {savingState === 'saved' && <><Check className="w-3 h-3 text-emerald-600" /> <span className="text-emerald-700">Guardado</span></>}
            {savingState === 'error' && <><AlertCircle className="w-3 h-3 text-red-600" /> <span className="text-red-700">Error al guardar</span></>}
            {missingRequired.length > 0 && (
              <span className="text-amber-700 ml-2">
                {missingRequired.length} {missingRequired.length === 1 ? 'campo obligatorio' : 'campos obligatorios'} pendiente{missingRequired.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            onClick={handlePrint}
            disabled={printing || missingRequired.length > 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {printing
              ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Generando PDF…</>
              : <><Printer className="w-4 h-4 mr-1.5" /> Imprimir oficial</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FieldRow({
  field,
  value,
  prefillValue,
  onChange,
  onReset,
}: {
  field: FieldSpec
  value: string | boolean | undefined
  prefillValue: string | boolean | undefined
  onChange: (v: string | boolean) => void
  onReset: () => void
}) {
  const isOverridden = prefillValue !== undefined && prefillValue !== value && value !== undefined

  if (field.type === 'checkbox') {
    const checked = value === true || value === 'true' || value === 'Yes' || value === 'on'
    return (
      <div className="flex items-start gap-2">
        <Checkbox
          id={`f-${field.semanticKey}`}
          checked={checked}
          onCheckedChange={(c) => onChange(Boolean(c))}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <Label
            htmlFor={`f-${field.semanticKey}`}
            className="text-xs font-medium text-gray-900 leading-snug cursor-pointer"
          >
            {field.labelEs}
            {field.required && <span className="text-red-500 ml-1">*</span>}
            {field.page && <span className="ml-1.5 text-[9px] text-gray-400 font-normal">p.{field.page}</span>}
          </Label>
          {field.helpEs && <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{field.helpEs}</p>}
        </div>
        {isOverridden && (
          <button
            type="button"
            onClick={onReset}
            title="Restablecer al valor sugerido"
            className="text-[10px] text-blue-600 hover:text-blue-800 flex-shrink-0 flex items-center gap-0.5"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  if (field.type === 'textarea') {
    const text = (value as string) ?? ''
    return (
      <div>
        <FieldLabel field={field} isOverridden={isOverridden} onReset={onReset} />
        <Textarea
          id={`f-${field.semanticKey}`}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          maxLength={field.maxLength}
          rows={3}
          className="text-xs"
          placeholder={field.helpEs}
        />
      </div>
    )
  }

  const text = (value as string) ?? ''
  return (
    <div>
      <FieldLabel field={field} isOverridden={isOverridden} onReset={onReset} />
      <Input
        id={`f-${field.semanticKey}`}
        type="text"
        inputMode={field.type === 'phone' || field.type === 'zip' ? 'numeric' : undefined}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        maxLength={field.maxLength}
        className="text-xs"
        placeholder={field.type === 'date' ? 'MM/DD/YYYY' : field.helpEs ?? ''}
      />
    </div>
  )
}

function FieldLabel({
  field,
  isOverridden,
  onReset,
}: {
  field: FieldSpec
  isOverridden: boolean
  onReset: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-0.5">
      <Label
        htmlFor={`f-${field.semanticKey}`}
        className="text-xs font-medium text-gray-900 leading-tight"
      >
        {field.labelEs}
        {field.required && <span className="text-red-500 ml-1">*</span>}
        {field.page && <span className="ml-1.5 text-[9px] text-gray-400 font-normal">p.{field.page}</span>}
      </Label>
      {isOverridden && (
        <button
          type="button"
          onClick={onReset}
          title="Restablecer al valor sugerido"
          className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5 flex-shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

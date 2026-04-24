'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { X, Save, Download, ExternalLink, Sparkles, ChevronDown, ChevronUp, Info, Loader2 } from 'lucide-react'
import type { DetectedField } from '@/lib/legal/acroform-service'

interface FormInstance {
  id: string
  case_id: string
  packet_type: 'intake' | 'merits'
  form_name: string
  form_url_official: string
  form_description_es: string | null
  acroform_schema: DetectedField[] | null
  schema_source: 'pending' | 'acroform' | 'ocr_gemini' | 'failed'
  filled_values: Record<string, unknown> | null
}

interface Props {
  instance: FormInstance
  onClose: () => void
  onSaved: () => void
}

type Values = Record<string, string | boolean>

export function FormEditorModal({ instance, onClose, onSaved }: Props) {
  const schema = (instance.acroform_schema ?? []) as DetectedField[]
  const initialValues: Values = {}
  for (const f of schema) {
    const existing = (instance.filled_values ?? {})[f.name]
    if (existing !== undefined && existing !== null) {
      initialValues[f.name] = existing as string | boolean
    } else if (f.ai_suggestion) {
      initialValues[f.name] = f.ai_suggestion
    }
  }

  const [values, setValues] = useState<Values>(initialValues)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showOptional, setShowOptional] = useState(false)
  const dirtyRef = useRef(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const relevantFields = schema.filter(f => f.sijs_relevant !== false)
  const optionalFields = schema.filter(f => f.sijs_relevant === false)

  function update(name: string, value: string | boolean) {
    setValues(v => ({ ...v, [name]: value }))
    dirtyRef.current = true
  }

  async function save(closeAfter: boolean = false) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/case-forms/${instance.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      })
      if (!res.ok) throw new Error('save_failed')
      dirtyRef.current = false
      if (closeAfter) {
        toast.success('Cambios guardados')
        onSaved()
      }
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Autosave cada 15s si hay cambios
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    if (!dirtyRef.current) return
    autosaveTimer.current = setTimeout(() => { void save(false) }, 15_000)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [values])

  async function downloadPdf() {
    setDownloading(true)
    try {
      // Guardar antes de descargar
      if (dirtyRef.current) await save(false)
      window.open(`/api/admin/case-forms/${instance.id}/download`, '_blank')
      toast.success('Generando PDF…')
      setTimeout(() => onSaved(), 1000)
    } catch {
      toast.error('Error al descargar')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b z-10 px-5 py-3 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 truncate">{instance.form_name}</p>
            <p className="text-[11px] text-gray-500 truncate">
              {instance.schema_source === 'ocr_gemini'
                ? 'Schema detectado por OCR (PDF sin AcroForm nativo)'
                : 'Schema detectado del AcroForm oficial'}
              {' · '}
              <a href={instance.form_url_official} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Ver PDF oficial ↗
              </a>
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Info banner para OCR */}
          {instance.schema_source === 'ocr_gemini' && (
            <div className="rounded-lg bg-violet-50 border border-violet-200 p-3 flex gap-2">
              <Info className="w-4 h-4 text-violet-700 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-violet-900">
                Este formulario no tiene campos rellenables nativos. El PDF que descargues será un documento complementario generado con tu información, que acompaña al oficial.
              </p>
            </div>
          )}

          {/* Campos SIJS-relevantes */}
          {relevantFields.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No se detectaron campos relevantes para SIJS.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Campos relevantes para SIJS ({relevantFields.length})
              </p>
              {relevantFields.map(f => (
                <FieldInput key={f.name} field={f} value={values[f.name]} onChange={v => update(f.name, v)} />
              ))}
            </div>
          )}

          {/* Campos opcionales (no-SIJS) */}
          {optionalFields.length > 0 && (
            <div>
              <button
                onClick={() => setShowOptional(v => !v)}
                className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-[11px] font-medium text-gray-600"
              >
                <span>Campos adicionales del formulario ({optionalFields.length})</span>
                {showOptional ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showOptional && (
                <div className="mt-3 space-y-3">
                  <p className="text-[10px] text-gray-500 italic">
                    La IA determinó que estos campos probablemente no aplican a un caso SIJS. Llénalos solo si son relevantes para este caso específico.
                  </p>
                  {optionalFields.map(f => (
                    <FieldInput key={f.name} field={f} value={values[f.name]} onChange={v => update(f.name, v)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer acciones */}
        <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex items-center justify-between gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => save(true)} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Guardar
          </Button>
          <Button
            size="sm"
            onClick={downloadPdf}
            disabled={downloading || saving}
            className="bg-[#002855] hover:bg-[#001d3d] text-white"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Download className="w-3.5 h-3.5 mr-1" />}
            Descargar PDF completo
          </Button>
        </div>
      </div>
    </div>
  )
}

function FieldInput({
  field, value, onChange,
}: {
  field: DetectedField
  value: string | boolean | undefined
  onChange: (v: string | boolean) => void
}) {
  const current = value ?? ''

  return (
    <label className="block">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-xs font-medium text-gray-800">{field.label}</span>
        {field.required && (
          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Obligatorio</span>
        )}
        {field.ai_suggestion && (
          <span className="text-[10px] text-amber-600 inline-flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5" /> IA
          </span>
        )}
      </div>
      {field.help_text && <p className="text-[10px] text-gray-500 mb-1">{field.help_text}</p>}
      {field.ai_reasoning && field.ai_suggestion && (
        <p className="text-[10px] text-amber-700 italic mb-1 bg-amber-50/50 rounded px-2 py-1">
          💡 {field.ai_reasoning}
        </p>
      )}

      {field.type === 'checkbox' ? (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={e => onChange(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-xs text-gray-600">Marcado</span>
        </div>
      ) : field.type === 'dropdown' || field.type === 'radio' ? (
        <select
          value={String(current)}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F2A900] focus:ring-1 focus:ring-[#F2A900]/30 outline-none"
        >
          <option value="">— Selecciona —</option>
          {(field.options ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.type === 'date' ? (
        <input
          type="date"
          value={String(current)}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F2A900] focus:ring-1 focus:ring-[#F2A900]/30 outline-none"
        />
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={String(current)}
          onChange={e => onChange(e.target.value)}
          placeholder={field.ai_suggestion && !value ? `Sugerido: ${field.ai_suggestion}` : ''}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F2A900] focus:ring-1 focus:ring-[#F2A900]/30 outline-none"
        />
      )}
    </label>
  )
}

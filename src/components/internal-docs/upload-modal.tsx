'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { X, Upload, Loader2 } from 'lucide-react'

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'declaracion_tutor', label: 'Declaración del Tutor' },
  { value: 'declaracion_menor', label: 'Declaración del Menor' },
  { value: 'declaracion_testigo', label: 'Declaración del Testigo' },
  { value: 'peticion_i360', label: 'Petición I-360' },
  { value: 'i485', label: 'Formulario I-485' },
  { value: 'carta_corte', label: 'Carta a Corte' },
  { value: 'consentimiento_parental', label: 'Consentimiento Parental' },
  { value: 'evidencia', label: 'Evidencia / Anexo' },
  { value: 'otro', label: 'Otro' },
]

interface ClientOption {
  case_id: string
  client_id: string
  case_number: string
  client_name: string
  service_name: string | null
}

interface Props {
  clients: ClientOption[]
  preselectedCaseId?: string
  onClose: () => void
  onUploaded: () => void
  parentDocumentId?: string  // Si es resubida tras rechazo
  parentClient?: ClientOption // Pre-asignar cliente y bloquear selector
}

export function UploadModal({
  clients, preselectedCaseId, onClose, onUploaded,
  parentDocumentId, parentClient,
}: Props) {
  const initial = parentClient
    ? clients.find(c => c.case_id === parentClient.case_id) ?? parentClient
    : clients.find(c => c.case_id === preselectedCaseId) || null

  const [selected, setSelected] = useState<ClientOption | null>(initial)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const filtered = clients.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return c.client_name.toLowerCase().includes(q)
      || c.case_number.toLowerCase().includes(q)
      || (c.service_name?.toLowerCase().includes(q) ?? false)
  })

  async function handleSubmit() {
    if (!selected) return toast.error('Selecciona un cliente')
    if (!category) return toast.error('Selecciona la categoría del documento')
    if (!file) return toast.error('Selecciona un archivo')

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('case_id', selected.case_id)
      fd.append('client_id', selected.client_id)
      fd.append('category', category)
      fd.append('upload_notes', notes)
      fd.append('file', file)
      if (parentDocumentId) fd.append('parent_document_id', parentDocumentId)

      const res = await fetch('/api/internal-documents/upload', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Error al subir')
        return
      }
      toast.success('Documento subido. Esperando revisión de Henry.')
      onUploaded()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b z-10 px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">Subir documento para revisión</p>
            <p className="text-[11px] text-gray-500">Henry revisará antes de publicarlo al cliente.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Selector de cliente */}
          {!parentClient && (
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Cliente / Caso</label>
              <input
                type="text"
                placeholder="Buscar por nombre, # de caso o servicio..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full mb-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200">
                {filtered.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-4">Sin resultados</p>
                ) : (
                  filtered.map(c => (
                    <button
                      key={c.case_id}
                      type="button"
                      onClick={() => setSelected(c)}
                      className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-amber-50 ${
                        selected?.case_id === c.case_id ? 'bg-amber-50 border-l-4 border-l-[#F2A900]' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">{c.client_name}</p>
                      <p className="text-[11px] text-gray-500">
                        {c.case_number} · {c.service_name || 'Sin servicio'}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {parentClient && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[11px] text-gray-500">Cliente seleccionado</p>
              <p className="text-sm font-medium text-gray-900">{parentClient.client_name}</p>
              <p className="text-[11px] text-gray-500">{parentClient.case_number} · {parentClient.service_name}</p>
            </div>
          )}

          {/* Categoría */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Tipo de documento</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Seleccione</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Notas para Henry (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Detalles relevantes que Henry debería saber al revisar..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* Archivo */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Archivo (PDF, máx. 40 MB)</label>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
            {file && (
              <p className="text-[11px] text-gray-500 mt-1">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#F2A900] hover:bg-[#D4940A] text-white"
          >
            {submitting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Subiendo…</>
              : <><Upload className="w-3.5 h-3.5 mr-1" /> Enviar a revisión</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

export const INTERNAL_CATEGORY_LABELS: Record<string, string> = {
  declaracion_tutor: 'Declaración del Tutor',
  declaracion_menor: 'Declaración del Menor',
  declaracion_testigo: 'Declaración del Testigo',
  peticion_i360: 'Petición I-360',
  i485: 'Formulario I-485',
  carta_corte: 'Carta a Corte',
  consentimiento_parental: 'Consentimiento Parental',
  evidencia: 'Evidencia / Anexo',
  otro: 'Otro',
}

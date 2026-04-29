'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { X, Upload, Loader2, FileText, Trash2, FileUp } from 'lucide-react'

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
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(picked: File | null | undefined) {
    if (!picked) return
    if (picked.size > 40 * 1024 * 1024) {
      toast.error('El archivo supera el límite de 40 MB')
      return
    }
    const ok = picked.type.startsWith('application/pdf') || picked.type.startsWith('image/')
    if (!ok) {
      toast.error('Solo se permiten PDF o imágenes')
      return
    }
    setFile(picked)
  }

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

      // credentials: cookie de Supabase auth necesaria server-side.
      // cache: 'no-store' evita que un Service Worker stale del PWA intercepte
      //   este POST y devuelva una respuesta cacheada incorrecta (visto en
      //   Chrome con SW antiguo de versiones previas que no conocía estos
      //   endpoints).
      const res = await fetch('/api/internal-documents/upload', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
        cache: 'no-store',
      })

      let json: { error?: string } = {}
      try {
        json = await res.json()
      } catch {
        // El body puede no ser JSON si un proxy/SW intercepto la respuesta
      }

      if (!res.ok) {
        toast.error(json.error || `Error al subir (HTTP ${res.status})`)
        return
      }
      toast.success('Documento subido. Esperando revisión de Henry.')
      onUploaded()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión'
      console.error('[internal-docs upload] failed', err)
      toast.error(
        msg.includes('Failed to fetch') || msg.includes('NetworkError')
          ? 'No se pudo conectar al servidor. Si el problema persiste, cierra todas las pestañas de UsaLatino Prime y vuelve a abrir.'
          : `Error: ${msg}`,
      )
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
            <label className="text-xs font-medium text-gray-700 block mb-1">Archivo (PDF o imagen, máx. 40 MB)</label>

            {/* Input file oculto, lo dispara el área clickeable */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              onChange={e => handleFile(e.target.files?.[0])}
              className="sr-only"
              aria-hidden="true"
            />

            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const dropped = e.dataTransfer.files?.[0]
                  if (dropped) handleFile(dropped)
                }}
                className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 px-4 transition-colors text-center ${
                  dragOver
                    ? 'border-[#F2A900] bg-[#F2A900]/10'
                    : 'border-gray-300 bg-gray-50 hover:border-[#F2A900] hover:bg-amber-50/30'
                }`}
              >
                <FileUp className="w-8 h-8 text-[#F2A900]" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Haz click para seleccionar el archivo</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">o arrastra y suelta aquí · PDF o imagen · máx. 40 MB</p>
                </div>
              </button>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                  <p className="text-[11px] text-gray-500">
                    {(file.size / 1024).toFixed(0)} KB · {file.type || 'archivo'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                  title="Quitar archivo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
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

'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Briefcase, Upload, FileText, Trash2, Loader2, Send, FolderOpen, Plus } from 'lucide-react'

interface Service { id: string; name: string }
interface Employee { id: string; first_name: string; last_name: string }
interface ActiveCase {
  id: string; case_number: string
  client: { first_name: string; last_name: string } | null
  service: { name: string } | null
}

export function AssignTaskButton({ services, employees, activeCases = [] }: {
  services: Service[]; employees: Employee[]; activeCases?: ActiveCase[]
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'case' | 'standalone' | null>(null)
  const [selectedCase, setSelectedCase] = useState('')
  const [caseSearch, setCaseSearch] = useState('')
  const [service, setService] = useState('')
  const [clientName, setClientName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [employee, setEmployee] = useState(employees[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setMode(null); setSelectedCase(''); setCaseSearch(''); setService('')
    setClientName(''); setInstructions(''); setFiles([])
  }

  const filteredCases = activeCases.filter(c => {
    if (!caseSearch.trim()) return true
    const q = caseSearch.toLowerCase()
    const name = `${c.client?.first_name || ''} ${c.client?.last_name || ''}`.toLowerCase()
    return name.includes(q) || c.case_number.toLowerCase().includes(q) || (c.service?.name || '').toLowerCase().includes(q)
  }).slice(0, 10)

  async function handleSubmit() {
    if (!employee) { toast.error('Selecciona un empleado'); return }
    if (mode === 'case' && !selectedCase) { toast.error('Selecciona un caso'); return }
    if (mode === 'standalone' && !service) { toast.error('Selecciona un servicio'); return }

    setLoading(true)
    try {
      if (mode === 'case') {
        const res = await fetch('/api/admin/assign-employee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_id: selectedCase, employee_id: employee, task_description: instructions.trim() || null }),
        })
        if (!res.ok) throw new Error()
      } else {
        const fd = new FormData()
        fd.append('employee_id', employee)
        fd.append('service_type', service)
        fd.append('client_name', clientName)
        fd.append('task_description', instructions)
        files.forEach(f => fd.append('files', f))
        const res = await fetch('/api/admin/create-employee-task', { method: 'POST', body: fd })
        if (!res.ok) throw new Error()
      }
      toast.success('Trabajo asignado — Diana lo verá en su portal')
      setOpen(false); reset()
      window.location.reload()
    } catch { toast.error('Error al asignar') }
    finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button className="bg-[#F2A900] hover:bg-[#D4940A] text-[#001020] font-bold gap-2">
          <Briefcase className="w-4 h-4" /> Asignar Trabajo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#F2A900]" /> Asignar Trabajo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {employees.length > 1 && (
            <div className="space-y-2">
              <Label>Empleado</Label>
              <Select value={employee} onValueChange={setEmployee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Mode selector */}
          {!mode && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">¿Qué desea asignar?</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setMode('case')}
                  className="p-4 rounded-2xl border-2 border-gray-200 hover:border-[#002855] hover:bg-[#002855]/5 transition-all text-center">
                  <FolderOpen className="w-8 h-8 text-[#002855] mx-auto mb-2" />
                  <p className="text-sm font-bold text-gray-900">Caso existente</p>
                  <p className="text-xs text-gray-500 mt-1">Con todos sus documentos</p>
                </button>
                <button onClick={() => setMode('standalone')}
                  className="p-4 rounded-2xl border-2 border-gray-200 hover:border-[#F2A900] hover:bg-[#F2A900]/5 transition-all text-center">
                  <Plus className="w-8 h-8 text-[#F2A900] mx-auto mb-2" />
                  <p className="text-sm font-bold text-gray-900">Tarea nueva</p>
                  <p className="text-xs text-gray-500 mt-1">Subir documentos manualmente</p>
                </button>
              </div>
            </div>
          )}

          {/* Existing case */}
          {mode === 'case' && (
            <div className="space-y-3">
              <button onClick={() => setMode(null)} className="text-xs text-gray-500 hover:text-gray-700">← Cambiar tipo</button>
              <div className="space-y-2">
                <Label>Buscar caso</Label>
                <Input value={caseSearch} onChange={e => setCaseSearch(e.target.value)}
                  placeholder="Buscar por nombre, # caso o servicio..." className="h-11" />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-200 rounded-xl p-2">
                {filteredCases.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No se encontraron casos</p>
                )}
                {filteredCases.map(c => (
                  <button key={c.id} onClick={() => setSelectedCase(c.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                      selectedCase === c.id ? 'bg-[#002855] text-white' : 'hover:bg-gray-50'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${selectedCase === c.id ? 'text-white' : 'text-gray-900'}`}>
                        {c.client?.first_name} {c.client?.last_name}
                      </span>
                      <span className={`text-xs ${selectedCase === c.id ? 'text-white/70' : 'text-gray-400'}`}>#{c.case_number}</span>
                    </div>
                    <p className={`text-xs ${selectedCase === c.id ? 'text-white/60' : 'text-gray-500'}`}>{c.service?.name || '—'}</p>
                  </button>
                ))}
              </div>
              {selectedCase && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-xs text-green-700">Diana recibirá el caso con todos los documentos ya subidos.</p>
                </div>
              )}
            </div>
          )}

          {/* Standalone */}
          {mode === 'standalone' && (
            <div className="space-y-3">
              <button onClick={() => setMode(null)} className="text-xs text-gray-500 hover:text-gray-700">← Cambiar tipo</button>
              <div className="space-y-2">
                <Label>Tipo de Servicio</Label>
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {services.map(s => (<SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>))}
                    <SelectItem value="Apelación">Apelación</SelectItem>
                    <SelectItem value="Permiso de Trabajo">Permiso de Trabajo</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nombre del Cliente</Label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ej: Juan Pérez" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Documentos</Label>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-sm text-blue-700 truncate flex-1">{f.name}</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                ))}
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" multiple className="hidden"
                  onChange={e => { setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); if (fileRef.current) fileRef.current.value = '' }} />
                <button onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#F2A900] hover:text-[#F2A900] transition-colors">
                  <Upload className="w-4 h-4" /> Subir documentos
                </button>
              </div>
            </div>
          )}

          {mode && (
            <>
              <div className="space-y-2">
                <Label>Instrucciones para el empleado</Label>
                <Textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                  placeholder="Ej: Revisar documentos y redactar proyección..." rows={3} />
              </div>
              <Button className="w-full bg-[#002855] hover:bg-[#001d3d] h-12"
                disabled={loading || !employee || (mode === 'case' && !selectedCase) || (mode === 'standalone' && !service)}
                onClick={handleSubmit}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Asignar Trabajo
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

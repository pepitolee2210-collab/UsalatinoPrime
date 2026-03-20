'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Briefcase, Upload, FileText, Trash2, Loader2, Send } from 'lucide-react'

interface Service {
  id: string
  name: string
}

interface Employee {
  id: string
  first_name: string
  last_name: string
}

export function AssignTaskButton({ services, employees }: { services: Service[]; employees: Employee[] }) {
  const [open, setOpen] = useState(false)
  const [service, setService] = useState('')
  const [clientName, setClientName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [employee, setEmployee] = useState(employees[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...newFiles])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!service || !employee) {
      toast.error('Selecciona un servicio y empleado')
      return
    }

    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('employee_id', employee)
      fd.append('service_type', service)
      fd.append('client_name', clientName)
      fd.append('task_description', instructions)
      files.forEach(f => fd.append('files', f))

      const res = await fetch('/api/admin/create-employee-task', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()

      toast.success('Trabajo asignado exitosamente')
      setOpen(false)
      setService('')
      setClientName('')
      setInstructions('')
      setFiles([])
    } catch {
      toast.error('Error al asignar trabajo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#F2A900] hover:bg-[#D4940A] text-[#001020] font-bold gap-2">
          <Briefcase className="w-4 h-4" />
          Asignar Trabajo a Empleado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#F2A900]" />
            Nuevo Trabajo para Empleado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Employee selector */}
          {employees.length > 1 && (
            <div className="space-y-2">
              <Label>Empleado</Label>
              <Select value={employee} onValueChange={setEmployee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Service type */}
          <div className="space-y-2">
            <Label>Tipo de Servicio</Label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger><SelectValue placeholder="Seleccionar servicio..." /></SelectTrigger>
              <SelectContent>
                {services.map(s => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
                <SelectItem value="Apelación">Apelación</SelectItem>
                <SelectItem value="Permiso de Trabajo">Permiso de Trabajo</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Client name */}
          <div className="space-y-2">
            <Label>Nombre del Cliente (opcional)</Label>
            <Input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="h-11"
            />
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <Label>Instrucciones para el empleado</Label>
            <Textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="Ej: Revisar los documentos adjuntos y redactar la proyección de apelación..."
              rows={4}
            />
          </div>

          {/* File uploads */}
          <div className="space-y-2">
            <Label>Documentos</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={addFiles}
            />

            {files.length > 0 && (
              <div className="space-y-2 mb-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-sm text-blue-700 truncate flex-1">{f.name}</span>
                    <span className="text-[10px] text-blue-400 shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-[#F2A900] hover:text-[#F2A900] transition-colors"
            >
              <Upload className="w-4 h-4" />
              {files.length === 0 ? 'Subir documentos (PDF, DOC, imágenes)' : 'Agregar más documentos'}
            </button>
          </div>

          {/* Submit */}
          <Button
            className="w-full bg-[#002855] hover:bg-[#001d3d] h-12"
            disabled={loading || !service || !employee}
            onClick={handleSubmit}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Asignar Trabajo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Briefcase, Upload, FileText, Trash2, Loader2, Send, FolderOpen, Plus } from 'lucide-react'

interface Service { id: string; name: string }
interface Employee { id: string; first_name: string; last_name: string }
interface ActiveCase {
  id: string; case_number: string
  client: { first_name: string; last_name: string } | null
  service: { name: string } | null
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

const DARK_DIALOG_CLS =
  'bg-[#0A0A0A] border border-white/10 text-white shadow-2xl backdrop-blur-xl max-w-lg max-h-[90vh] overflow-y-auto admin-scroll ' +
  '[&>button]:text-white/60 [&>button]:hover:text-white'

const BTN_TRIGGER =
  'inline-flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-200 hover:opacity-90 active:scale-95 ' +
  'bg-white text-black text-[12px] font-semibold tracking-tight ' +
  'shadow-[0_4px_18px_rgba(255,255,255,0.18),0_0_0_0.5px_rgba(255,255,255,0.4)_inset]'

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
        <button className={BTN_TRIGGER}>
          <Briefcase className="w-3.5 h-3.5" /> Asignar Trabajo
        </button>
      </DialogTrigger>
      <DialogContent className={DARK_DIALOG_CLS}>
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2 text-white"
            style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.018em' }}
          >
            <Briefcase className="w-4 h-4" style={{ color: '#FACC15' }} /> Asignar Trabajo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {employees.length > 1 && (
            <div className="space-y-1.5">
              <label style={LABEL_STYLE}>EMPLEADO</label>
              <div className="relative">
                <select
                  value={employee}
                  onChange={e => setEmployee(e.target.value)}
                  className={DARK_INPUT_CLS + ' appearance-none pr-9 cursor-pointer'}
                  style={{ colorScheme: 'dark' }}
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id} style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
                <span aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--admin-fg-subtle)', fontSize: 10 }}>▾</span>
              </div>
            </div>
          )}

          {/* Mode selector */}
          {!mode && (
            <div className="space-y-3">
              <p style={{ fontFamily: 'var(--font-mono-tech)', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--admin-fg-muted)' }}>
                ¿QUÉ DESEA ASIGNAR?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('case')}
                  className="p-5 rounded-2xl text-center transition-all duration-300 hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(180deg, rgba(96,165,250,0.06), rgba(20,20,20,0.92))',
                    border: '0.5px solid rgba(96,165,250,0.25)',
                  }}
                >
                  <FolderOpen className="w-8 h-8 mx-auto mb-2" style={{ color: '#60A5FA' }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>
                    Caso existente
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 4, lineHeight: 1.4 }}>
                    Con todos sus documentos
                  </p>
                </button>
                <button
                  onClick={() => setMode('standalone')}
                  className="p-5 rounded-2xl text-center transition-all duration-300 hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(180deg, rgba(250,204,21,0.06), rgba(20,20,20,0.92))',
                    border: '0.5px solid rgba(250,204,21,0.25)',
                  }}
                >
                  <Plus className="w-8 h-8 mx-auto mb-2" style={{ color: '#FACC15' }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-fg)', letterSpacing: '-0.005em' }}>
                    Tarea nueva
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--admin-fg-muted)', marginTop: 4, lineHeight: 1.4 }}>
                    Subir documentos manualmente
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Existing case */}
          {mode === 'case' && (
            <div className="space-y-3">
              <button
                onClick={() => setMode(null)}
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--admin-fg-muted)',
                  letterSpacing: '0.15em',
                }}
                className="transition-opacity hover:opacity-80"
              >
                ← CAMBIAR TIPO
              </button>
              <div className="space-y-1.5">
                <label style={LABEL_STYLE}>BUSCAR CASO</label>
                <input
                  value={caseSearch}
                  onChange={e => setCaseSearch(e.target.value)}
                  placeholder="Buscar por nombre, # caso o servicio…"
                  className={DARK_INPUT_CLS}
                />
              </div>
              <div
                className="max-h-48 overflow-y-auto admin-scroll rounded-xl p-2 space-y-1"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '0.5px solid var(--admin-border)',
                }}
              >
                {filteredCases.length === 0 && (
                  <p
                    className="text-center py-4"
                    style={{
                      fontFamily: 'var(--font-mono-tech)',
                      fontSize: 10,
                      color: 'var(--admin-fg-subtle)',
                      letterSpacing: '0.15em',
                    }}
                  >
                    NO SE ENCONTRARON CASOS
                  </p>
                )}
                {filteredCases.map(c => {
                  const isActive = selectedCase === c.id
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCase(c.id)}
                      className="w-full text-left px-3 py-2.5 rounded-lg transition-colors"
                      style={{
                        background: isActive ? '#FFFFFF' : 'transparent',
                        boxShadow: isActive ? '0 0 12px rgba(255,255,255,0.18)' : 'none',
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--admin-accent-soft)' }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: isActive ? 'var(--admin-bg-deep)' : '#FFFFFF',
                            letterSpacing: '-0.005em',
                          }}
                        >
                          {c.client?.first_name} {c.client?.last_name}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono-tech)',
                            fontSize: 10,
                            fontWeight: 700,
                            color: isActive ? 'rgba(0,0,0,0.6)' : 'var(--admin-fg-subtle)',
                            letterSpacing: '0.05em',
                          }}
                        >
                          #{c.case_number}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: 11,
                          color: isActive ? 'rgba(0,0,0,0.55)' : 'var(--admin-fg-muted)',
                          marginTop: 2,
                        }}
                      >
                        {c.service?.name || '—'}
                      </p>
                    </button>
                  )
                })}
              </div>
              {selectedCase && (
                <div
                  className="p-3 rounded-xl"
                  style={{
                    background: 'rgba(34,197,94,0.06)',
                    border: '0.5px solid rgba(34,197,94,0.25)',
                  }}
                >
                  <p style={{ fontSize: 12, color: '#86EFAC', lineHeight: 1.5 }}>
                    Diana recibirá el caso con todos los documentos ya subidos.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Standalone */}
          {mode === 'standalone' && (
            <div className="space-y-3">
              <button
                onClick={() => setMode(null)}
                style={{
                  fontFamily: 'var(--font-mono-tech)',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--admin-fg-muted)',
                  letterSpacing: '0.15em',
                }}
                className="transition-opacity hover:opacity-80"
              >
                ← CAMBIAR TIPO
              </button>
              <div className="space-y-1.5">
                <label style={LABEL_STYLE}>TIPO DE SERVICIO</label>
                <div className="relative">
                  <select
                    value={service}
                    onChange={e => setService(e.target.value)}
                    className={DARK_INPUT_CLS + ' appearance-none pr-9 cursor-pointer'}
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="" style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg-subtle)' }}>Seleccionar…</option>
                    {services.map(s => (
                      <option key={s.id} value={s.name} style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>{s.name}</option>
                    ))}
                    <option value="Apelación" style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>Apelación</option>
                    <option value="Permiso de Trabajo" style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>Permiso de Trabajo</option>
                    <option value="Otro" style={{ background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>Otro</option>
                  </select>
                  <span aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--admin-fg-subtle)', fontSize: 10 }}>▾</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label style={LABEL_STYLE}>NOMBRE DEL CLIENTE</label>
                <input
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className={DARK_INPUT_CLS}
                />
              </div>
              <div className="space-y-1.5">
                <label style={LABEL_STYLE}>DOCUMENTOS</label>
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{
                      background: 'rgba(96,165,250,0.06)',
                      border: '0.5px solid rgba(96,165,250,0.25)',
                    }}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#60A5FA' }} />
                    <span style={{ fontSize: 12, color: '#93C5FD' }} className="truncate flex-1">{f.name}</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3 h-3" style={{ color: '#FCA5A5' }} />
                    </button>
                  </div>
                ))}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  multiple
                  className="hidden"
                  onChange={e => { setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); if (fileRef.current) fileRef.current.value = '' }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '2px dashed rgba(255,255,255,0.12)',
                    color: 'var(--admin-fg-muted)',
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: '-0.005em',
                  }}
                >
                  <Upload className="w-3.5 h-3.5" /> Subir documentos
                </button>
              </div>
            </div>
          )}

          {mode && (
            <>
              <div className="space-y-1.5">
                <label style={LABEL_STYLE}>INSTRUCCIONES PARA EL EMPLEADO</label>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Ej: Revisar documentos y redactar proyección…"
                  rows={3}
                  className={DARK_INPUT_CLS + ' resize-y'}
                  style={{ minHeight: 80 }}
                />
              </div>
              <button
                disabled={loading || !employee || (mode === 'case' && !selectedCase) || (mode === 'standalone' && !service)}
                onClick={handleSubmit}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: 'var(--admin-bg-elev)',
                  color: 'var(--admin-bg-deep)',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '-0.005em',
                  boxShadow: '0 4px 24px rgba(255,255,255,0.2), 0 0 0 0.5px rgba(255,255,255,0.5) inset',
                }}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Asignar Trabajo
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Phone, Plus, Loader2, Clock, CheckCircle, PhoneOff, UserX, UserCheck, CalendarClock, Trash2, AlertTriangle, Save, XCircle, Bot,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const SERVICE_OPTIONS = [
  { slug: 'asilo-afirmativo', label: 'Asilo Afirmativo' },
  { slug: 'asilo-defensivo', label: 'Asilo Defensivo' },
  { slug: 'ajuste-de-estatus', label: 'Ajuste de Estatus' },
  { slug: 'visa-juvenil', label: 'Visa Juvenil (SIJS)' },
  { slug: 'cambio-de-estatus', label: 'Cambio de Estatus' },
  { slug: 'cambio-de-corte', label: 'Cambio de Corte' },
  { slug: 'mociones', label: 'Mociones' },
  { slug: 'itin-number', label: 'ITIN Number' },
  { slug: 'adelantos', label: 'Adelantos (Advance Parole)' },
  { slug: 'licencia-de-conducir', label: 'Licencia de Conducir' },
  { slug: 'taxes', label: 'Declaracion de Impuestos' },
  { slug: 'otro', label: 'Otro' },
]

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  called: { label: 'Llamado', color: 'bg-blue-100 text-blue-800', icon: Phone },
  follow_up: { label: 'Seguimiento', color: 'bg-purple-100 text-purple-800', icon: CalendarClock },
  converted: { label: 'Convertido', color: 'bg-green-100 text-green-800', icon: UserCheck },
  no_answer: { label: 'Sin Respuesta', color: 'bg-orange-100 text-orange-800', icon: PhoneOff },
  not_interested: { label: 'No Interesado', color: 'bg-gray-100 text-gray-800', icon: UserX },
  closed: { label: 'Cerrado', color: 'bg-slate-100 text-slate-800', icon: XCircle },
} as const

type CallbackStatus = keyof typeof STATUS_CONFIG

interface CallbackRequest {
  id: string
  prospect_name: string
  phone: string
  service_interest: string | null
  notes: string | null
  henry_notes: { text: string; date: string }[] | null
  message_date: string | null
  status: CallbackStatus
  follow_up_date: string | null
  created_at: string
  called_at: string | null
  source?: string
}

function getPriority(messageDate: string | null, createdAt: string): { label: string; color: string; sort: number } {
  const refDate = messageDate ? new Date(messageDate + 'T12:00:00') : new Date(createdAt)
  const days = Math.floor((Date.now() - refDate.getTime()) / (1000 * 60 * 60 * 24))
  if (days >= 7) return { label: 'Alta', color: 'bg-red-100 text-red-800', sort: 0 }
  if (days >= 3) return { label: 'Media', color: 'bg-yellow-100 text-yellow-800', sort: 1 }
  return { label: 'Baja', color: 'bg-green-100 text-green-800', sort: 2 }
}

type FilterTab = 'pending' | 'follow_up' | 'all' | 'closed'

export default function AgendaPage() {
  const [items, setItems] = useState<CallbackRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<FilterTab>('pending')
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<CallbackRequest | null>(null)
  const [form, setForm] = useState({
    prospect_name: '',
    phone: '',
    service_interest: '',
    notes: '',
    message_date: '',
  })

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agenda')
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch {
      toast.error('Error al cargar agenda')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function resetForm() {
    setForm({ prospect_name: '', phone: '', service_interest: '', notes: '', message_date: '' })
    setShowForm(false)
  }

  async function handleSubmit(force = false) {
    if (!form.prospect_name.trim() || !form.phone.trim()) {
      toast.error('Nombre y telefono son requeridos')
      return
    }
    setSaving(true)
    try {
      const body = force ? { ...form, force_duplicate: true } : form
      const res = await fetch('/api/admin/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.duplicate) {
          const createAnyway = confirm(`${data.error}\n\n¿Desea crear el registro de todas formas?`)
          if (createAnyway) {
            setSaving(false)
            return handleSubmit(true)
          }
          setSaving(false)
          return
        }
        throw new Error(data.error)
      }
      toast.success('Prospecto registrado')
      resetForm()
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: CallbackStatus, follow_up_date?: string) {
    try {
      const body: Record<string, unknown> = { id, status }
      if (follow_up_date) body.follow_up_date = follow_up_date
      const res = await fetch('/api/admin/agenda', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Estado actualizado')
      setEditingItem(null)
      loadData()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  async function updateHenryNotes(id: string, henry_notes: string) {
    try {
      const res = await fetch('/api/admin/agenda', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, henry_notes }),
      })
      if (!res.ok) throw new Error()
      toast.success('Notas actualizadas')
      setEditingItem(null)
      loadData()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('¿Eliminar este registro?')) return
    try {
      const res = await fetch('/api/admin/agenda', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Registro eliminado')
      loadData()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const filtered = items.filter(item => {
    if (activeTab === 'pending') return item.status === 'pending'
    if (activeTab === 'follow_up') return item.status === 'follow_up'
    if (activeTab === 'closed') return ['converted', 'no_answer', 'not_interested', 'closed'].includes(item.status)
    return true
  }).sort((a, b) => {
    const dateA = a.message_date ? new Date(a.message_date + 'T12:00:00') : new Date(a.created_at)
    const dateB = b.message_date ? new Date(b.message_date + 'T12:00:00') : new Date(b.created_at)
    return dateA.getTime() - dateB.getTime()
  })

  const pendingCount = items.filter(i => i.status === 'pending').length
  const followUpCount = items.filter(i => i.status === 'follow_up').length
  const chatbotCount = items.filter(i => i.source === 'chatbot' && i.status === 'pending').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda de Llamadas</h1>
          <p className="text-sm text-gray-500">
            Registro de prospectos y seguimiento de llamadas
            {chatbotCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-indigo-600 font-medium">
                <Bot className="w-3.5 h-3.5" />
                {chatbotCount} del chatbot
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nueva Llamada
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:ring-2 ring-yellow-300 transition-all" onClick={() => setActiveTab('pending')}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">Pendientes</p>
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 ring-purple-300 transition-all" onClick={() => setActiveTab('follow_up')}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">Seguimiento</p>
            <p className="text-2xl font-bold text-purple-600">{followUpCount}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 ring-green-300 transition-all" onClick={() => setActiveTab('closed')}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">Cerrados</p>
            <p className="text-2xl font-bold text-gray-600">
              {items.filter(i => ['converted', 'no_answer', 'not_interested', 'closed'].includes(i.status)).length}
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 ring-blue-300 transition-all" onClick={() => setActiveTab('all')}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-2xl font-bold text-blue-600">{items.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab indicator */}
      <div className="flex gap-2">
        {([
          { key: 'pending', label: 'Pendientes', count: pendingCount },
          { key: 'follow_up', label: 'Seguimiento', count: followUpCount },
          { key: 'closed', label: 'Cerrados' },
          { key: 'all', label: 'Todos' },
        ] as const).map(tab => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {'count' in tab && tab.count ? (
              <Badge className="ml-1.5 bg-white/20 text-current text-xs px-1.5">{tab.count}</Badge>
            ) : null}
          </Button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No hay registros en esta categoria.</p>
        ) : filtered.map(item => (
          <AgendaCard
            key={item.id}
            item={item}
            onUpdateStatus={updateStatus}
            onUpdateHenryNotes={updateHenryNotes}
            onDelete={deleteItem}
            onEdit={setEditingItem}
          />
        ))}
      </div>

      {/* New callback form dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Nueva Llamada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre del Prospecto *</Label>
                <Input
                  value={form.prospect_name}
                  onChange={e => setForm({ ...form, prospect_name: e.target.value })}
                  placeholder="Nombre completo"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefono *</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="(000) 000-0000"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Servicio de Interes</Label>
              <Select value={form.service_interest} onValueChange={v => setForm({ ...form, service_interest: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
                <SelectContent>
                  {SERVICE_OPTIONS.map(s => (
                    <SelectItem key={s.slug} value={s.slug}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha del Mensaje (WhatsApp)</Label>
              <Input
                type="date"
                value={form.message_date}
                onChange={e => setForm({ ...form, message_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas / Contexto del Prospecto</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Contexto de la llamada..."
                rows={3}
              />
            </div>
            <Button className="w-full" onClick={() => handleSubmit()} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Registrar Prospecto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit / Follow-up dialog */}
      <Dialog open={editingItem !== null} onOpenChange={(open) => { if (!open) setEditingItem(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem?.prospect_name} — {editingItem?.phone}
            </DialogTitle>
          </DialogHeader>
          {editingItem && (
            <EditForm
              item={editingItem}
              onUpdateStatus={updateStatus}
              onUpdateHenryNotes={updateHenryNotes}
              onClose={() => setEditingItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AgendaCard({
  item,
  onUpdateStatus,
  onUpdateHenryNotes,
  onDelete,
  onEdit,
}: {
  item: CallbackRequest
  onUpdateStatus: (id: string, status: CallbackStatus, followUpDate?: string) => Promise<void>
  onUpdateHenryNotes: (id: string, henryNotes: string) => Promise<void>
  onDelete: (id: string) => void
  onEdit: (item: CallbackRequest) => void
}) {
  const config = STATUS_CONFIG[item.status]
  const StatusIcon = config.icon
  const serviceLabel = SERVICE_OPTIONS.find(s => s.slug === item.service_interest)?.label || item.service_interest
  const priority = getPriority(item.message_date, item.created_at)
  const henryLog = Array.isArray(item.henry_notes) ? item.henry_notes : []
  const [newNote, setNewNote] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  async function handleSaveNotes() {
    if (!newNote.trim()) return
    setSavingNotes(true)
    await onUpdateHenryNotes(item.id, newNote.trim())
    setNewNote('')
    setSavingNotes(false)
  }

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Name + badges */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-gray-900">{item.prospect_name}</h3>
              <Badge className={config.color}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>
              <Badge className={priority.color}>
                <AlertTriangle className="w-3 h-3 mr-1" />
                {priority.label}
              </Badge>
              {item.source === 'chatbot' && (
                <Badge className="bg-indigo-100 text-indigo-800">
                  <Bot className="w-3 h-3 mr-1" />
                  Chatbot
                </Badge>
              )}
            </div>

            {/* Info row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              <a href={`tel:${item.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                <Phone className="w-3.5 h-3.5" />
                {item.phone}
              </a>
              {serviceLabel && (
                <span className="text-gray-600">{serviceLabel}</span>
              )}
              {item.message_date && (
                <span className="text-amber-600 font-medium">
                  Mensaje: {format(new Date(item.message_date + 'T12:00:00'), "d MMM yyyy", { locale: es })}
                </span>
              )}
              <span className="text-gray-400">
                Registro: {format(new Date(item.created_at), "d MMM yyyy, h:mm a", { locale: es })}
              </span>
              {item.called_at && (
                <span className="text-blue-600">
                  Llamado: {format(new Date(item.called_at), "d MMM yyyy, h:mm a", { locale: es })}
                </span>
              )}
            </div>

            {/* Notes display (context from prospect - read only) */}
            {item.notes && (
              <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-md p-2">{item.notes}</p>
            )}

            {/* Follow-up date */}
            {item.follow_up_date && (
              <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                Seguimiento: {format(new Date(item.follow_up_date + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            {item.status === 'pending' && (
              <>
                <Button size="sm" variant="outline" onClick={() => onUpdateStatus(item.id, 'called')}>
                  <Phone className="w-3 h-3 mr-1" /> Llamado
                </Button>
                <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
                  Seguimiento
                </Button>
              </>
            )}
            {item.status === 'called' && (
              <>
                <Button size="sm" variant="outline" className="text-green-700" onClick={() => onUpdateStatus(item.id, 'converted')}>
                  <UserCheck className="w-3 h-3 mr-1" /> Convertido
                </Button>
                <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
                  Seguimiento
                </Button>
                <Button size="sm" variant="outline" className="text-gray-500" onClick={() => onUpdateStatus(item.id, 'not_interested')}>
                  No Interesado
                </Button>
              </>
            )}
            {item.status === 'follow_up' && (
              <>
                <Button size="sm" variant="outline" onClick={() => onUpdateStatus(item.id, 'called')}>
                  <Phone className="w-3 h-3 mr-1" /> Llamado
                </Button>
                <Button size="sm" variant="outline" className="text-green-700" onClick={() => onUpdateStatus(item.id, 'converted')}>
                  <UserCheck className="w-3 h-3 mr-1" /> Convertido
                </Button>
                <Button size="sm" variant="outline" className="text-orange-600" onClick={() => onUpdateStatus(item.id, 'no_answer')}>
                  Sin Respuesta
                </Button>
              </>
            )}
            {item.status === 'no_answer' && (
              <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
                Reintentar
              </Button>
            )}
            {!['converted', 'not_interested', 'closed'].includes(item.status) && (
              <Button size="sm" variant="outline" className="text-slate-500" onClick={() => onUpdateStatus(item.id, 'closed')}>
                <XCircle className="w-3 h-3 mr-1" /> Cerrar
              </Button>
            )}
            {item.status === 'closed' && (
              <Button size="sm" variant="outline" onClick={() => onUpdateStatus(item.id, 'pending')}>
                Reabrir
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-600"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Henry's notes - history log */}
        <div className="border-t pt-3 space-y-2">
          <label className="text-xs font-medium text-[#F2A900] block">Notas Henry</label>
          {henryLog.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {henryLog.map((entry, i) => (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <p className="text-sm text-gray-800">{entry.text}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {format(new Date(entry.date), "d MMM yyyy, h:mm a", { locale: es })}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Agregar nota..."
              className="text-sm h-9 flex-1"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveNotes() } }}
            />
            <Button
              size="sm"
              className="bg-[#F2A900] hover:bg-[#D4940A] text-white"
              disabled={savingNotes || !newNote.trim()}
              onClick={handleSaveNotes}
            >
              {savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EditForm({
  item,
  onUpdateStatus,
  onUpdateHenryNotes,
  onClose,
}: {
  item: CallbackRequest
  onUpdateStatus: (id: string, status: CallbackStatus, followUpDate?: string) => Promise<void>
  onUpdateHenryNotes: (id: string, henryNotes: string) => Promise<void>
  onClose: () => void
}) {
  const henryLog = Array.isArray(item.henry_notes) ? item.henry_notes : []
  const [newHenryNote, setNewHenryNote] = useState('')
  const [followUpDate, setFollowUpDate] = useState(item.follow_up_date || '')
  const [saving, setSaving] = useState(false)

  return (
    <div className="space-y-4">
      {/* Original prospect notes - read only */}
      {item.notes && (
        <div className="space-y-1.5">
          <Label className="text-gray-500">Notas del Prospecto</Label>
          <p className="text-sm bg-gray-50 rounded-md p-3 text-gray-600">{item.notes}</p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Notas de Henry</Label>
        {henryLog.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {henryLog.map((entry, i) => (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <p className="text-sm text-gray-800">{entry.text}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {format(new Date(entry.date), "d MMM yyyy, h:mm a", { locale: es })}
                </p>
              </div>
            ))}
          </div>
        )}
        <Textarea
          value={newHenryNote}
          onChange={e => setNewHenryNote(e.target.value)}
          rows={2}
          placeholder="Agregar nueva nota..."
        />
      </div>
      <div className="space-y-1.5">
        <Label>Fecha de Seguimiento</Label>
        <Input
          type="date"
          value={followUpDate}
          onChange={e => setFollowUpDate(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            if (followUpDate) {
              await onUpdateStatus(item.id, 'follow_up', followUpDate)
            }
            if (newHenryNote.trim()) {
              await onUpdateHenryNotes(item.id, newHenryNote.trim())
              setNewHenryNote('')
            }
            if (!followUpDate && !newHenryNote.trim()) {
              onClose()
            }
            setSaving(false)
          }}
        >
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
          Guardar
        </Button>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        {!['converted', 'not_interested', 'closed'].includes(item.status) && (
          <Button
            variant="outline"
            className="text-slate-500"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              if (newHenryNote.trim()) {
                await onUpdateHenryNotes(item.id, newHenryNote.trim())
              }
              await onUpdateStatus(item.id, 'closed')
              setSaving(false)
            }}
          >
            <XCircle className="w-4 h-4 mr-1" />
            Cerrar
          </Button>
        )}
      </div>
    </div>
  )
}

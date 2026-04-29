'use client'

import { useEffect, useState } from 'react'
import { CommunityPortal } from '../../community-portal'
import { HenryDocuments } from '../../henry-documents'
import type { QuickContact } from './inicio-screen'

interface UploadedDoc {
  id: string
  document_key: string
  name: string
  file_size?: number
  status: string
  direction?: string
}

interface CommunityPost {
  id: string
  type: string
  title: string | null
  content: string | null
  video_url: string | null
  zoom_url: string | null
  pinned: boolean
  created_at: string
}

interface CommunityReaction {
  post_id: string
  user_id: string
  emoji: string
}

interface SchedulingDay {
  day_of_week: number
  start_hour: number
  end_hour: number
}

interface MasScreenProps {
  token: string
  clientId: string
  clientName: string
  caseNumber: string
  serviceName: string
  henryDocuments: UploadedDoc[]
  communityPosts: CommunityPost[]
  communityReactions: CommunityReaction[]
  schedulingDays: SchedulingDay[]
  quickContacts: QuickContact[]
}

type SubView = 'menu' | 'mis_datos' | 'expedientes' | 'comunidad' | 'consultor' | 'mi_perfil' | 'ayuda'

interface MenuItem {
  id: SubView
  label: string
  description: string
  icon: string
  badge?: number
}

export function MasScreen({
  token,
  clientId,
  clientName,
  caseNumber,
  serviceName,
  henryDocuments,
  communityPosts,
  communityReactions,
  schedulingDays,
  quickContacts,
}: MasScreenProps) {
  const [view, setView] = useState<SubView>('menu')

  const items: MenuItem[] = [
    { id: 'mis_datos',   label: 'Mis Datos',                description: 'Nombre, servicio, número de caso',    icon: 'badge' },
    { id: 'expedientes', label: 'Expedientes',              description: 'Documentos aprobados archivados',     icon: 'archive' },
    { id: 'consultor',   label: 'Documentos del Consultor', description: 'Documentos que tu equipo te envía',   icon: 'inbox',
      badge: henryDocuments.length || undefined },
    { id: 'comunidad',   label: 'Comunidad',                description: 'Posts, reacciones y programas',       icon: 'forum' },
    { id: 'mi_perfil',   label: 'Mi Perfil',                description: 'Foto, datos personales, idioma',      icon: 'person' },
    { id: 'ayuda',       label: 'Ayuda',                    description: 'Contactos de tu equipo',              icon: 'support_agent' },
  ]

  if (view === 'menu') {
    return (
      <div className="ulp-screen px-6 py-6 max-w-2xl mx-auto space-y-4">
        <header>
          <h1 className="ulp-h2 italic" style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}>
            Más
          </h1>
          <p className="ulp-body-md mt-2" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
            Tu información, tu equipo y herramientas adicionales.
          </p>
        </header>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setView(item.id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-shadow hover:shadow-sm"
                style={{
                  background: 'var(--color-ulp-surface-container-lowest)',
                  borderColor: 'var(--color-ulp-outline-variant)',
                }}
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--color-ulp-primary-fixed)' }}
                >
                  <span
                    className="material-symbols-outlined"
                    data-fill="1"
                    style={{ fontSize: 22, color: 'var(--color-ulp-primary)' }}
                  >
                    {item.icon}
                  </span>
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className="ulp-body-md font-semibold"
                    style={{ color: 'var(--color-ulp-on-surface)' }}
                  >
                    {item.label}
                  </p>
                  <p
                    className="ulp-body-sm truncate"
                    style={{ color: 'var(--color-ulp-on-surface-variant)' }}
                  >
                    {item.description}
                  </p>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className="text-[11px] font-bold px-2 py-1 rounded-full"
                    style={{
                      background: 'var(--color-ulp-primary)',
                      color: 'var(--color-ulp-on-primary)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 20, color: 'var(--color-ulp-outline)' }}
                >
                  chevron_right
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // ── Sub-vistas ──
  return (
    <div className="ulp-screen max-w-2xl mx-auto">
      <SubViewHeader title={items.find((i) => i.id === view)?.label ?? 'Más'} onBack={() => setView('menu')} />

      <div className="px-6 py-4">
        {view === 'mis_datos' && (
          <MisDatos
            clientName={clientName}
            caseNumber={caseNumber}
            serviceName={serviceName}
          />
        )}
        {view === 'expedientes' && <ExpedientesList token={token} />}
        {view === 'consultor' && (
          <HenryDocuments token={token} documents={henryDocuments} />
        )}
        {view === 'comunidad' && (
          <CommunityPortal
            token={token}
            clientId={clientId}
            posts={communityPosts}
            reactions={communityReactions}
            schedulingDays={schedulingDays}
          />
        )}
        {view === 'mi_perfil' && (
          <MiPerfilPlaceholder clientName={clientName} />
        )}
        {view === 'ayuda' && <Ayuda contacts={quickContacts} />}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Sub-vistas
// ──────────────────────────────────────────────────────────────────

function SubViewHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header
      className="px-6 py-3 flex items-center gap-3 border-b sticky top-[64px] z-10"
      style={{
        background: 'var(--color-ulp-surface-container-lowest)',
        borderColor: 'var(--color-ulp-outline-variant)',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: 'var(--color-ulp-surface-container)' }}
        aria-label="Volver"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
          arrow_back
        </span>
      </button>
      <h2 className="ulp-h3" style={{ color: 'var(--color-ulp-on-surface)', fontSize: 20 }}>
        {title}
      </h2>
    </header>
  )
}

function MisDatos({ clientName, caseNumber, serviceName }: { clientName: string; caseNumber: string; serviceName: string }) {
  const fields = [
    { label: 'Nombre completo', value: clientName },
    { label: 'Servicio',        value: serviceName },
    { label: 'Número de caso',  value: caseNumber || '—' },
  ]
  return (
    <ul className="space-y-3">
      {fields.map((f) => (
        <li
          key={f.label}
          className="p-4 rounded-2xl border"
          style={{
            background: 'var(--color-ulp-surface-container-lowest)',
            borderColor: 'var(--color-ulp-outline-variant)',
          }}
        >
          <p className="ulp-label" style={{ color: 'var(--color-ulp-outline)' }}>
            {f.label}
          </p>
          <p className="ulp-body-md mt-1 font-semibold" style={{ color: 'var(--color-ulp-on-surface)' }}>
            {f.value}
          </p>
        </li>
      ))}
    </ul>
  )
}

interface ApprovedDoc {
  id: string
  name: string
  file_type: string | null
  file_size: number | null
  uploaded_at: string
  document_type_name_es: string | null
  category_name_es: string | null
  phase_when_uploaded: string | null
}

function ExpedientesList({ token }: { token: string }) {
  const [docs, setDocs] = useState<ApprovedDoc[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewDoc, setPreviewDoc] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    fetch(`/api/cita/${encodeURIComponent(token)}/approved-documents`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setDocs(j.docs ?? []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div
        className="rounded-2xl border p-8 text-center animate-pulse"
        style={{
          background: 'var(--color-ulp-surface-container-low)',
          borderColor: 'var(--color-ulp-outline-variant)',
        }}
      >
        <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          Cargando expedientes...
        </p>
      </div>
    )
  }

  if (!docs || docs.length === 0) {
    return (
      <div
        className="rounded-2xl border p-8 text-center space-y-2"
        style={{
          background: 'var(--color-ulp-surface-container-low)',
          borderColor: 'var(--color-ulp-outline-variant)',
        }}
      >
        <span
          className="material-symbols-outlined block mx-auto"
          style={{ fontSize: 48, color: 'var(--color-ulp-outline)' }}
        >
          folder_zip
        </span>
        <p className="ulp-body-md font-semibold">Sin expedientes aprobados todavía</p>
        <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
          Aquí verás los documentos que tu equipo legal ya aprobó.
        </p>
      </div>
    )
  }

  // Agrupar por categoría
  const byCategory = new Map<string, ApprovedDoc[]>()
  for (const d of docs) {
    const cat = d.category_name_es || 'Otros'
    const list = byCategory.get(cat) ?? []
    list.push(d)
    byCategory.set(cat, list)
  }

  return (
    <>
      <div className="space-y-4">
        {Array.from(byCategory.entries()).map(([cat, list]) => (
          <section key={cat}>
            <p
              className="ulp-label mb-2"
              style={{ color: 'var(--color-ulp-on-surface-variant)' }}
            >
              {cat} · {list.length} archivo{list.length === 1 ? '' : 's'}
            </p>
            <ul className="space-y-2">
              {list.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc({ id: doc.id, name: doc.name })}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-shadow hover:shadow-sm"
                    style={{
                      background: 'var(--color-ulp-surface-container-lowest)',
                      borderColor: 'var(--color-ulp-outline-variant)',
                      borderLeftWidth: 3,
                      borderLeftColor: 'var(--color-ulp-status-approved)',
                    }}
                  >
                    <span
                      className="material-symbols-outlined flex-shrink-0"
                      style={{ fontSize: 24, color: 'var(--color-ulp-status-approved)' }}
                    >
                      {doc.file_type?.startsWith('image/') ? 'image' : 'picture_as_pdf'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="ulp-body-sm font-semibold truncate"
                        style={{ color: 'var(--color-ulp-on-surface)' }}
                      >
                        {doc.document_type_name_es || doc.name}
                      </p>
                      <p
                        className="text-[10px] truncate"
                        style={{ color: 'var(--color-ulp-on-surface-variant)' }}
                      >
                        {doc.name}
                      </p>
                    </div>
                    <a
                      href={`/api/client/preview-doc?token=${encodeURIComponent(token)}&id=${encodeURIComponent(doc.id)}&raw=1`}
                      download={doc.name}
                      onClick={(e) => e.stopPropagation()}
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--color-ulp-surface-container)' }}
                      aria-label="Descargar"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        download
                      </span>
                    </a>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <ExpedientesPreview token={token} doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  )
}

function ExpedientesPreview({
  token,
  doc,
  onClose,
}: {
  token: string
  doc: { id: string; name: string } | null
  onClose: () => void
}) {
  if (!doc) return null
  const url = `/api/client/preview-doc?token=${encodeURIComponent(token)}&id=${encodeURIComponent(doc.id)}&raw=1`
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <header
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white font-semibold text-sm truncate flex-1 mr-4">{doc.name}</p>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.12)' }}
          aria-label="Cerrar"
        >
          <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>
            close
          </span>
        </button>
      </header>
      <div className="flex-1 px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        <iframe src={url} className="w-full h-full rounded-xl bg-white" title={doc.name} />
      </div>
    </div>
  )
}

function MiPerfilPlaceholder({ clientName }: { clientName: string }) {
  return (
    <div
      className="rounded-2xl border p-6 space-y-3 text-center"
      style={{
        background: 'var(--color-ulp-surface-container-lowest)',
        borderColor: 'var(--color-ulp-outline-variant)',
      }}
    >
      <span className="material-symbols-outlined block mx-auto" style={{ fontSize: 48, color: 'var(--color-ulp-primary)' }} data-fill="1">
        person
      </span>
      <p className="ulp-body-md font-semibold">{clientName}</p>
      <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
        Pronto podrás actualizar tu foto, idioma preferido y datos básicos directamente desde aquí.
      </p>
    </div>
  )
}

function Ayuda({ contacts }: { contacts: QuickContact[] }) {
  if (contacts.length === 0) {
    return (
      <p className="ulp-body-sm text-center" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
        No hay contactos configurados.
      </p>
    )
  }
  return (
    <ul className="space-y-3">
      {contacts.map((contact) => {
        const initials = contact.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
        const phoneClean = contact.phone_e164?.replace(/\D/g, '')
        const waClean = contact.whatsapp_e164?.replace(/\D/g, '')
        return (
          <li
            key={contact.id}
            className="p-4 rounded-2xl border flex items-center gap-3"
            style={{
              background: 'var(--color-ulp-surface-container-lowest)',
              borderColor: 'var(--color-ulp-outline-variant)',
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: 'var(--color-ulp-primary-container)',
                color: 'var(--color-ulp-on-primary-container)',
              }}
            >
              {contact.avatar_url ? (
                <img src={contact.avatar_url} alt={contact.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="font-bold">{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="ulp-body-md font-semibold" style={{ color: 'var(--color-ulp-on-surface)' }}>
                {contact.name}
              </p>
              <p className="ulp-body-sm" style={{ color: 'var(--color-ulp-on-surface-variant)' }}>
                {contact.role}
              </p>
            </div>
            <div className="flex gap-2">
              {waClean && (
                <a
                  href={`https://wa.me/${waClean}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(34, 197, 94, 0.12)' }}
                  aria-label={`WhatsApp ${contact.name}`}
                >
                  <span
                    className="material-symbols-outlined"
                    data-fill="1"
                    style={{ fontSize: 18, color: 'rgb(22, 163, 74)' }}
                  >
                    chat
                  </span>
                </a>
              )}
              {phoneClean && (
                <a
                  href={`tel:${contact.phone_e164}`}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--color-ulp-primary-fixed)' }}
                  aria-label={`Llamar a ${contact.name}`}
                >
                  <span
                    className="material-symbols-outlined"
                    data-fill="1"
                    style={{ fontSize: 18, color: 'var(--color-ulp-primary)' }}
                  >
                    call
                  </span>
                </a>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

'use client'

import Link from 'next/link'
import {
  Briefcase, Clock, CheckCircle, AlertTriangle, Send, FileText,
} from 'lucide-react'
import { PageHeader, AdminKeyframes } from '@/components/admin-ui'

interface Assignment {
  id: string
  task_description: string | null
  status: string
  assigned_at: string
  updated_at: string
  service_type: string | null
  client_name: string | null
  case: {
    id: string
    case_number: string
    client: { first_name: string; last_name: string } | null
    service: { name: string } | null
  } | null
}

type StatusKey =
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'needs_correction'
  | 'approved'
  | 'completed'

const STATUS_CONFIG: Record<StatusKey, { label: string; icon: typeof Clock; bg: string; text: string; border: string }> = {
  assigned:         { label: 'Nuevo',              icon: Clock,          bg: 'var(--admin-blue-soft)',     text: 'var(--admin-blue)',     border: 'var(--admin-blue)' },
  in_progress:      { label: 'En progreso',        icon: FileText,       bg: 'var(--admin-gold-soft)',     text: 'var(--admin-gold)',     border: 'var(--admin-gold-border, rgba(255,255,255,0.2))' },
  submitted:        { label: 'Enviado a revisión', icon: Send,           bg: 'var(--admin-accent-soft)',   text: 'var(--admin-accent)',   border: 'var(--admin-border-strong)' },
  needs_correction: { label: 'Correcciones',       icon: AlertTriangle,  bg: 'var(--admin-red-soft)',      text: 'var(--admin-red)',      border: 'var(--admin-red)' },
  approved:         { label: 'Aprobado',           icon: CheckCircle,    bg: 'var(--admin-green-soft)',    text: 'var(--admin-green)',    border: 'var(--admin-green)' },
  completed:        { label: 'Completado',         icon: CheckCircle,    bg: 'var(--admin-bg-elev-2)',     text: 'var(--admin-fg-muted)', border: 'var(--admin-border-strong)' },
}

export function EmployeeDashboard({ assignments }: { assignments: Assignment[] }) {
  const pending = assignments.filter(a => !['approved', 'completed'].includes(a.status))
  const done = assignments.filter(a => ['approved', 'completed'].includes(a.status))

  return (
    <div className="space-y-6">
      <AdminKeyframes />
      <PageHeader
        eyebrow="Paralegal · Workspace"
        title="Mis Casos"
        accentDot
        description="Casos asignados a tu workflow. Sube documentos, completa formularios, avanza fases."
        telemetry={[
          { label: 'Total', value: assignments.length.toString() },
          { label: 'Pendientes', value: pending.length.toString() },
          { label: 'Completados', value: done.length.toString() },
        ]}
      />

      {assignments.length === 0 && (
        <div
          className="rounded-2xl p-12 text-center"
          style={{
            background: 'var(--admin-panel-grad)',
            border: '0.5px dashed var(--admin-border-strong)',
            boxShadow: 'var(--admin-shadow)',
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: 'var(--admin-accent-soft)',
              border: '0.5px solid var(--admin-border-strong)',
            }}
          >
            <Briefcase className="w-8 h-8" style={{ color: 'var(--admin-fg-subtle)' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--admin-fg)' }}>Sin casos asignados</p>
          <p style={{ fontSize: 14, color: 'var(--admin-fg-muted)', marginTop: 4 }}>
            Cuando el abogado te asigne un caso, aparecerá aquí.
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>Pendientes</SectionLabel>
          {pending.map(a => (
            <AssignmentCard key={a.id} assignment={a} />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>Completados</SectionLabel>
          {done.map(a => (
            <AssignmentCard key={a.id} assignment={a} />
          ))}
        </section>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--font-mono-tech)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.2em',
        color: 'var(--admin-fg-subtle)',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </h2>
  )
}

function AssignmentCard({ assignment: a }: { assignment: Assignment }) {
  const config = STATUS_CONFIG[(a.status as StatusKey)] || STATUS_CONFIG.assigned
  const StatusIcon = config.icon

  const href = a.case ? `/employee/cases/${a.case.id}` : `/employee/tasks/${a.id}`
  const clientLabel = a.case?.client
    ? `${a.case.client.first_name} ${a.case.client.last_name}`
    : a.client_name || 'Sin cliente'
  const serviceLabel =
    a.case?.service?.name ?? a.service_type ?? 'Sin servicio'
  const caseNum = a.case?.case_number

  return (
    <Link href={href} className="block">
      <div
        className="rounded-2xl p-5 transition-all hover:-translate-y-0.5"
        style={{
          background: 'var(--admin-panel-grad)',
          border: '0.5px solid var(--admin-border-strong)',
          boxShadow: 'var(--admin-shadow)',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--admin-gold-border, var(--admin-gold))'
          e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.25)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--admin-border-strong)'
          e.currentTarget.style.boxShadow = 'var(--admin-shadow)'
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-fg)' }}>{clientLabel}</span>
              {caseNum && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono-tech)',
                    fontSize: 11,
                    color: 'var(--admin-fg-subtle)',
                    letterSpacing: '0.05em',
                  }}
                >
                  #{caseNum}
                </span>
              )}
            </div>

            <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', marginBottom: 8 }}>{serviceLabel}</p>

            {a.task_description && (
              <p
                className="line-clamp-2"
                style={{ fontSize: 13, color: 'var(--admin-fg-muted)', lineHeight: 1.5 }}
              >
                {a.task_description}
              </p>
            )}

            <p
              style={{
                fontSize: 11,
                color: 'var(--admin-fg-subtle)',
                marginTop: 10,
                fontFamily: 'var(--font-mono-tech)',
                letterSpacing: '0.05em',
              }}
            >
              Asignado {new Date(a.assigned_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
            style={{
              background: config.bg,
              color: config.text,
              border: `0.5px solid ${config.border}`,
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.1em',
            }}
          >
            <StatusIcon className="w-3 h-3" />
            {config.label.toUpperCase()}
          </span>
        </div>
      </div>
    </Link>
  )
}

/**
 * Registry data-driven de las pestañas del dashboard de caso por servicio.
 *
 * Reemplaza los ifs hardcoded (`if (isVisaJuvenil) ...`, `if (isApelacion) ...`)
 * que vivían en `case-tabs-by-phase.tsx` y los espejos en `admin-case-view.tsx`.
 * Agregar un servicio nuevo con sus tabs específicas es ahora un cambio en una
 * sola entrada de `SERVICE_DASHBOARD_TABS`.
 *
 * Tanto Henry (`/admin/cases/[id]`) como Diana, Vanessa y Andrium
 * (`/employee/cases/[id]`) renderizan exactamente el mismo componente
 * `CaseTabsByPhase` que lee este registry. Henry pasa `isAdmin={true}` y sus
 * tabs admin-only (Pagos, Bitácora, Legal Review) por `extraTabs`.
 *
 * Si una tab del servicio solo aplica para uno de los roles, declararla con
 * `requiresRole: 'admin' | 'employee'`. NO duplicar el componente en
 * `admin-case-view.tsx` o `employee-case-view.tsx` para diferenciar.
 */

import type { ReactNode } from 'react'
import type { CasePhase } from '@/types/database'
import type { CaseOverview } from '@/app/employee/_shared/phase-types'
import { JurisdictionPanel } from '@/app/admin/cases/[id]/jurisdiction-panel'
import { PhaseHistoryTab } from '@/app/admin/cases/[id]/phase-history-tab'
import { AppealLetterGenerator } from '@/app/admin/cases/[id]/appeal-letter-generator'
import { Eoir26aLetterGenerator } from '@/app/admin/cases/[id]/eoir26a-letter-generator'
import { CartaCambioCorteGenerator } from '@/app/admin/cases/[id]/carta-cambio-corte-generator'
import { I589Review } from '@/app/admin/cases/[id]/i589-review'
import { I589PartAReview } from '@/app/admin/cases/[id]/i589-part-a-review'
import { CredibleFearGenerator } from '@/app/admin/cases/[id]/credible-fear-generator'
import { I485FormSection } from '@/components/legal/i485-form-section'
import { GeneratorsTab } from '@/app/employee/_shared/generators-tab'

/**
 * IDs canónicos de pestañas del dashboard. Centralizados aquí para que el
 * registry sea la fuente única — `case-tabs-by-phase.tsx` re-exporta este tipo
 * por compatibilidad con callers existentes.
 */
export type DashboardTabId =
  | 'docs'
  | 'client-docs'
  | 'oficiales'
  | 'archivados'
  | 'forms'
  | 'notas'
  | 'historia'
  | 'radicacion'
  | 'historico'
  | 'generadores'
  | 'mi-trabajo'
  | 'i360'
  | 'i485'
  | 'bitacora'
  | 'cobranza'
  | 'credible-fear'
  | 'i589-part-a'
  | 'i589-review'
  | 'client-story'
  | 'carta-apelacion'
  | 'carta-exoneracion'
  | 'carta-cambio-corte'
  | 'legal-review'

export type RoleScope = 'any' | 'admin' | 'employee'

/**
 * Contexto pasado al `render` y al `getCount` de cada tab. Encapsula todo
 * lo que un panel necesita para renderizarse sin acoplarse a `CaseTabsByPhase`.
 */
export interface DashboardTabContext {
  caseId: string
  caseNumber: string
  clientId: string
  clientName: string
  serviceSlug: string
  currentPhase: CasePhase | null
  isAdmin: boolean
  overview: CaseOverview | null
  /** Submissions de formularios (form_type + form_data). Útil para tabs que
   *  necesitan ver la última versión I-360, I-589, etc. */
  formSubmissions: Array<{
    id?: string
    form_type: string
    form_data: Record<string, unknown>
    status: string
    admin_notes?: string
    updated_at: string
    minor_index: number
  }>
  currentUserId: string
  onRefresh: () => void
}

export interface DashboardTabDef {
  id: DashboardTabId
  label: string
  /** Solo se renderiza si el rol del viewer matchea. Default: 'any' */
  requiresRole?: RoleScope
  /** Si retorna false, el tab no aparece en la barra ni en el contenido.
   *  Útil para tabs que dependen de current_phase u otros flags del caso. */
  isVisible?: (ctx: DashboardTabContext) => boolean
  /** Render del contenido cuando el tab está activo. */
  render: (ctx: DashboardTabContext) => ReactNode
  /** Contador opcional para el badge del trigger. */
  getCount?: (ctx: DashboardTabContext) => number | undefined
}

/**
 * Registry de tabs específicas por servicio. Las tabs **base** (docs,
 * client-docs, oficiales, archivados, notas, historia, forms si phased) las
 * añade `CaseTabsByPhase` automáticamente — aquí solo van las
 * **service-specific**.
 *
 * Para agregar un servicio nuevo:
 * 1. Asegúrate de que su slug está en `service_catalog` (BD) y en
 *    `SERVICE_REGISTRY` (`src/lib/services/registry.ts`) si usa fases.
 * 2. Declara una entrada en este Record con sus tabs específicas.
 * 3. Listo — no toques `case-tabs-by-phase.tsx` ni `admin-case-view.tsx`.
 */
export const SERVICE_DASHBOARD_TABS: Record<string, DashboardTabDef[]> = {
  'visa-juvenil': [
    {
      id: 'radicacion',
      label: 'Radicación',
      render: (ctx) => (
        <div className="space-y-3">
          <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 flex items-center gap-3">
            <span
              className="material-symbols-outlined text-purple-700"
              data-fill="1"
              style={{ fontSize: 22 }}
            >
              child_care
            </span>
            <div>
              <p className="text-xs font-bold text-purple-800 uppercase">Fase 1 — Custodia</p>
              <p className="text-[11px] text-purple-700">
                Detección de jurisdicción y formularios estatales para obtener la orden con hallazgos SIJS.
              </p>
            </div>
          </div>
          <JurisdictionPanel caseId={ctx.caseId} />
        </div>
      ),
    },
    {
      id: 'historico',
      label: 'Histórico',
      render: (ctx) => <PhaseHistoryTab caseId={ctx.caseId} />,
    },
    {
      id: 'generadores',
      label: 'Generadores',
      render: (ctx) => (
        <GeneratorsTab
          caseId={ctx.caseId}
          clientName={ctx.clientName}
          formSubmissions={ctx.formSubmissions}
          currentPhase={ctx.currentPhase}
        />
      ),
    },
    {
      id: 'i485',
      label: 'I-485',
      render: (ctx) => <I485FormSection caseId={ctx.caseId} />,
    },
  ],
  'asilo-politico': [
    {
      id: 'i589-part-a',
      label: 'I-589 Parte A',
      // Diana usa la vista de lectura del wizard del cliente.
      // Henry tiene I589Review (Parte B/C) — más completo — abajo.
      requiresRole: 'employee',
      render: (ctx) => (
        <I589PartAReview caseId={ctx.caseId} caseNumber={ctx.caseNumber} />
      ),
    },
    {
      id: 'i589-review',
      label: 'I-589',
      requiresRole: 'admin',
      render: (ctx) => (
        <I589Review
          caseId={ctx.caseId}
          submissions={ctx.formSubmissions
            .filter((s) =>
              ['i589_part_b1', 'i589_part_b2', 'i589_part_c1', 'i589_part_c2'].includes(s.form_type),
            )
            .map((s) => ({
              id: s.id ?? '',
              form_type: s.form_type,
              form_data: s.form_data,
              status: s.status,
              admin_notes: s.admin_notes,
              updated_at: s.updated_at,
            }))}
        />
      ),
    },
    {
      id: 'credible-fear',
      label: 'Miedo Creíble',
      render: (ctx) => (
        <CredibleFearGenerator caseId={ctx.caseId} caseNumber={ctx.caseNumber} />
      ),
    },
  ],
  // Reforzar Asilo — servicio standalone (solo Fase 2). Reusa el wizard
  // de revisión I-589 Parte B/C de Henry y el generador de Miedo Creíble.
  // NO incluye I-589 Parte A (esa pertenece a la Fase 1 del proceso completo
  // 'asilo-politico'; los clientes de Reforzar Asilo ya presentaron el I-589
  // y no lo llenan en plataforma).
  'reforzar-asilo': [
    {
      id: 'i589-review',
      label: 'I-589',
      requiresRole: 'admin',
      render: (ctx) => (
        <I589Review
          caseId={ctx.caseId}
          submissions={ctx.formSubmissions
            .filter((s) =>
              ['i589_part_b1', 'i589_part_b2', 'i589_part_c1', 'i589_part_c2'].includes(s.form_type),
            )
            .map((s) => ({
              id: s.id ?? '',
              form_type: s.form_type,
              form_data: s.form_data,
              status: s.status,
              admin_notes: s.admin_notes,
              updated_at: s.updated_at,
            }))}
        />
      ),
    },
    {
      id: 'credible-fear',
      label: 'Miedo Creíble',
      render: (ctx) => (
        <CredibleFearGenerator caseId={ctx.caseId} caseNumber={ctx.caseNumber} />
      ),
    },
  ],
  'apelacion': [
    {
      id: 'carta-apelacion',
      label: 'Carta de Apelación (IA)',
      render: (ctx) => <AppealLetterGenerator caseId={ctx.caseId} caseNumber={ctx.caseNumber} />,
    },
    {
      id: 'carta-exoneracion',
      label: 'Carta de Exoneración (IA)',
      render: (ctx) => <Eoir26aLetterGenerator caseId={ctx.caseId} caseNumber={ctx.caseNumber} />,
    },
  ],
  'cambio-de-corte': [
    {
      id: 'carta-cambio-corte',
      label: 'Carta de Cambio de Corte',
      render: (ctx) => (
        <CartaCambioCorteGenerator
          caseId={ctx.caseId}
          caseNumber={ctx.caseNumber}
          clientName={ctx.clientName}
        />
      ),
    },
  ],
  // Servicios sin entradas heredan solo los base tabs.
}

export function getServiceDashboardTabs(
  serviceSlug: string | null | undefined,
): DashboardTabDef[] {
  if (!serviceSlug) return []
  return SERVICE_DASHBOARD_TABS[serviceSlug] ?? []
}

/**
 * Helper para filtrar tabs por rol + visibilidad.
 * Devuelve solo las tabs que el viewer puede ver.
 */
export function getVisibleServiceTabs(
  ctx: DashboardTabContext,
): DashboardTabDef[] {
  return getServiceDashboardTabs(ctx.serviceSlug).filter((def) => {
    if (def.requiresRole && def.requiresRole !== 'any') {
      const wantsAdmin = def.requiresRole === 'admin'
      if (wantsAdmin !== ctx.isAdmin) return false
    }
    if (def.isVisible && !def.isVisible(ctx)) return false
    return true
  })
}

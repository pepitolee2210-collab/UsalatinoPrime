'use client'

import { DeclarationGenerator } from '@/app/admin/cases/[id]/declaration-generator'
import { ParentalConsentGenerator } from '@/app/admin/cases/[id]/parental-consent-generator'
import { SupplementaryDataForm } from '@/app/admin/cases/[id]/supplementary-data-form'
import type { CasePhase } from '@/types/database'

interface FormSub {
  form_type: string
  form_data: Record<string, unknown>
  status: string
  updated_at: string
  minor_index: number
}

interface GeneratorsTabProps {
  caseId: string
  clientName: string
  formSubmissions: FormSub[]
  currentPhase: CasePhase | null
}

/**
 * Tab "Generadores" para servicios SIJS. Encapsula los tres componentes que
 * Diana usa durante la Fase 1 (Custodia) para producir declaraciones jurídicas
 * a partir de los datos del cliente.
 *
 * Extraído de `case-tabs-by-phase.tsx` para que `dashboard-tabs.ts` lo importe
 * sin generar ciclo de dependencia.
 */
export function GeneratorsTab({
  caseId,
  clientName,
  formSubmissions,
  currentPhase,
}: GeneratorsTabProps) {
  const tutorData = formSubmissions.find((s) => s.form_type === 'tutor_guardian')?.form_data ?? null
  // El backend de generación mergea testigos de tutor + client_witnesses.
  // El UI debe ver la misma lista para que los índices coincidan.
  const clientWitnessesData =
    formSubmissions.find((s) => s.form_type === 'client_witnesses')?.form_data ?? null
  const minorStories = formSubmissions
    .filter((s) => s.form_type === 'client_story')
    .sort((a, b) => (a.minor_index || 0) - (b.minor_index || 0))
    .map((s) => ({ minorIndex: s.minor_index || 0, formData: s.form_data }))
  const absentParents = formSubmissions
    .filter((s) => s.form_type === 'client_absent_parent')
    .sort((a, b) => (a.minor_index || 0) - (b.minor_index || 0))
    .map((s) => ({ formData: s.form_data }))
  // `supplementary` lo llena Diana en el SupplementaryDataForm; el
  // DeclarationGenerator lo necesita para hidratar nombre/DOB/ID en casos
  // con esquema legacy donde el wizard del cliente no capturó esos campos.
  const supplementaryData =
    formSubmissions.find((s) => s.form_type === 'admin_supplementary')?.form_data ?? null

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{
          background: 'var(--admin-gold-soft)',
          border: '0.5px solid var(--admin-gold-border, var(--admin-gold))',
          boxShadow: 'var(--admin-shadow-gold, 0 8px 18px rgba(216,155,29,0.18))',
        }}
      >
        <span
          className="material-symbols-outlined"
          data-fill="1"
          style={{ fontSize: 22, color: 'var(--admin-gold)' }}
        >
          auto_awesome
        </span>
        <div>
          <p
            style={{
              fontFamily: 'var(--font-mono-tech)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: 'var(--admin-gold)',
              textTransform: 'uppercase',
            }}
          >
            Generadores de Fase 1 — Custodia
          </p>
          <p style={{ fontSize: 12, color: 'var(--admin-gold)', marginTop: 2 }}>
            Crea declaraciones, consentimientos y peticiones a partir de la información del cliente.
          </p>
        </div>
      </div>

      <SupplementaryDataForm
        caseId={caseId}
        tutorData={tutorData}
        minorStories={minorStories}
        absentParents={absentParents}
      />

      <ParentalConsentGenerator caseId={caseId} clientName={clientName} formSubmissions={formSubmissions} />

      <DeclarationGenerator
        caseId={caseId}
        clientName={clientName}
        tutorData={tutorData}
        clientWitnessesData={clientWitnessesData}
        minorStories={minorStories}
        absentParents={absentParents}
        supplementaryData={supplementaryData}
      />

      {currentPhase && currentPhase !== 'custodia' && (
        <p
          className="italic"
          style={{ fontSize: 11, color: 'var(--admin-fg-muted)' }}
        >
          Estos generadores son de Fase 1 (Custodia). El caso ya avanzó a {currentPhase.toUpperCase()}, pero puedes seguir generando documentación si necesitas.
        </p>
      )}
    </div>
  )
}

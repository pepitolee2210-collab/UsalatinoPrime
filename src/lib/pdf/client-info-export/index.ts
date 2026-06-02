// Barrel público del módulo de export "Información del cliente".
//
// Uso desde un route handler:
//
//   import { buildClientInfoExport } from '@/lib/pdf/client-info-export'
//   const { pdfBytes, filename } = await buildClientInfoExport(caseId, service)

import type { SupabaseClient } from '@supabase/supabase-js'

import { AUTOMATED_FORMS } from '@/lib/legal/automated-forms-registry'
import { resolveAdapter } from './adapter-registry'
import { buildClientInfoFilename } from './filename'
import { generateClientInfoPdf } from './generator'
import { loadClientInfoSnapshot } from './loader'
import type {
  AdapterContext,
  ClientInfoSection,
  RegistryFieldDef,
} from './types'

export interface BuildClientInfoExportResult {
  pdfBytes: Uint8Array
  filename: string
  sectionsCount: number
  partialErrors: string[]
  /** Datos crudos del snapshot — útiles para auditoría. */
  meta: {
    caseId: string
    caseNumber: string
    serviceSlug: string
    clientFullName: string
  }
}

export async function buildClientInfoExport(
  caseId: string,
  service: SupabaseClient,
): Promise<BuildClientInfoExportResult | null> {
  const snapshot = await loadClientInfoSnapshot(caseId, service)
  if (!snapshot) return null

  const clientFullName = [
    snapshot.clientProfile.firstName,
    snapshot.clientProfile.middleName,
    snapshot.clientProfile.lastName,
  ]
    .filter(Boolean)
    .join(' ')

  const ctx: AdapterContext = {
    caseId: snapshot.caseSnapshot.id,
    caseNumber: snapshot.caseSnapshot.caseNumber,
    clientFullName: clientFullName || 'Cliente',
    serviceSlug: snapshot.caseSnapshot.serviceSlug,
    getRegistryFieldByKey: (slugOrFormName) => {
      if (!slugOrFormName) return null
      const direct = AUTOMATED_FORMS[slugOrFormName]
      if (direct) return direct.fieldByKey as Record<string, RegistryFieldDef>
      // Fallback por formName
      for (const def of Object.values(AUTOMATED_FORMS)) {
        if (def.formName === slugOrFormName) {
          return def.fieldByKey as Record<string, RegistryFieldDef>
        }
      }
      return null
    },
    getMinorName: () => null,
  }

  // Transformar records → sections con captura de errores parciales por adapter.
  const sections: ClientInfoSection[] = []
  const adapterErrors: string[] = [...snapshot.partialErrors]
  for (const rec of snapshot.records) {
    try {
      const adapter = resolveAdapter(rec)
      sections.push(...adapter.toSections(rec, ctx))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error desconocido'
      adapterErrors.push(`${rec.formType}: ${msg}`)
    }
  }

  const generatedAt = new Date().toISOString()
  const pdfBytes = await generateClientInfoPdf({
    caseSnapshot: snapshot.caseSnapshot,
    clientProfile: snapshot.clientProfile,
    sections,
    partialErrors: adapterErrors,
    generatedAt,
  })

  return {
    pdfBytes,
    filename: buildClientInfoFilename({
      caseNumber: snapshot.caseSnapshot.caseNumber,
      generatedAt,
    }),
    sectionsCount: sections.length,
    partialErrors: adapterErrors,
    meta: {
      caseId: snapshot.caseSnapshot.id,
      caseNumber: snapshot.caseSnapshot.caseNumber,
      serviceSlug: snapshot.caseSnapshot.serviceSlug,
      clientFullName: clientFullName || 'Cliente',
    },
  }
}

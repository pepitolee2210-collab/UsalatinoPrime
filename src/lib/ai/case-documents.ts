// Helper genérico para resolver documentos de un caso y enviarlos como PDFs
// nativos a Claude. Reemplaza la lógica antes inline en `generate-appeal-letter.ts`
// (`resolveAppealDocuments`) para que cada nuevo agente IA componga su
// estrategia con `preferredCodes` / `multiCodes` / `fallbackCount`.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'

const log = createLogger('case-documents')

const STORAGE_BUCKET = 'case-documents'

export type DocumentDirection =
  | 'client_to_admin'
  | 'admin_to_client'
  | 'firm_internal'
  | null

export interface ResolveDocsOptions {
  /**
   * Códigos a matchear con `document_types.code` en orden. Cada uno toma UN
   * documento (el primero que matchee). Útil para docs únicos como pasaporte
   * o decisión del juez.
   */
  preferredCodes?: readonly string[]
  /**
   * Códigos que aceptan TODOS sus matches (típicamente `slot_kind='multiple_named'`).
   * Útil para colecciones (e.g., evidencia financiera EOIR-26A donde Diana
   * sube N comprobantes).
   */
  multiCodes?: readonly string[]
  /**
   * Cuántos documentos adicionales tomar de los más recientes que no fueron
   * pickeados arriba. Cubre el caso real donde el admin sube docs sin
   * asignar `document_type_id` (en muestreo de prod ≈70% de uploads).
   */
  fallbackCount?: number
  /**
   * Tope absoluto del array final. Si la suma de preferred + multi + fallback
   * lo supera, se trunca antes de descargar bytes (ahorra requests a Storage).
   * Útil cuando el agente IA tiene presupuesto fijo de PDFs por request.
   */
  cap?: number
  /**
   * Direcciones permitidas. Default solo del cliente (`client_to_admin` o
   * sin direction registrada). Excluye `admin_to_client` (entregables) y
   * `firm_internal` (archivo de firma) por defecto.
   */
  directionAllow?: readonly DocumentDirection[]
}

export interface ResolvedDoc {
  fileId: string
  bytes: Uint8Array
  name: string
  /** `document_types.code` matcheado, o `null` si vino por fallback sin tipo. */
  matchedCode: string | null
}

interface DocumentRow {
  id: string
  document_key: string | null
  file_path: string | null
  name: string
  direction: string | null
  created_at: string
  document_types: { code: string | null } | { code: string | null }[] | null
}

function getCode(d: DocumentRow): string | null {
  const dt = Array.isArray(d.document_types) ? d.document_types[0] : d.document_types
  return dt?.code ?? null
}

async function downloadBytes(
  service: SupabaseClient,
  filePath: string,
): Promise<Uint8Array | null> {
  const { data, error } = await service.storage.from(STORAGE_BUCKET).download(filePath)
  if (error || !data) {
    log.warn('download falló', { filePath, error })
    return null
  }
  const ab = await data.arrayBuffer()
  return new Uint8Array(ab)
}

/**
 * Resuelve documentos del caso aplicando una estrategia configurable:
 *
 *  1. `preferredCodes`: un match por code en orden (single).
 *  2. `multiCodes`: todos los matches por code (multi-slot).
 *  3. `fallbackCount`: docs más recientes que no fueron pickeados arriba.
 *
 * Devuelve los documentos en ese orden con sus bytes ya descargados desde
 * Supabase Storage. Filas sin `file_path` o cuya descarga falle se omiten
 * silenciosamente (se loggean como warning). NUNCA lanza por "no hay docs"
 * — el caller decide qué hacer con un array vacío.
 */
export async function resolveCaseDocuments(
  service: SupabaseClient,
  caseId: string,
  opts: ResolveDocsOptions,
): Promise<ResolvedDoc[]> {
  const directionAllow =
    opts.directionAllow ?? (['client_to_admin', null] as const satisfies readonly DocumentDirection[])
  const preferredCodes = opts.preferredCodes ?? []
  const multiCodes = opts.multiCodes ?? []
  const fallbackCount = opts.fallbackCount ?? 0

  const { data: rows, error } = await service
    .from('documents')
    .select(
      `id, document_key, file_path, name, direction, created_at,
       document_types ( code )`,
    )
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })

  if (error || !rows) {
    log.warn('error consultando documents', { caseId, error })
    return []
  }

  const all = rows as unknown as DocumentRow[]
  const candidates = all.filter((d) =>
    (directionAllow as readonly DocumentDirection[]).includes(d.direction as DocumentDirection),
  )

  const usedIds = new Set<string>()
  const picked: Array<DocumentRow & { matchedCode: string | null }> = []

  for (const code of preferredCodes) {
    const match = candidates.find((d) => !usedIds.has(d.id) && getCode(d) === code)
    if (match) {
      picked.push({ ...match, matchedCode: code })
      usedIds.add(match.id)
    }
  }

  for (const code of multiCodes) {
    for (const d of candidates) {
      if (usedIds.has(d.id)) continue
      if (getCode(d) !== code) continue
      picked.push({ ...d, matchedCode: code })
      usedIds.add(d.id)
    }
  }

  if (fallbackCount > 0) {
    let added = 0
    for (const d of candidates) {
      if (added >= fallbackCount) break
      if (usedIds.has(d.id)) continue
      if (!d.file_path) continue
      picked.push({ ...d, matchedCode: null })
      usedIds.add(d.id)
      added++
    }
  }

  const final = typeof opts.cap === 'number' ? picked.slice(0, opts.cap) : picked

  const downloaded = await Promise.all(
    final.map(async (d) => {
      if (!d.file_path) return null
      const bytes = await downloadBytes(service, d.file_path)
      if (!bytes) return null
      return { fileId: d.id, bytes, name: d.name, matchedCode: d.matchedCode }
    }),
  )
  return downloaded.filter((x): x is ResolvedDoc => x !== null)
}

import { createServiceClient } from '@/lib/supabase/service'

/**
 * Centraliza el patrón "subir un documento generado al bucket `case-documents` +
 * insertar su fila en `documents`", hoy duplicado en varias rutas (case-forms print,
 * carta-cambio-corte, etc.).
 *
 * Mejora respecto a los duplicados: si el INSERT en `documents` falla, compensa
 * borrando el blob huérfano del storage — así nunca queda un archivo subido sin
 * fila que lo referencie.
 *
 * Recordatorio de surfacing: para que el documento aparezca en la pestaña
 * "Documentos Oficiales" del dashboard, deben cumplirse las TRES condiciones:
 *   - document_key terminado en `_filled`
 *   - direction = 'admin_to_client'
 *   - phase_when_uploaded = fase del caso (nullable para servicios sin fases)
 */

const BUCKET = 'case-documents'

export type DocumentDirection = 'client_to_admin' | 'admin_to_client' | 'firm_internal'

export interface PersistGeneratedDocInput {
  /** Cliente service-role. Si se omite, se crea uno internamente. */
  service?: ReturnType<typeof createServiceClient>
  caseId: string
  clientId: string
  documentKey: string
  name: string
  bytes: Uint8Array | Buffer
  contentType: string
  direction?: DocumentDirection
  phaseWhenUploaded?: string | null
  uploadedBy?: string | null
  /** Carpeta dentro del bucket. Por defecto = documentKey sin el sufijo `_filled`. */
  storagePrefix?: string
  fileExt?: string
}

export interface PersistGeneratedDocResult {
  ok: boolean
  documentId: string | null
  storagePath: string
  error?: string
}

export async function persistGeneratedCaseDocument(
  input: PersistGeneratedDocInput,
): Promise<PersistGeneratedDocResult> {
  const {
    caseId,
    clientId,
    documentKey,
    name,
    bytes,
    contentType,
    direction = 'admin_to_client',
    phaseWhenUploaded = null,
    uploadedBy = null,
    storagePrefix = documentKey.replace(/_filled$/, ''),
    fileExt = 'pdf',
  } = input

  const service = input.service ?? createServiceClient()

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const storagePath = `${clientId}/${caseId}/${storagePrefix}/${timestamp}.${fileExt}`

  const { error: uploadErr } = await service.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType, upsert: false })

  if (uploadErr) {
    return { ok: false, documentId: null, storagePath, error: `upload: ${uploadErr.message}` }
  }

  const { data: inserted, error: insertErr } = await service
    .from('documents')
    .insert({
      case_id: caseId,
      client_id: clientId,
      document_key: documentKey,
      name,
      file_path: storagePath,
      file_type: contentType,
      file_size: bytes.length,
      status: 'uploaded',
      uploaded_by: uploadedBy,
      direction,
      phase_when_uploaded: phaseWhenUploaded,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    // Compensación: el blob ya subió pero la fila falló → borrarlo para no dejar basura.
    try {
      await service.storage.from(BUCKET).remove([storagePath])
    } catch {
      // best-effort; si el remove falla queda un blob huérfano sin referencia (inofensivo).
    }
    return { ok: false, documentId: null, storagePath, error: `insert: ${insertErr?.message ?? 'no row'}` }
  }

  return { ok: true, documentId: inserted.id as string, storagePath }
}

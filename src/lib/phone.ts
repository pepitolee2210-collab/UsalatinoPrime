/**
 * Normaliza un teléfono a dígitos US.
 *
 * Reglas:
 *   • Quita todo carácter no-dígito.
 *   • Si quedan 11 dígitos y empieza con "1", quita ese 1 (formato US con prefijo).
 *
 * Debe coincidir 1:1 con la función SQL `normalize_phone(text)` (migración
 * 20260507) para que el lookup en JS y el UNIQUE INDEX en DB sean consistentes.
 */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

/** True si el teléfono normalizado tiene una longitud aceptable (US: 10; intl: 7-15). */
export function isValidPhoneLength(normalized: string): boolean {
  return normalized.length >= 7 && normalized.length <= 15
}

/**
 * Email sintético derivado del teléfono normalizado.
 * Usado por register-client cuando el cliente no tiene cuenta auth todavía.
 *
 * Importante: NO derivar emails sintéticos del passport — dos clientes
 * pueden compartir passport (typos, mismo nombre) y eso causaba colisiones
 * silenciosas en auth.users que llevaban a profiles fantasma.
 */
export function syntheticClientEmail(normalizedPhone: string): string {
  return `client_${normalizedPhone}@usalatinoprime.internal`
}

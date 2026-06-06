// ──────────────────────────────────────────────────────────────────────────
// TRANSFORMACIÓN AL IMPRIMIR — USCIS Form I-485
// ──────────────────────────────────────────────────────────────────────────
//
// El cliente edita controles "virtuales" (radios Sí/No, sexo, estado civil,
// color de ojos, etc.) cuyas keys empiezan con `v_` y NO existen en el PDF.
// Esta función — que el endpoint /print invoca como `def.processForPrint(effective)`
// (ver src/app/api/admin/case-forms/[slug]/print/route.ts) — traduce cada valor
// virtual al checkbox REAL del acroform, usando el mapeo `real` que cada campo
// declara junto a sí en `i485-client-form.ts` (una sola fuente de verdad).
//
// Además aplica el `defaultValue` de cada control virtual cuando el cliente no
// respondió: así las preguntas de inadmisibilidad quedan en "No" por defecto
// (lo correcto para la inmensa mayoría de casos SIJS), en vez de salir en blanco.
//
// El llenado del PDF (acroform-service) marca cada checkbox con su on-value real
// leído del propio acroform, así que aquí solo necesitamos poner la key real en
// `true`.

import { I485_CLIENT_FORM } from './i485-client-form'

function isEmpty(v: string | boolean | null | undefined): boolean {
  return v === null || v === undefined || v === ''
}

export function processForPrint(
  values: Record<string, string | boolean | null | undefined>,
): Record<string, string | boolean | null | undefined> {
  const out = { ...values }

  for (const section of I485_CLIENT_FORM) {
    for (const field of section.fields) {
      if (!field.real) continue

      // Valor elegido por el cliente; si no respondió, usar el default del campo.
      const chosen = isEmpty(out[field.key]) ? field.defaultValue : out[field.key]

      // La key virtual no tiene pdfFieldName: quitarla para que no se intente
      // escribir al PDF.
      delete out[field.key]

      if (isEmpty(chosen)) {
        // Sin valor ni default → no tocamos los checkboxes reales (así se respeta
        // cualquier valor que el prefill ya hubiera puesto).
        continue
      }

      // Marca el checkbox elegido y DESMARCA los demás del mismo grupo. La
      // exclusividad es clave: si el prefill ya había marcado otra opción (ej.
      // estado civil "soltero") y el cliente eligió otra, el PDF no debe quedar
      // con dos opciones marcadas.
      for (const [optionValue, realKey] of Object.entries(field.real)) {
        out[realKey] = String(chosen) === optionValue
      }
    }
  }

  return out
}
